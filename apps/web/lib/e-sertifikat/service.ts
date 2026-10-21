import { Prisma } from '@prisma/client';
import { randomBytes } from 'node:crypto';
import type { ApiUser } from '../api-auth';
import type { CertificateEvent, CertificateSnapshot, Recipient, Asset } from './model';
import { CertificateError, text, uuid, validateEvent, validateRecipients } from './validation';
import { assertPageGeometry, templateGeometry } from './geometry';

// Narrow database boundary also permits integration tests in an isolated schema.
export type CertificateDb = {
    $queryRaw<T = any>(query: Prisma.Sql): Promise<T>;
    $executeRaw(query: Prisma.Sql): Promise<number>;
    $transaction<T>(callback: (tx: CertificateDb) => Promise<T>): Promise<T>;
};
export function assertManager(user: ApiUser | null): asserts user is ApiUser {
    if (!user) throw new CertificateError('Silakan masuk terlebih dahulu', 401);
    if (!user.isAdmin && (!user.pages.includes('e-sertifikat') || user.roles.some(role => ['SISWA', 'ORANG_TUA', 'ORANGTUA'].includes(role))))
        throw new CertificateError('Anda tidak memiliki akses pengelolaan e-sertifikat', 403);
}
export function publicOrigin() {
    const url = new URL(process.env.ECERT_PUBLIC_ORIGIN || 'https://acca.icgowa.sch.id');
    if (url.username || url.password || url.search || url.hash || url.pathname !== '/' ||
        (url.protocol !== 'https:' && !(['localhost', '127.0.0.1'].includes(url.hostname) && url.protocol === 'http:')))
        throw new CertificateError('ECERT_PUBLIC_ORIGIN harus berupa alamat utama HTTPS', 500);
    return url.origin;
}
export const verifyUrl = (token: string, origin = publicOrigin()) => `${origin}/e-sertifikat/verifikasi/${token}`;
const json = (value: unknown) => JSON.stringify(value);
export class CertificateService {
    constructor(private db: CertificateDb) {}
    private async audit(db: CertificateDb, event: string, user: ApiUser, action: string, detail: unknown = {}) {
        await db.$executeRaw(Prisma.sql`INSERT INTO ecert_audit(event_id,actor_id,action,detail) VALUES (${event}::uuid,${user.authId},${action},${json(detail)}::jsonb)`);
    }
    async event(user: ApiUser, id: string, db = this.db, lock = false): Promise<CertificateEvent> {
        assertManager(user); uuid(id);
        const rows = await db.$queryRaw<CertificateEvent[]>(Prisma.sql`SELECT *, start_date::text, end_date::text FROM ecert_events
          WHERE id=${id}::uuid AND (${user.isAdmin} OR owner_id=${user.authId}) ${lock ? Prisma.sql`FOR UPDATE` : Prisma.empty}`);
        if (!rows[0]) throw new CertificateError('Kegiatan tidak ditemukan', 404);
        return rows[0];
    }
    async list(user: ApiUser, params = new URLSearchParams()) {
        assertManager(user);
        const integer = (key: string, fallback: number, max: number) => {
            const value = params.get(key);
            if (value === null) return fallback;
            if (!/^[1-9]\d{0,6}$/.test(value) || Number(value) > max) throw new CertificateError('Pagination kegiatan tidak valid');
            return Number(value);
        };
        const page = integer('page', 1, 1000000), pageSize = integer('pageSize', 24, 100);
        const search = text(params.get('q') || '', 'Pencarian', 200, false).toLowerCase();
        const status = params.get('status') || 'all';
        if (!['all', 'active', 'archived'].includes(status)) throw new CertificateError('Status kegiatan tidak valid');
        const where = Prisma.sql`(${user.isAdmin} OR e.owner_id=${user.authId})
          AND (${status === 'all'} OR e.archived=${status === 'archived'})
          AND (${search === ''} OR strpos(lower(e.title || ' ' || e.organizer),${search}) > 0)`;
        const [{ total }] = await this.db.$queryRaw<{ total: number }[]>(Prisma.sql`SELECT count(*)::int AS total FROM ecert_events e WHERE ${where}`);
        const currentPage = Math.min(page, Math.max(1, Math.ceil(total / pageSize)));
        const items = await this.db.$queryRaw<CertificateEvent[]>(Prisma.sql`SELECT e.id,e.title,e.organizer,e.start_date::text,e.end_date::text,e.archived,e.revision,
          count(r.id)::int AS total,count(r.id) FILTER(WHERE r.status='issued')::int AS issued
          FROM ecert_events e LEFT JOIN ecert_recipients r ON r.event_id=e.id
          WHERE ${where} GROUP BY e.id ORDER BY e.created_at DESC,e.id DESC LIMIT ${pageSize} OFFSET ${(currentPage - 1) * pageSize}`);
        return { items, total, page: currentPage, pageSize };
    }
    async saveEvent(user: ApiUser, body: any, id?: string) {
        assertManager(user);
        const data = validateEvent(body);
        return this.db.$transaction(async db => {
            let eventId = id;
            if (id) {
                const previous = await this.event(user, id, db, true);
                if (body.revision !== previous.revision) throw new CertificateError('Kegiatan telah berubah. Muat ulang sebelum menyimpan.', 409);
                await this.assertTemplateAsset(db, id, data.template.assetId);
                if (data.template.unit === 'pt' && data.template.assetId) {
                    const assets = await db.$queryRaw<any[]>(Prisma.sql`SELECT mime,bytes FROM ecert_assets WHERE id=${data.template.assetId}::uuid AND event_id=${id}::uuid`);
                    assertPageGeometry(data.template, await templateGeometry(assets[0]));
                }
                await db.$executeRaw(Prisma.sql`UPDATE ecert_events SET title=${data.title},organizer=${data.organizer},description=${data.description},
                  location=${data.location},start_date=${data.start_date}::date,end_date=${data.end_date}::date,number_prefix=${data.number_prefix},
                  template=${json(data.template)}::jsonb,archived=${data.archived},revision=revision+1,updated_at=now() WHERE id=${id}::uuid`);
            } else {
                if (data.template.assetId) throw new CertificateError('Buat kegiatan sebelum mengunggah template');
                const rows = await db.$queryRaw<{ id: string }[]>(Prisma.sql`INSERT INTO ecert_events(owner_id,title,organizer,description,location,start_date,end_date,number_prefix,template)
                  VALUES(${user.authId},${data.title},${data.organizer},${data.description},${data.location},${data.start_date}::date,${data.end_date}::date,
                  ${data.number_prefix},${json(data.template)}::jsonb) RETURNING id`);
                eventId = rows[0].id;
            }
            await this.audit(db, eventId!, user, id ? 'event.update' : 'event.create');
            return this.event(user, eventId!, db);
        });
    }
    private async assertTemplateAsset(db: CertificateDb, eventId: string, assetId: string | null) {
        if (!assetId) return;
        const rows = await db.$queryRaw(Prisma.sql`SELECT id FROM ecert_assets WHERE id=${assetId}::uuid AND event_id=${eventId}::uuid AND kind='template'`);
        if (!rows.length) throw new CertificateError('Template bukan milik kegiatan ini');
    }
    async detail(user: ApiUser, id: string) {
        const event = await this.event(user, id);
        const recipients = await this.db.$queryRaw<Recipient[]>(Prisma.sql`SELECT id,name,institution,identities,revision,status,certificate_number,verify_token,issued_at,revoke_reason
          FROM ecert_recipients WHERE event_id=${id}::uuid ORDER BY name,id LIMIT 2000`);
        const assets = await this.db.$queryRaw<Asset[]>(Prisma.sql`SELECT id,kind,filename,mime,is_public FROM ecert_assets WHERE event_id=${id}::uuid ORDER BY created_at DESC`);
        const audit = await this.db.$queryRaw(Prisma.sql`SELECT action,detail,created_at FROM ecert_audit WHERE event_id=${id}::uuid ORDER BY created_at DESC,id DESC LIMIT 30`);
        return { event, recipients, assets, audit };
    }
    async importRecipients(user: ApiUser, id: string, input: unknown) {
        const rows = validateRecipients(input);
        return this.db.$transaction(async db => {
            const event = await this.event(user, id, db, true);
            if (event.archived) throw new CertificateError('Kegiatan sudah diarsipkan');
            const [{ count }] = await db.$queryRaw<{ count: number }[]>(Prisma.sql`SELECT count(*)::int AS count FROM ecert_recipients WHERE event_id=${id}::uuid`);
            const existing = await db.$queryRaw<{ id: string; event_id: string }[]>(Prisma.sql`SELECT id,event_id FROM ecert_recipients WHERE id IN (${Prisma.join(rows.map(row => Prisma.sql`${row.id}::uuid`))})`);
            if (existing.some(row => row.event_id !== id)) throw new CertificateError('ID peserta sudah digunakan', 409);
            if (count + rows.length - existing.length > 2000) throw new CertificateError('Maksimal 2.000 peserta per kegiatan');
            let imported = 0;
            for (const row of rows) {
                // Import IDs are generated once in the import preview. Repeating a
                // failed request is safe, but cannot overwrite an issued identity.
                imported += await db.$executeRaw(Prisma.sql`INSERT INTO ecert_recipients(id,event_id,name,institution,identities)
                  VALUES(${row.id}::uuid,${id}::uuid,${row.name},${row.institution},${json(row.identities)}::jsonb)
                  ON CONFLICT(id) DO NOTHING`);
            }
            if (imported) await this.audit(db, id, user, 'recipients.import', { count: imported });
            return { count: imported };
        });
    }
    async removeDraft(user: ApiUser, eventId: string, recipientId: string) {
        uuid(recipientId);
        return this.db.$transaction(async db => {
            await this.event(user, eventId, db, true);
            const changed = await db.$executeRaw(Prisma.sql`DELETE FROM ecert_recipients WHERE id=${recipientId}::uuid AND event_id=${eventId}::uuid AND status='draft'`);
            if (!changed) throw new CertificateError('Hanya peserta draf yang dapat dihapus', 409);
            await this.audit(db, eventId, user, 'recipient.delete', { recipientId });
        });
    }
    async updateDraft(user: ApiUser, eventId: string, recipientId: string, body: any) {
        if (!Number.isSafeInteger(body?.revision) || body.revision < 1) throw new CertificateError('Muat ulang data peserta sebelum menyimpan.', 409);
        const row = validateRecipients([{ ...body, id: uuid(recipientId) }])[0];
        return this.db.$transaction(async db => {
            await this.event(user, eventId, db, true);
            const changed = await db.$executeRaw(Prisma.sql`UPDATE ecert_recipients SET name=${row.name},institution=${row.institution},identities=${json(row.identities)}::jsonb,revision=revision+1
              WHERE id=${recipientId}::uuid AND event_id=${eventId}::uuid AND status='draft' AND revision=${body.revision}`);
            if (!changed) throw new CertificateError('Data peserta telah berubah atau bukan draf. Muat ulang sebelum menyimpan.', 409);
            await this.audit(db, eventId, user, 'recipient.update', { recipientId });
        });
    }
    async issue(user: ApiUser, id: string, ids: unknown, preflight?: (snapshot: CertificateSnapshot, number: string, asset: any) => Promise<void>) {
        if (!Array.isArray(ids) || !ids.length || ids.length > 100) throw new CertificateError('Pilih 1–100 peserta untuk setiap penerbitan');
        const cleanIds = [...new Set(ids.map(uuid))];
        return this.db.$transaction(async db => {
            const event = await this.event(user, id, db, true);
            if (event.archived || !event.template.assetId) throw new CertificateError('Kegiatan harus aktif dan template sertifikat wajib diunggah');
            if (event.template.unit === 'pt' && (!event.template.signers?.length || event.template.signers.some(signer => !signer.name.trim() || !signer.title.trim())))
                throw new CertificateError('Lengkapi nama dan jabatan penandatangan sebelum menerbitkan');
            await this.assertTemplateAsset(db, id, event.template.assetId);
            const rows = await db.$queryRaw<Recipient[]>(Prisma.sql`SELECT * FROM ecert_recipients WHERE event_id=${id}::uuid AND id IN (${Prisma.join(cleanIds.map(value => Prisma.sql`${value}::uuid`))}) ORDER BY id FOR UPDATE`);
            if (rows.length !== cleanIds.length) throw new CertificateError('Peserta tidak ditemukan pada kegiatan ini');
            const [{ next_number }] = await db.$queryRaw<{ next_number: number }[]>(Prisma.sql`SELECT next_number FROM ecert_events WHERE id=${id}::uuid`);
            let serial = next_number;
            const templateAssets = preflight ? await db.$queryRaw<any[]>(Prisma.sql`SELECT mime,bytes FROM ecert_assets WHERE id=${event.template.assetId}::uuid AND event_id=${id}::uuid`) : [];
            for (const row of rows.filter(item => item.status === 'draft')) {
                const snapshot: CertificateSnapshot & { verification_origin: string } = {
                    event: { title: event.title, organizer: event.organizer, description: event.description, location: event.location,
                        start_date: event.start_date, end_date: event.end_date },
                    name: row.name, institution: row.institution, identities: row.identities, template: event.template, verification_origin: publicOrigin(),
                };
                const number = `${event.number_prefix}/${String(serial++).padStart(4, '0')}`;
                if (preflight) await preflight(snapshot, number, templateAssets[0]);
                await db.$executeRaw(Prisma.sql`UPDATE ecert_recipients SET status='issued',certificate_number=${number},verify_token=${randomBytes(24).toString('hex')},
                  snapshot=${json(snapshot)}::jsonb,issued_at=now() WHERE id=${row.id}::uuid AND status='draft'`);
            }
            await db.$executeRaw(Prisma.sql`UPDATE ecert_events SET next_number=${serial} WHERE id=${id}::uuid`);
            await this.audit(db, id, user, 'certificates.issue', { count: serial - next_number });
            return { count: serial - next_number };
        });
    }
    async revoke(user: ApiUser, eventId: string, recipientId: string, reason: unknown) {
        uuid(recipientId); const cleanReason = text(reason, 'Alasan pencabutan', 500);
        return this.db.$transaction(async db => {
            await this.event(user, eventId, db, true);
            const count = await db.$executeRaw(Prisma.sql`UPDATE ecert_recipients SET status='revoked',revoked_at=now(),revoke_reason=${cleanReason}
              WHERE id=${recipientId}::uuid AND event_id=${eventId}::uuid AND status='issued'`);
            if (!count) throw new CertificateError('Sertifikat tidak berstatus terbit', 409);
            await this.audit(db, eventId, user, 'certificate.revoke', { recipientId, reason: cleanReason });
        });
    }
    async verification(token: string) {
        if (!/^[a-f\d]{48}$/.test(token)) throw new CertificateError('Sertifikat tidak ditemukan', 404);
        const rows = await this.db.$queryRaw<any[]>(Prisma.sql`SELECT event_id,status,certificate_number,snapshot,issued_at,revoked_at,revoke_reason FROM ecert_recipients WHERE verify_token=${token}`);
        const row = rows[0];
        if (!row) throw new CertificateError('Sertifikat tidak ditemukan', 404);
        if (row.status === 'revoked') return { status: row.status, certificate_number: row.certificate_number, revoked_at: row.revoked_at, revoke_reason: row.revoke_reason, assets: [] };
        const assets = await this.db.$queryRaw<Asset[]>(Prisma.sql`SELECT id,kind,filename,mime FROM ecert_assets WHERE event_id=${row.event_id}::uuid AND is_public=true AND kind<>'template' ORDER BY created_at DESC`);
        // No account identity, private fields, full template, or asset bytes in public DTO.
        return { status: row.status, certificate_number: row.certificate_number, name: row.snapshot.name,
            institution: row.snapshot.institution, event: row.snapshot.event, issued_at: row.issued_at, assets,
            signers: (row.snapshot.template.signers || []).map((signer: any) => ({ name: signer.name, title: signer.title })) };
    }
    async certificate(user: ApiUser, eventId: string, recipientId: string) {
        await this.event(user, eventId); uuid(recipientId);
        const rows = await this.db.$queryRaw<any[]>(Prisma.sql`SELECT * FROM ecert_recipients WHERE id=${recipientId}::uuid AND event_id=${eventId}::uuid AND status='issued'`);
        if (!rows[0]) throw new CertificateError('Sertifikat terbit tidak ditemukan', 404);
        return rows[0];
    }
    async asset(user: ApiUser | null, eventId: string | null, assetId: string, token?: string) {
        uuid(assetId);
        if (token) {
            if (!/^[a-f\d]{48}$/.test(token)) throw new CertificateError('Berkas tidak ditemukan', 404);
            const rows = await this.db.$queryRaw<any[]>(Prisma.sql`SELECT a.* FROM ecert_assets a JOIN ecert_recipients r ON r.event_id=a.event_id
              WHERE a.id=${assetId}::uuid AND a.is_public=true AND a.kind<>'template' AND r.verify_token=${token} AND r.status='issued'`);
            if (!rows[0]) throw new CertificateError('Berkas tidak ditemukan', 404);
            return rows[0];
        }
        assertManager(user); await this.event(user, uuid(eventId));
        const rows = await this.db.$queryRaw<any[]>(Prisma.sql`SELECT * FROM ecert_assets WHERE id=${assetId}::uuid AND event_id=${eventId}::uuid`);
        if (!rows[0]) throw new CertificateError('Berkas tidak ditemukan', 404);
        return rows[0];
    }
    async addAsset(user: ApiUser, eventId: string, data: { kind: string; filename: string; mime: string; bytes: Buffer }) {
        if (!['template', 'documentation', 'correspondence'].includes(data.kind)) throw new CertificateError('Kategori berkas tidak valid');
        return this.db.$transaction(async db => {
            await this.event(user, eventId, db, true);
            const [{ count }] = await db.$queryRaw<{ count: number }[]>(Prisma.sql`SELECT count(*)::int AS count FROM ecert_assets WHERE event_id=${eventId}::uuid`);
            if (count >= 20) throw new CertificateError('Maksimal 20 berkas per kegiatan');
            const rows = await db.$queryRaw<{ id: string }[]>(Prisma.sql`INSERT INTO ecert_assets(event_id,kind,filename,mime,bytes)
              VALUES(${eventId}::uuid,${data.kind},${data.filename},${data.mime},${data.bytes}) RETURNING id`);
            await this.audit(db, eventId, user, 'asset.upload', { id: rows[0].id, kind: data.kind });
            return rows[0];
        });
    }
    async visibility(user: ApiUser, eventId: string, assetId: string, isPublic: unknown) {
        uuid(assetId);
        if (typeof isPublic !== 'boolean') throw new CertificateError('Visibilitas berkas tidak valid');
        return this.db.$transaction(async db => {
            await this.event(user, eventId, db, true);
            const count = await db.$executeRaw(Prisma.sql`UPDATE ecert_assets SET is_public=${isPublic} WHERE id=${assetId}::uuid AND event_id=${eventId}::uuid AND kind<>'template'`);
            if (!count) throw new CertificateError('Dokumen tidak ditemukan', 404);
            await this.audit(db, eventId, user, 'asset.visibility', { assetId, public: isPublic });
        });
    }
    async removeAsset(user: ApiUser, eventId: string, assetId: string) {
        uuid(assetId);
        return this.db.$transaction(async db => {
            const event = await this.event(user, eventId, db, true);
            if (event.template.assetId === assetId) throw new CertificateError('Ganti template aktif sebelum menghapusnya', 409);
            const used = await db.$queryRaw<any[]>(Prisma.sql`SELECT id FROM ecert_recipients WHERE event_id=${eventId}::uuid AND snapshot->'template'->>'assetId'=${assetId} LIMIT 1`);
            if (used.length) throw new CertificateError('Template telah digunakan sertifikat terbit dan harus dipertahankan', 409);
            const changed = await db.$executeRaw(Prisma.sql`DELETE FROM ecert_assets WHERE id=${assetId}::uuid AND event_id=${eventId}::uuid`);
            if (!changed) throw new CertificateError('Berkas tidak ditemukan', 404);
            await this.audit(db, eventId, user, 'asset.delete', { assetId });
        });
    }
}
