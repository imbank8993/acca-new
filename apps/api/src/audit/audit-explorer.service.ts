import { Injectable, NotFoundException, ServiceUnavailableException, OnModuleInit, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

const quote = (name: string) => '"' + name.replace(/"/g, '""') + '"';
const ignored = ['audit_logs', 'activity_logs', 'user_heartbeats', '_prisma_migrations'];

@Injectable()
export class AuditExplorerService implements OnModuleInit {
    private readonly logger = new Logger(AuditExplorerService.name);
    constructor(private readonly prisma: PrismaService) {}

    async onModuleInit() {
        try {
            const [ready] = await this.prisma.$queryRawUnsafe<any[]>("SELECT to_regprocedure('public.acca_install_audit_triggers()') IS NOT NULL AS ready");
            if (ready?.ready) await this.prisma.$queryRawUnsafe('SELECT public.acca_install_audit_triggers()');
            else this.logger.warn('Audit menyeluruh belum aktif: migrasi system_audit belum diterapkan.');
        } catch { this.logger.warn('Cakupan audit database belum dapat diperiksa saat startup.'); }
    }

    async status() {
        const rows = await this.prisma.$queryRawUnsafe<any[]>(`
            SELECT count(*)::int AS total, count(*) FILTER (WHERE EXISTS (
              SELECT 1 FROM pg_trigger t WHERE t.tgrelid=c.oid AND t.tgname='acca_audit_row' AND t.tgenabled IN ('O','A')
                AND t.tgfoid=to_regprocedure('public.acca_capture_change()')
            ) AND EXISTS (
              SELECT 1 FROM pg_trigger t WHERE t.tgrelid=c.oid AND t.tgname='acca_audit_truncate' AND t.tgenabled IN ('O','A')
                AND t.tgfoid=to_regprocedure('public.acca_capture_change()')
            ))::int AS covered FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
            WHERE n.nspname IN ('public','auth') AND c.relkind IN ('r','p')
              AND NOT(c.relname=ANY($1::text[]))`, ignored);
        return { ok: true, total: rows[0]?.total || 0, covered: rows[0]?.covered || 0,
            active: rows[0]?.total > 0 && rows[0].covered === rows[0].total };
    }

    async tables() {
        const data = await this.prisma.$queryRawUnsafe<any[]>(`
            SELECT n.nspname AS schema, c.relname AS name, greatest(c.reltuples,0)::bigint::text AS estimated_rows,
              (SELECT count(*)::int FROM pg_attribute a WHERE a.attrelid=c.oid AND a.attnum>0 AND NOT a.attisdropped) AS columns,
              n.nspname='public' AND c.relname <> '_prisma_migrations' AS readable
            FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
            WHERE n.nspname IN ('public','auth') AND c.relkind IN ('r','p') AND NOT c.relispartition
            ORDER BY n.nspname,c.relname`);
        return { ok: true, data };
    }

    async table(schema: string, name: string, page: number, limit: number) {
        if (!['public', 'auth'].includes(schema) || !name || name.length > 128) throw new NotFoundException('Tabel tidak ditemukan.');
        const [relation] = await this.prisma.$queryRawUnsafe<any[]>(`
            SELECT c.oid::int AS oid, n.nspname='public' AND c.relname <> '_prisma_migrations' AS readable
            FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
            WHERE n.nspname=$1 AND c.relname=$2 AND c.relkind IN ('r','p') AND NOT c.relispartition`, schema, name);
        if (!relation) throw new NotFoundException('Tabel tidak ditemukan.');
        const columns = await this.prisma.$queryRawUnsafe<any[]>(`
            SELECT a.attname AS name, format_type(a.atttypid,a.atttypmod) AS type,
              NOT a.attnotnull AS nullable, EXISTS(SELECT 1 FROM pg_index i WHERE i.indrelid=a.attrelid AND i.indisprimary AND a.attnum=ANY(i.indkey)) AS primary_key
            FROM pg_attribute a WHERE a.attrelid=$1::oid AND a.attnum>0 AND NOT a.attisdropped ORDER BY a.attnum`, relation.oid);
        if (!relation.readable) return { ok: true, columns, rows: [], hasMore: false, readable: false };
        const [ready] = await this.prisma.$queryRawUnsafe<any[]>("SELECT to_regprocedure('public.acca_audit_redact(jsonb,integer)') IS NOT NULL AS ready");
        if (!ready?.ready) throw new ServiceUnavailableException('Penjelajah data belum diaktifkan di server.');
        const offset = (page - 1) * limit;
        const order = columns.filter(item => item.primary_key).map(item => `t.${quote(item.name)}`).join(',') || 't.tableoid,t.ctid';
        const data = await this.prisma.$transaction(async tx => {
            await tx.$executeRawUnsafe('SET TRANSACTION READ ONLY');
            await tx.$executeRawUnsafe("SET LOCAL statement_timeout='8s'");
            await tx.$executeRawUnsafe("SET LOCAL lock_timeout='2s'");
            return tx.$queryRawUnsafe<any[]>(`SELECT public.acca_audit_redact(to_jsonb(t)) AS row FROM ${quote(schema)}.${quote(name)} t ORDER BY ${order} LIMIT $1 OFFSET $2`, limit + 1, offset);
        }, { timeout: 12000, maxWait: 5000 });
        return { ok: true, columns, rows: data.slice(0, limit).map(item => item.row), hasMore: data.length > limit, readable: true };
    }
}
