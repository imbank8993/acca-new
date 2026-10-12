import { Injectable, NotFoundException, ForbiddenException, BadRequestException, ConflictException } from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { allocate, computeScores } from './form-allocation';
import { formAnswer, formLabelKey, validateFormAnswers, safeFormPattern, STRUCTURAL_FORM_TYPES } from './form-values';
const TYPES = [...STRUCTURAL_FORM_TYPES, 'text', 'textarea', 'number', 'email', 'phone', 'url', 'date', 'time', 'datetime', 'select', 'radio', 'checkbox', 'rating', 'slider', 'file'];
const roles = (user: any): string[] => [...(user?.roles || []), ...String(user?.role || '').split(/[,|]/)].map(r => String(r).trim().toUpperCase());
const isAdmin = (user: any) => roles(user).some(r => ['ADMIN', 'ADMINISTRATOR'].includes(r));
const identifiers = (user: any): string[] => [...new Set([user?.auth_id, user?.authId, user?.id != null ? String(user.id) : null].filter(Boolean))] as string[];
const identity = (user: any) => identifiers(user)[0];
const publicForm = (form: any) => form.is_public === true || form.schema?.is_public === true || form.schema?.is_link_public === true;
const pageValue = (v: any, fallback: number, max: number) => { const n = Number(v ?? fallback); if (!Number.isSafeInteger(n) || n < 1 || n > max)
    throw new BadRequestException('Parameter halaman tidak valid'); return n; };
function requiredText(v: any, label: string, max = 255): string { if (typeof v !== 'string' || !v.trim() || v.length > max)
    throw new BadRequestException(`${label} tidak valid`); return v.trim(); }
function guestIdentity(session: any): string | null {
    if (typeof session !== 'string' || session.split('.').length !== 2)
        return null;
    const [id, signature] = session.split('.'), secret = process.env.INTERNAL_API_KEY;
    if (!secret || !/^\d{13}_[a-f0-9-]{36}$/.test(id || '') || !signature)
        return null;
    const issued = Number(id.split('_')[0]);
    if (Date.now() - issued > 86400000 || issued > Date.now() + 60000)
        return null;
    const expected = createHmac('sha256', secret).update(id).digest('hex');
    return signature.length === expected.length && timingSafeEqual(Buffer.from(signature), Buffer.from(expected)) ? `guest:${id}` : null;
}
@Injectable()
export class FormsService {
    constructor(private readonly prisma: PrismaService) { }
    private manager(user: any) { if (!user?.id || !roles(user).some(r => ['ADMIN', 'ADMINISTRATOR', 'OP_FORM', 'PENGURUS_KELAS'].includes(r)))
        throw new ForbiddenException('Hanya pengelola Form yang boleh melakukan tindakan ini'); }
    private canManage(form: any, user: any) { return !!user?.id && roles(user).some(r => ['ADMIN', 'ADMINISTRATOR', 'OP_FORM', 'PENGURUS_KELAS'].includes(r)) && (isAdmin(user) || identifiers(user).includes(form.created_by)); }
    private async form(id: string, db: any = this.prisma) {
        requiredText(id, 'ID atau slug', 100);
        const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
        const form = uuid ? await db.custom_forms.findUnique({ where: { id } }) : await db.custom_forms.findFirst({ where: { OR: [{ slug: id }, { schema: { path: ['slug'], equals: id } }] } });
        if (!form)
            throw new NotFoundException('Formulir tidak ditemukan');
        return form;
    }
    private async managed(id: string, user: any, db: any = this.prisma) { this.manager(user); const form = await this.form(id, db); if (!this.canManage(form, user))
        throw new ForbiddenException('Formulir bukan milik Anda'); return form; }
    private respondent(form: any, user: any) { if (!publicForm(form) && !user?.id)
        throw new ForbiddenException('Form privat memerlukan sesi login ACCA'); }
    private publicSchema(form: any) { const fields = (form.schema?.fields || []).map((f: any) => { const { enableScoring, scoreCategory, ...rest } = f; return { ...rest, options: f.options?.map((o: any) => ({ label: o.label, value: o.value })) }; }); return { id: form.id, title: form.title, slug: form.slug, is_public: publicForm(form), schema: { display: 'form', description: form.schema?.description, is_active: form.schema?.is_active, is_public: publicForm(form), allow_multiple_responses: form.schema?.allow_multiple_responses, fields } }; }
    private schema(value: any) {
        if (!value || typeof value !== 'object' || Array.isArray(value) || Buffer.byteLength(JSON.stringify(value)) > 250000 || !Array.isArray(value.fields) || !value.fields.length || value.fields.length > 100)
            throw new BadRequestException('Schema form harus memiliki 1–100 komponen, maksimal 250 KB');
        const fields = value.fields, ids = new Set<string>();
        for (const f of fields) {
            if (!f || !TYPES.includes(f.type) || typeof f.id !== 'string' || !/^[\w-]{1,80}$/.test(f.id) || ['__proto__', 'constructor', 'prototype'].includes(f.id) || ids.has(f.id))
                throw new BadRequestException('Tipe atau ID komponen tidak valid/duplikat');
            ids.add(f.id);
            requiredText(f.label, 'Label komponen');
            for (const key of ['required', 'enableScoring', 'multiple'])
                if (f[key] !== undefined && typeof f[key] !== 'boolean')
                    throw new BadRequestException(`${key} harus boolean`);
            if (f.width && !['full', 'half', 'third'].includes(f.width))
                throw new BadRequestException('Lebar komponen tidak valid');
            for (const key of ['min','max']) if (f[key] != null && !['string','number'].includes(typeof f[key])) throw new BadRequestException('Batas komponen harus angka atau teks tanggal');
            if (f.scoreCategory) requiredText(f.scoreCategory,'Kategori skor',100);
            if (f.pattern != null && typeof f.pattern !== 'string')
                throw new BadRequestException('Pola harus berupa teks');
            if (f.options != null && !Array.isArray(f.options))
                throw new BadRequestException('Pilihan harus berupa daftar');
            for (const key of ['defaultValue', 'accept', 'description', 'content', 'placeholder', 'scoreCategory'])
                if (f[key] != null && typeof f[key] !== 'string')
                    throw new BadRequestException(`${key} harus berupa teks`);
            if (f.pattern && !safeFormPattern(f.pattern))
                throw new BadRequestException('Pola validasi terlalu kompleks atau tidak valid. Gunakan pola sederhana tanpa grup/alternatif');
            for (const key of ['minLength', 'maxLength', 'minSelected', 'maxSelected', 'maxRating', 'maxSize', 'step'])
                if (f[key] != null && (!Number.isFinite(f[key]) || f[key] < 0))
                    throw new BadRequestException(`${key} tidak valid`);
            if ((f.maxSize != null && f.maxSize <= 0) || (f.maxRating != null && (!Number.isInteger(f.maxRating) || f.maxRating < 1)) || (f.step != null && f.step <= 0))
                throw new BadRequestException('Batas ukuran, rating, atau interval harus positif');
            if (f.maxSize > 10 || f.maxRating > 20 || f.maxLength > 10000 || f.minLength > 10000 || f.maxSelected > 500)
                throw new BadRequestException('Batas komponen terlalu besar');
            if ((f.minLength ?? 0) > (f.maxLength ?? 10000) || (f.minSelected ?? 0) > (f.maxSelected ?? 500))
                throw new BadRequestException('Batas minimum melebihi maksimum');
            if (['number', 'slider'].includes(f.type)) {
                for (const key of ['min', 'max'])
                    if (f[key] != null && f[key] !== '' && !Number.isFinite(Number(f[key])))
                        throw new BadRequestException('Batas angka tidak valid');
                if (f.min != null && f.max != null && Number(f.min) > Number(f.max))
                    throw new BadRequestException('Rentang angka tidak valid');
            }
            if (['select', 'radio', 'checkbox'].includes(f.type) && (!Array.isArray(f.options) || f.options.length > 3000))
                throw new BadRequestException('Pilihan komponen tidak valid');
            if (f.options) {
                const values = new Set<string>();
                for (const o of f.options) {
                    requiredText(o.label, 'Label pilihan', 1000);
                    requiredText(o.value, 'Nilai pilihan', 1000);
                    if (values.has(o.value) || o.score != null && (!Number.isSafeInteger(o.score) || Math.abs(o.score) > 10000))
                        throw new BadRequestException('Nilai pilihan duplikat atau skor tidak valid');
                    values.add(o.value);
                }
            }
            if (f.autoFillUser && !['name', 'email', 'nip_nis', 'none'].includes(f.autoFillUser))
                throw new BadRequestException('Isi otomatis tidak valid');
        }
        const scoreBudget = fields.reduce((sum: number, f: any) => sum + (f.options || []).reduce((n: number, o: any) => n + Math.abs(o.score || 0), 0), 0);
        if (scoreBudget > 1000000000)
            throw new BadRequestException('Total bobot skor terlalu besar');
        const earlier = new Set<string>();
        for (const f of fields) {
            if (f.conditions) {
                if (!Array.isArray(f.conditions) || f.conditions.length > 20 || f.conditions.some((c: any) => !earlier.has(c.targetFieldId) || !['equals', 'not_equals', 'contains', 'is_not_empty', 'is_empty'].includes(c.operator)))
                    throw new BadRequestException('Kondisi harus mengacu pada pertanyaan sebelumnya');
            }
            if (f.excludeChosenFrom && (!Array.isArray(f.excludeChosenFrom) || f.excludeChosenFrom.some((id: string) => !ids.has(id) || id === f.id)))
                throw new BadRequestException('Sumber pilihan tidak valid');
            earlier.add(f.id);
        }
        for (const key of ['is_active', 'is_public', 'is_link_public', 'allow_multiple_responses', 'show_in_academic_navbar'])
            if (value[key] !== undefined && typeof value[key] !== 'boolean')
                throw new BadRequestException(`${key} harus boolean`);
        if (value.slug && !/^[a-zA-Z0-9_-]{1,100}$/.test(value.slug))
            throw new BadRequestException('Slug tidak valid');
        if (value.allocation && value.allocation.enabled !== false)
            this.allocationConfig(fields, value.allocation);
        return value;
    }
    private async locked(id: string, work: (tx: any) => Promise<any>) { const canonical = await this.form(id); return this.prisma.$transaction(async (tx) => { await tx.$executeRaw `SELECT pg_advisory_xact_lock(hashtext(${`forms:${canonical.id}`}))`; return work(tx); }, { maxWait: 10000, timeout: 30000 }); }
    async getForms(user: any, query: any = {}) {
        this.manager(user);
        const page = pageValue(query.page, 1, 10000), limit = pageValue(query.limit, 100, 500);
        const where = isAdmin(user) ? {} : { created_by: { in: identifiers(user) } };
        const forms = await this.prisma.custom_forms.findMany({ where, include: { _count: { select: { custom_form_responses: true } } }, orderBy: [{ created_at: 'desc' }, { id: 'asc' }], skip: (page - 1) * limit, take: limit + 1 });
        return { forms: forms.slice(0, limit).map(f => ({ ...f, can_manage: true, custom_form_responses: [{ count: f._count.custom_form_responses }] })), has_more: forms.length > limit, page };
    }
    async getFormById(id: string, user?: any) { const form = await this.form(id); this.respondent(form, user); return { form: this.publicSchema(form), can_manage: false }; }
    async getManagementFormById(id: string, user: any) { return { form: await this.managed(id, user), can_manage: true }; }
    async createForm(body: any, user: any) {
        this.manager(user);
        const schema = this.schema(body?.schema);
        if (body.is_public !== undefined && typeof body.is_public !== 'boolean')
            throw new BadRequestException('Akses publik harus boolean');
        return { form: await this.prisma.custom_forms.create({ data: { title: requiredText(body.title, 'Judul'), slug: schema.slug || null, schema: { ...schema, is_public: body.is_public ?? false }, is_public: body.is_public ?? false, created_by: identity(user) } }) };
    }
    async updateForm(id: string, body: any, user: any) {
        this.manager(user);
        if (!body || typeof body !== 'object' || Array.isArray(body))
            throw new BadRequestException('Data form tidak valid');
        return this.locked(id, async (tx) => {
            const form = await this.managed(id, user, tx);
            if (body?.expected_updated_at !== (form.updated_at?.toISOString() ?? null))
                throw new ConflictException('Form telah berubah. Muat ulang sebelum menyimpan');
            const schema = this.schema({ ...form.schema, ...body.schema, ...(body.is_public !== undefined ? { is_public: body.is_public } : {}), ...(body.show_in_academic_navbar !== undefined ? { show_in_academic_navbar: body.show_in_academic_navbar } : {}) });
            const row = await tx.custom_forms.update({ where: { id: form.id }, data: { title: body.title !== undefined ? requiredText(body.title, 'Judul') : form.title, schema, slug: schema.slug || null, is_public: schema.is_public ?? form.is_public, updated_at: new Date(Math.max(Date.now(), (form.updated_at?.getTime() || 0) + 1)) } });
            return { form: row };
        });
    }
    async deleteForm(id: string, user: any) { return this.locked(id, async (tx) => { const form = await this.managed(id, user, tx); await tx.custom_form_responses.deleteMany({ where: { form_id: form.id } }); await tx.custom_forms.delete({ where: { id: form.id } }); return { message: 'Form berhasil dihapus' }; }); }
    async getResponses(id: string, query: any, user: any) {
        const form = await this.managed(id, user), fields = form.schema?.fields || [], page = pageValue(query?.page, 1, 10000), limit = pageValue(query?.limit, 200, 500);
        const rows = await this.prisma.custom_form_responses.findMany({ where: { form_id: form.id }, orderBy: [{ created_at: 'desc' }, { id: 'asc' }], skip: (page - 1) * limit, take: limit + 1 });
        return { form: { ...form, can_manage: true, schema: { ...form.schema, fields: fields.map((f: any) => ({ ...f, label: formLabelKey(fields, f) })) } }, responses: rows.slice(0, limit).map((r: any) => ({ ...r, data: { ...r.data, ...Object.fromEntries(fields.filter((f: any) => !STRUCTURAL_FORM_TYPES.includes(f.type)).map((f: any) => [formLabelKey(fields, f), formAnswer(fields, f, r.data)])) } })), has_more: rows.length > limit, page };
    }
    async deleteResponses(id: string, ids: string[], user: any) { if (!Array.isArray(ids) || !ids.length || ids.length > 500 || ids.some(i => !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(i)))
        throw new BadRequestException('ID tanggapan tidak valid'); return this.locked(id, async (tx) => { const form = await this.managed(id, user, tx); const result = await tx.custom_form_responses.deleteMany({ where: { form_id: form.id, id: { in: ids } } }); return { success: true, count: result.count }; }); }
    async getPublicForms() {
        const rows = await this.prisma.custom_forms.findMany({ where: { OR: [{ is_public: true }, { schema: { path: ['is_public'], equals: true } }, { schema: { path: ['is_link_public'], equals: true } }] }, orderBy: { created_at: 'desc' }, take: 500 });
        return { ok: true, forms: rows.filter((f: any) => publicForm(f) && f.schema?.is_active !== false && (f.schema?.show_in_academic_navbar === true || (f.schema?.show_in_academic_navbar !== false && !f.schema?.is_pengurus_form && (f.is_public || f.schema?.is_public)))).map((f: any) => ({ id: f.id, title: f.title, slug: f.slug, is_public: true, schema: { slug: f.slug, description: f.schema?.description, show_in_academic_navbar: true } })) };
    }
    async getDynamicOptions(source: string, user: any) {
        this.manager(user);
        let options: any[] = [];
        if (source === 'guru') {
            const rows = await this.prisma.master_guru.findMany({ where: { aktif: true }, select: { nip: true, nama_lengkap: true }, orderBy: { nama_lengkap: 'asc' }, take: 3000 });
            options = rows.map(g => ({ label: g.nama_lengkap, value: g.nama_lengkap }));
        }
        else if (source === 'students') {
            const rows = await this.prisma.master_siswa.findMany({ where: { aktif: true }, select: { nama_lengkap: true }, orderBy: { nama_lengkap: 'asc' }, take: 3000 });
            options = rows.map(s => ({ label: s.nama_lengkap, value: s.nama_lengkap }));
        }
        else if (['kelas', 'classes', 'mapel'].includes(source)) {
            const rows = source === 'mapel' ? await this.prisma.master_mapel.findMany({ where: { aktif: true }, select: { nama: true }, orderBy: { nama: 'asc' }, take: 1000 }) : await this.prisma.master_kelas.findMany({ where: { aktif: true }, select: { nama: true }, orderBy: { nama: 'asc' }, take: 1000 });
            options = rows.map(r => ({ label: r.nama, value: r.nama }));
        }
        else
            throw new BadRequestException('Sumber pilihan tidak dikenal');
        return { ok: true, options };
    }
    async uploadAccess(id: string, fieldId: string, user: any) { const form = await this.form(id); this.respondent(form, user); if (form.schema?.is_active === false)
        throw new ForbiddenException('Form ditutup'); const field = form.schema?.fields?.find((f: any) => f.id === fieldId && f.type === 'file'); if (!field)
        throw new BadRequestException('Komponen unggahan tidak ditemukan'); return { form_id: form.id, field: { id: field.id, maxSize: Number.isFinite(field.maxSize) && field.maxSize > 0 ? Math.min(field.maxSize, 10) : 5, accept: field.accept || '', multiple: !!field.multiple }, owner: user ? identity(user) : null }; }
    async submitResponse(body: any, user?: any) {
        const form = await this.form(body?.form_id);
        this.respondent(form, user);
        return this.locked(form.id, async (tx) => {
            const current = await this.form(form.id, tx);
            this.respondent(current, user);
            if (current.schema?.is_active === false)
                throw new ForbiddenException('Pengisian formulir ditutup');
            const multiple = current.schema?.allow_multiple_responses ?? publicForm(current);
            const guest = guestIdentity(body?.upload_session);
            const userId = user ? identity(user) : guest;
            if (!multiple && !user?.id)
                throw new ForbiddenException('Form ini membatasi satu tanggapan. Login untuk mengirim jawaban');
            if (!multiple) {
                const aliases = user ? identifiers(user) : [userId];
                const existing = await tx.custom_form_responses.findFirst({ where: { form_id: current.id, user_id: { in: aliases } } });
                if (existing)
                    throw new ConflictException('Anda sudah pernah mengisi formulir ini');
            }
            if (!body?.data || Buffer.byteLength(JSON.stringify(body.data)) > 250000)
                throw new BadRequestException('Jawaban tidak valid atau terlalu besar');
            const fields = current.schema?.fields || [], result = validateFormAnswers(fields, body.data);
            if (result.errors.length)
                throw new BadRequestException(result.errors[0]);
            for (const f of fields.filter((f: any) => f.type === 'file'))
                for (const file of result.data[f.id] || []) {
                    const registry = await tx.file_uploads.findUnique({ where: { file_url: file.url } });
                    const owner = user ? identity(user) : guest;
                    if (!owner || !registry || registry.folder !== `owner:${owner}:forms/${current.id}/${f.id}`)
                        throw new ForbiddenException('Lampiran bukan unggahan untuk komponen form ini');
                    if (Number(registry.size_bytes) > Math.min(f.maxSize || 5, 10) * 1048576)
                        throw new BadRequestException('Ukuran lampiran melebihi batas');
                    file.name = registry.file_name;
                }
            const scores = computeScores(fields, result.data);
            const row = await tx.custom_form_responses.create({ data: { form_id: current.id, user_id: userId || null, data: result.data, total_score: scores.total, category_scores: scores.categories } });
            return { response: { id: row.id, created_at: row.created_at } };
        });
    }
    private allocationConfig(fields: any[], config: any) { if (!config || !Array.isArray(config.choiceFields) || !config.choiceFields.length || config.choiceFields.length > 2 || config.choiceFields.some((c: any) => !fields.some(f => f.id === c.id && ['select', 'radio'].includes(f.type))) || new Set(config.choiceFields.map((c: any) => c.id)).size !== config.choiceFields.length || !config.quotas || typeof config.quotas !== 'object' || Array.isArray(config.quotas) || Object.values(config.quotas).some(v => !Number.isSafeInteger(v) || Number(v) < 0 || Number(v) > 100000) || !Array.isArray(config.rankBy) || config.rankBy.some((v: any) => typeof v !== 'string'))
        throw new BadRequestException('Pengaturan seleksi tidak valid'); return config; }
    async allocate(id: string, body: any, user: any) { return this.locked(id, async (tx) => { const form = await this.managed(id, user, tx), fields = form.schema?.fields || [], config = this.allocationConfig(fields, body?.config || form.schema?.allocation); const rows = await tx.custom_form_responses.findMany({ where: { form_id: form.id }, orderBy: { created_at: 'asc' }, take: 10001 }); if (rows.length > 10000)
        throw new BadRequestException('Seleksi maksimal 10.000 tanggapan per proses'); const outcome = allocate(fields, config, rows.map((r: any) => ({ id: r.id, created_at: r.created_at || new Date(), data: r.data }))); if (body?.persist === true)
        for (const r of outcome.results)
            await tx.custom_form_responses.update({ where: { id: r.id }, data: { placement_option: r.option, placement_stage: r.stage, placement_rank: r.rank, placed_at: new Date(), total_score: r.scores.total, category_scores: r.scores.categories } }); return outcome; }); }
    async recalculateScores(id: string, user: any) { return this.locked(id, async (tx) => { const form = await this.managed(id, user, tx), rows = await tx.custom_form_responses.findMany({ where: { form_id: form.id }, take: 10001 }); if (rows.length > 10000)
        throw new BadRequestException('Perhitungan maksimal 10.000 tanggapan'); for (const r of rows) {
        const scores = computeScores(form.schema?.fields || [], r.data);
        await tx.custom_form_responses.update({ where: { id: r.id }, data: { total_score: scores.total, category_scores: scores.categories } });
    } return { updated: rows.length, total: rows.length }; }); }
    async getPengembanganDiriSurvey(kelas?: string, page = 1, limit = 50) {
        const from = (page - 1) * limit;
        const where: any = { deleted_at: null };
        if (kelas)
            where.kelas_nama = kelas;
        const [data, count] = await Promise.all([
            this.prisma.pengembangan_diri_responses.findMany({
                where,
                orderBy: { submitted_at: 'desc' },
                skip: from,
                take: limit,
            }),
            this.prisma.pengembangan_diri_responses.count({ where }),
        ]);
        return {
            ok: true,
            data,
            meta: {
                total: count,
                page,
                limit,
                totalPages: count ? Math.ceil(count / limit) : 0,
            },
        };
    }
    async deletePengembanganDiriSurvey(id: string) {
        if (!id)
            throw new BadRequestException('ID required');
        await this.prisma.pengembangan_diri_responses.update({
            where: { id: parseInt(id, 10) },
            data: { deleted_at: new Date() },
        });
        return { ok: true };
    }
    async submitPengembanganDiriSurvey(body: any, reqHeaders: any) {
        if (!body.kelas_nama) {
            throw new BadRequestException('Kelas wajib dipilih');
        }
        const insertData: any = {
            kelas_id: body.kelas_id || null,
            kelas_nama: body.kelas_nama,
            tingkat: body.tingkat || null,
            ketertarikan: body.ketertarikan || null,
            bidang_minati: body.bidang_minati || null,
            bidang_minati_lainnya: body.bidang_minati_lainnya || null,
            keterampilan: body.keterampilan || [],
            waktu_pelaksanaan: body.waktu_pelaksanaan || null,
            durasi_ideal: body.durasi_ideal ? parseInt(body.durasi_ideal) : null,
            kendala: body.kendala || [],
            kesediaan_rutin: body.kesediaan_rutin || null,
            ip_address: reqHeaders['x-forwarded-for'] || reqHeaders['x-real-ip'] || null,
            user_agent: reqHeaders['user-agent'] || null,
        };
        const data = await this.prisma.pengembangan_diri_responses.create({
            data: insertData,
        });
        return { ok: true, data, message: 'Response submitted successfully' };
    }
}
