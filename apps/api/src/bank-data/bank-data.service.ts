import { Injectable, BadRequestException, ForbiddenException, StreamableFile } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Workbook } from 'exceljs';
import { PrismaService } from '../prisma/prisma.service';
import { AccessService } from '../access/access.service';
import { DATASETS, DatasetDef, KolomDef, getDataset, kolomEfektif } from './datasets';
@Injectable()
export class BankDataService {
    constructor(private readonly prisma: PrismaService, private readonly access: AccessService) { }
    private async permission(user: any) {
        if (!user?.id)
            throw new ForbiddenException('Sesi diperlukan');
        const a = await this.access.resolveUserAccess(user);
        const admin = a.roles.some(r => ['ADMIN', 'ADMINISTRATOR'].includes(r));
        if (!admin && !a.pageIds.includes('bank-data'))
            throw new ForbiddenException('Tidak memiliki akses Bank Data');
        let bolehKelola = admin || !!a.caps?.includes('bank_data.kelola');
        if (!bolehKelola) {
            try {
                const setting = await this.prisma.site_settings.findUnique({ where: { key: 'bank_data.kelola' } });
                if (setting?.value) {
                    const parsed = typeof setting.value === 'string' ? JSON.parse(setting.value) : setting.value;
                    const roles = a.roles.map(r => r.toUpperCase());
                    const idStr = String(user.id);
                    if (Array.isArray(parsed?.allowedRoles) && parsed.allowedRoles.some((r: string) => roles.includes(r.toUpperCase()))) {
                        bolehKelola = true;
                    }
                    if (Array.isArray(parsed?.allowedUsers) && parsed.allowedUsers.some((u: any) => String(u?.id) === idStr)) {
                        bolehKelola = true;
                    }
                }
            } catch {
                // Abaikan jika tidak ada
            }
        }
        return { bolehKelola, bolehSensitif: admin || !!a.caps?.includes('bank_data.export_sensitif') };
    }
    private async manager(user: any) { if (!(await this.permission(user)).bolehKelola)
        throw new ForbiddenException('Izin pengelola diperlukan'); }
    private config(def: DatasetDef, row: any) {
        return { aktif: row ? row.aktif === true : true,
            kolomDiizinkan: Array.isArray(row?.kolom_diizinkan) ? row.kolom_diizinkan : def.kolom.filter(k => !k.sensitif).map(k => k.key),
            batasBaris: Math.max(1, Math.min(def.batasBaris, Number(row?.batas_baris) || def.batasBaris)), catatan: row?.catatan || '' };
    }
    async getCatalog(user: any) {
        const permission = await this.permission(user);
        const configs = await this.prisma.bank_data_dataset_config.findMany();
        return { ok: true, ...permission, data: Object.values(DATASETS).map(def => {
                const cfg = this.config(def as DatasetDef, configs.find(c => c.dataset_id === def.id));
                return { id: def.id, label: def.label, ikon: def.ikon, deskripsi: def.deskripsi, filter: def.filter, ...cfg,
                    kolom: kolomEfektif(def as DatasetDef, null, cfg.kolomDiizinkan, permission.bolehSensitif).map(k => ({ ...k, pendukung: !!k.pendukung })) };
            }).filter(d => d.aktif) };
    }
    async getConfig(user: any) {
        await this.manager(user);
        const rows = await this.prisma.bank_data_dataset_config.findMany();
        return { ok: true, data: Object.values(DATASETS).map(def => ({ ...def, ...this.config(def as DatasetDef, rows.find(r => r.dataset_id === def.id)), batasBarisKatalog: def.batasBaris, kolom: def.kolom.map(k => ({ ...k, pendukung: !!('pendukung' in k && k.pendukung) })) })) };
    }
    async updateConfig(body: any, user: any) {
        await this.manager(user);
        const def = getDataset(body?.dataset_id);
        if (!def)
            throw new BadRequestException('Dataset tidak dikenal');
        if (!Array.isArray(body.kolomDiizinkan) || body.kolomDiizinkan.some((k: any) => !def.kolom.some(c => c.key === k)))
            throw new BadRequestException('Kolom tidak dikenal');
        const limit = Number(body.batasBaris || def.batasBaris);
        if (!Number.isInteger(limit) || limit < 1 || limit > def.batasBaris)
            throw new BadRequestException('Batas baris tidak valid');
        const userId = user?.id ? BigInt(user.id) : null;
        const data = {
            aktif: body.aktif === true,
            kolom_diizinkan: body.kolomDiizinkan,
            batas_baris: limit,
            catatan: body.catatan || null,
            updated_by: userId,
            updated_at: new Date(),
        };
        await this.prisma.bank_data_dataset_config.upsert({ where: { dataset_id: def.id }, create: { dataset_id: def.id, ...data }, update: data });
        return { ok: true };
    }
    async getLogs(user: any, page = 1, limit = 50, datasetId?: string) {
        await this.manager(user);
        page = Number.isFinite(page) ? Math.max(1, Math.floor(page)) : 1;
        const where = datasetId ? { dataset_id: datasetId } : {};
        const [data, total] = await Promise.all([this.prisma.bank_data_log.findMany({ where, skip: (page - 1) * limit, take: limit, orderBy: { created_at: 'desc' } }), this.prisma.bank_data_log.count({ where })]);
        return { ok: true, data: JSON.parse(JSON.stringify(data.map(r => ({ ...r, dataset_label: getDataset(r.dataset_id)?.label || r.dataset_id })), (_, v) => typeof v === 'bigint' ? String(v) : v)), total, halaman: page, perHalaman: limit };
    }
    // Dynamic identifiers below come only from the server catalog, never the request.
    private model(table: string): any { return (this.prisma as any)[table]; }
    private values(table: string, column: string, values: any[]) {
        const type = Prisma.dmmf.datamodel.models.find(m => m.name === table)?.fields.find(f => f.name === column)?.type;
        return values.map(v => type === 'BigInt' ? BigInt(v) : type === 'Int' ? Number(v) : String(v));
    }
    private filter(p: any, f: any) {
        const where: any = {};
        if (p.kolomAktif)
            where[p.kolomAktif] = true;
        if (p.kolomTahunAjaran && typeof f?.tahun_ajaran === 'string' && f.tahun_ajaran.trim())
            where[p.kolomTahunAjaran] = f.tahun_ajaran.trim();
        if (p.kolomSemester && f?.semester) {
            const semStr = String(f.semester).trim().toLowerCase();
            const n = ['1', 'ganjil'].includes(semStr) ? 1 : ['2', 'genap'].includes(semStr) ? 2 : 0;
            if (!n)
                throw new BadRequestException('Semester tidak valid');
            where[p.kolomSemester] = p.tipeSemester === 'angka' ? n : n === 1 ? 'Ganjil' : 'Genap';
        }
        return where;
    }
    private async rows(def: DatasetDef, columns: KolomDef[], filter: any, take: number) {
        const where: any = {};
        for (const b of def.baseFilter || [])
            where[b.kolom] = b.op === 'eq' ? b.nilai : { equals: b.nilai, mode: 'insensitive' };
        const p = def.prasaring;
        if (p && (filter.tahun_ajaran || filter.semester || filter.kelas?.length)) {
            const pre = this.filter(p, filter);
            if (p.kolomKelas && filter.kelas?.length)
                pre[p.kolomKelas] = { in: filter.kelas };
            const keys = await this.model(p.table).findMany({ where: pre, select: { [p.kolomKunci]: true }, distinct: [p.kolomKunci] });
            where[p.kunciInduk] = { in: keys.map((r: any) => r[p.kolomKunci]) };
        }
        const needed = new Set(columns.map(c => c.key));
        for (const c of [...def.kolom].reverse())
            if (needed.has(c.key) && c.pendukung?.kunciDari)
                needed.add(c.pendukung.kunciDari);
        const working = def.kolom.filter(c => needed.has(c.key));
        const select: any = { id: true };
        for (const c of working) {
            if (!c.pendukung)
                select[c.key] = true;
            else if (c.pendukung.kunciInduk)
                select[c.pendukung.kunciInduk] = true;
        }
        const [total, rows] = await Promise.all([this.model(def.table).count({ where }), this.model(def.table).findMany({ where, select, take, orderBy: def.urut ? { [def.urut.kolom]: def.urut.naik === false ? 'desc' : 'asc' } : { id: 'asc' } })]);
        const raw: Record<string, any[]>[] = rows.map(() => ({}));
        for (const col of working.filter(c => c.pendukung)) {
            const d = col.pendukung!;
            const perRow = rows.map((r: any, i: number) => d.kunciDari ? raw[i][d.kunciDari] || [] : r[d.kunciInduk!] == null ? [] : [r[d.kunciInduk!]]);
            const keys = [...new Set(perRow.flat())];
            const related = keys.length ? await this.model(d.table).findMany({ where: { ...this.filter(d, filter), [d.kunciPendukung]: { in: this.values(d.table, d.kunciPendukung, keys) } }, select: { [d.kunciPendukung]: true, [d.kolomNilai]: true } }) : [];
            const labels = new Map<string, string>();
            if (d.lewat && related.length) {
                const l = d.lewat;
                const ids = [...new Set(related.map((r: any) => r[d.kolomNilai]).filter((v: any) => v != null))];
                const refs = await this.model(l.table).findMany({ where: { [l.kunci]: { in: this.values(l.table, l.kunci, ids) } }, select: { [l.kunci]: true, [l.kolomNilai]: true } });
                refs.forEach((r: any) => labels.set(String(r[l.kunci]), String(r[l.kolomNilai] ?? '')));
            }
            rows.forEach((r: any, i: number) => {
                const keys = new Set(perRow[i].map(String));
                const vals: string[] = related.filter((x: any) => keys.has(String(x[d.kunciPendukung]))).map((x: any) => d.lewat ? labels.get(String(x[d.kolomNilai])) : x[d.kolomNilai]).filter((v: any) => v != null && v !== '').map(String);
                raw[i][col.key] = [...new Set(vals)].sort();
                r[col.key] = raw[i][col.key].join(', ');
            });
        }
        return { total, data: rows.map((r: any) => Object.fromEntries(columns.map(c => [c.key, typeof r[c.key] === 'bigint' ? String(r[c.key]) : r[c.key]]))) };
    }
    async handlePost(body: any, user: any, ip = '') {
        const permission = await this.permission(user);
        const def = getDataset(body?.dataset_id);
        if (!def || !['preview', 'export'].includes(body?.action))
            throw new BadRequestException('Dataset atau aksi tidak dikenal');
        const cfg = this.config(def, await this.prisma.bank_data_dataset_config.findUnique({ where: { dataset_id: def.id } }));
        if (!cfg.aktif)
            throw new ForbiddenException('Dataset tidak aktif');
        if (!Array.isArray(body.kolom) || !body.kolom.length)
            throw new BadRequestException('Pilih kolom');
        const columns = kolomEfektif(def, body.kolom, cfg.kolomDiizinkan, permission.bolehSensitif);
        if (body.kolom.some((k: any) => !columns.some(c => c.key === k)))
            throw new ForbiddenException('Kolom tidak diizinkan');
        const filter = body.filter || {};
        if (filter.kelas && (!Array.isArray(filter.kelas) || filter.kelas.some((v: any) => typeof v !== 'string')))
            throw new BadRequestException('Filter kelas tidak valid');
        if (filter.tahun_ajaran && typeof filter.tahun_ajaran !== 'string')
            throw new BadRequestException('Filter tahun ajaran tidak valid');
        if (filter.semester && typeof filter.semester !== 'string')
            throw new BadRequestException('Filter semester tidak valid');

        const result = await this.rows(def, columns, filter, body.action === 'preview' ? Math.min(50, cfg.batasBaris) : cfg.batasBaris);
        
        if (body.action === 'preview') {
            // Catat audit trail pratinjau jika terdapat kolom sensitif
            if (columns.some(c => c.sensitif)) {
                await this.prisma.bank_data_log.create({
                    data: {
                        user_id: user?.id ? BigInt(user.id) : null,
                        nama_user: user?.nama || user?.username || '',
                        dataset_id: def.id,
                        filter: { ...filter, _tipe: 'preview' },
                        kolom: columns.map(c => c.key),
                        jumlah_baris: result.data.length,
                        ip: ip || null,
                    },
                }).catch(() => null);
            }
            return {
                ok: true,
                ...result,
                kolom: columns.map(c => ({ key: c.key, label: c.label })),
                batas: cfg.batasBaris,
                terpotong: result.total > cfg.batasBaris,
            };
        }

        const sanitizeCellValue = (val: any) => {
            if (val === null || val === undefined) return '';
            if (typeof val === 'string') {
                // Prevent Formula / CSV Injection (CWE-1236)
                if (/^[=+@-]/s.test(val)) {
                    return `'${val}`;
                }
                return val;
            }
            if (val instanceof Date) {
                return val.toISOString().slice(0, 10);
            }
            return val;
        };

        const book = new Workbook();
        const sheet = book.addWorksheet('Data');
        sheet.columns = columns.map(c => ({ header: c.label, key: c.key, width: 24 }));
        result.data.forEach((r: any) => {
            const cleanRow: Record<string, any> = {};
            for (const c of columns) {
                cleanRow[c.key] = sanitizeCellValue(r[c.key]);
            }
            sheet.addRow(cleanRow);
        });
        const buffer = await book.xlsx.writeBuffer();
        
        await this.prisma.bank_data_log.create({
            data: {
                user_id: user?.id ? BigInt(user.id) : null,
                nama_user: user?.nama || user?.username || '',
                dataset_id: def.id,
                filter,
                kolom: columns.map(c => c.key),
                jumlah_baris: result.data.length,
                ip: ip || null,
            },
        });
        return new StreamableFile(Buffer.from(buffer));
    }
}
