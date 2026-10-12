import { Injectable, BadRequestException, NotFoundException, ForbiddenException, ConflictException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
export interface TugasSiswaFilter {
    page?: number;
    limit?: number;
    kelas?: string;
    guru?: string;
    mapel?: string;
    search?: string;
    tanggalAwal?: string;
    tanggalAkhir?: string;
    siswaRole?: string;
    siswaKelas?: string;
    jenis?: string;
    tahunAjaran?: string;
    userId?: string;
}
const rolesOf = (user: any): string[] => [...(user?.roles || []), ...String(user?.role || '').split(/[,|]/)].map(r => String(r).trim().toUpperCase());
const admin = (user: any) => rolesOf(user).some(r => ['ADMIN', 'ADMINISTRATOR'].includes(r));
const staff = (user: any) => admin(user) || rolesOf(user).includes('GURU');
const pupil = (user: any) => rolesOf(user).some(r => ['SISWA', 'PENGURUS_KELAS'].includes(r));
function integer(value: any, field: string, max = Number.MAX_SAFE_INTEGER): number {
    if (!/^\d+$/.test(String(value)) || !Number.isSafeInteger(Number(value)) || Number(value) < 1 || Number(value) > max)
        throw new BadRequestException(`${field} tidak valid`);
    return Number(value);
}
function text(value: any, field: string, max = 255): string {
    if (typeof value !== 'string' || !value.trim() || value.trim().length > max)
        throw new BadRequestException(`${field} tidak valid`);
    return value.trim();
}
function date(value: any): Date {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}(?:T00:00:00(?:\.000)?Z)?$/.test(value))
        throw new BadRequestException('Tanggal tidak valid');
    const d = new Date(value.slice(0, 10) + 'T00:00:00Z');
    if (!Number.isFinite(d.getTime()) || d.toISOString().slice(0, 10) !== value.slice(0, 10))
        throw new BadRequestException('Tanggal tidak valid');
    return d;
}
function schoolDay(): string { return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Makassar', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date()); }
function yearOf(d: Date): string { const y = d.getUTCFullYear(), start = d.getUTCMonth() >= 6 ? y : y - 1; return `${start}/${start + 1}`; }
function classWhere(name: string): any { return { OR: [{ kelas: name }, { kelas_list: { array_contains: [name] } }] }; }
function json(value: any): any {
    if (value == null)
        return value;
    if (value instanceof Date)
        return value.toISOString();
    if (typeof value === 'bigint')
        return value.toString();
    if (Array.isArray(value))
        return value.map(json);
    if (typeof value === 'object')
        return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, json(v)]));
    return value;
}
@Injectable()
export class TugasSiswaService {
    constructor(private readonly prisma: PrismaService) { }
    private reader(user: any) {
        if (!user?.id || (!staff(user) && !pupil(user)))
            throw new ForbiddenException('Anda tidak memiliki peran Tugas Siswa');
        if (!staff(user) && !user.nip)
            throw new ForbiddenException('Identitas siswa diperlukan');
    }
    private owner(row: any, user: any) {
        const own = String(row.created_by || '') === String(user.id) || (!row.created_by && user.nip && [row.created_by_nip, row.nisn_pembuat].includes(user.nip));
        if (!admin(user) && !own)
            throw new ForbiddenException('Hanya penginput yang dapat mengubah tugas');
    }
    private async writer(user: any, data?: any, db: any = this.prisma) {
        this.reader(user);
        if (staff(user))
            return;
        const where: any = { nisn: user.nip, aktif: true, is_pengurus: true };
        if (data)
            where.tahun_ajaran = data.tahun_ajaran;
        else {
            const years = await db.master_tahun_ajaran.findMany({ where: { is_active: true }, select: { tahun_ajaran: true } });
            where.tahun_ajaran = { in: years.length ? years.map((y: any) => y.tahun_ajaran) : [yearOf(new Date(schoolDay() + 'T00:00:00Z'))] };
        }
        const enrollment = await db.siswa_kelas.findMany({ where, select: { kelas: true } });
        if (!enrollment.length || (data && (!data.kelas_list.length || data.kelas_list.some((k: string) => !enrollment.some((e: any) => e.kelas === k)))))
            throw new ForbiddenException('Hanya pengurus kelas dan tahun terkait yang dapat mengelola tugas');
    }
    async uploadAccess(user: any) { await this.writer(user); return { ok: true }; }
    private async scope(user: any, db: any = this.prisma): Promise<any> {
        this.reader(user);
        if (staff(user))
            return {};
        const enrollment = await db.siswa_kelas.findMany({ where: { nisn: user.nip, aktif: true }, select: { kelas: true, tahun_ajaran: true } });
        const clauses = enrollment.map((e: { kelas: string; tahun_ajaran: string }) => ({ AND: [{ tahun_ajaran: e.tahun_ajaran }, classWhere(e.kelas), { OR: [{ target_siswa: { equals: Prisma.DbNull } }, { target_siswa: { equals: Prisma.JsonNull } }, { target_siswa: { equals: {} } }, { target_siswa: { path: [e.kelas], array_contains: [user.nip] } }] }] }));
        return clauses.length ? { OR: clauses } : { id: BigInt(-1) };
    }
    private async where(filter: TugasSiswaFilter, user: any) {
        const clauses: any[] = [await this.scope(user)];
        if (filter.kelas)
            clauses.push(classWhere(text(filter.kelas, 'Kelas')));
        if (filter.jenis) {
            if (!['tugas', 'pengingat'].includes(filter.jenis))
                throw new BadRequestException('Jenis tidak valid');
            clauses.push({ jenis: filter.jenis });
        }
        if (filter.tahunAjaran) {
            const years = text(filter.tahunAjaran, 'Tahun ajaran', 255).split(',').map(s => s.trim());
            if (years.some(y => !/^\d{4}\/\d{4}$/.test(y)))
                throw new BadRequestException('Tahun ajaran tidak valid');
            clauses.push({ tahun_ajaran: { in: years } });
        }
        if (filter.guru) {
            const g = text(filter.guru, 'Guru');
            clauses.push({ OR: [{ nama_guru: { contains: g, mode: 'insensitive' } }, { guru_id: g }, { created_by_nip: g }] });
        }
        if (filter.mapel)
            clauses.push({ nama_mapel: { contains: text(filter.mapel, 'Mapel'), mode: 'insensitive' } });
        if (filter.search) {
            const s = text(filter.search, 'Pencarian');
            clauses.push({ OR: ['judul_tugas', 'deskripsi', 'nama_mapel', 'nama_guru'].map(k => ({ [k]: { contains: s, mode: 'insensitive' } })) });
        }
        if (filter.tanggalAwal)
            clauses.push({ tanggal_mulai: { gte: date(filter.tanggalAwal) } });
        if (filter.tanggalAkhir)
            clauses.push({ tanggal_mulai: { lte: date(filter.tanggalAkhir) } });
        if (filter.tanggalAwal && filter.tanggalAkhir && date(filter.tanggalAwal) > date(filter.tanggalAkhir))
            throw new BadRequestException('Rentang filter tanggal tidak valid');
        return { AND: clauses };
    }
    private output(row: any, user?: any) {
        const checklist = row.tugas_siswa_checklist || [];
        const target = user && !staff(user) && String(row.created_by) !== String(user.id) && row.target_siswa ? Object.fromEntries(Object.entries(row.target_siswa).filter(([, ids]) => Array.isArray(ids) && ids.includes(user.nip)).map(([kelas]) => [kelas, [user.nip]])) : row.target_siswa;
        return json({ ...row, target_siswa: target, id: Number(row.id), file_size: row.file_size != null ? Number(row.file_size) : null, checklist, is_done: checklist.some((c: any) => c.is_done), tanggal_mulai: row.tanggal_mulai?.toISOString().slice(0, 10) || null, tanggal_selesai: row.tanggal_selesai?.toISOString().slice(0, 10) || null });
    }
    async findAll(filter: TugasSiswaFilter = {}, user?: any) {
        const page = integer(filter.page ?? 1, 'Halaman', 10000), limit = integer(filter.limit ?? 20, 'Batas', 100), where = await this.where(filter, user);
        const [total, rows] = await Promise.all([this.prisma.tugas_siswa.count({ where }), this.prisma.tugas_siswa.findMany({ where, orderBy: [{ created_at: 'desc' }, { id: 'desc' }], skip: (page - 1) * limit, take: limit, include: { tugas_siswa_checklist: { where: { siswa_id: BigInt(user.id) }, select: { is_done: true } } } })]);
        return { ok: true, data: rows.map(r => this.output(r, user)), total, page, limit, totalPages: Math.ceil(total / limit) };
    }
    async findById(id: number, user: any) {
        integer(id, 'ID');
        const record = await this.prisma.tugas_siswa.findFirst({ where: { AND: [{ id: BigInt(id) }, await this.scope(user)] }, include: { tugas_siswa_checklist: { where: { siswa_id: BigInt(user.id) } } } });
        if (!record)
            throw new NotFoundException('Tugas tidak ditemukan');
        return this.output(record, user);
    }
    private async fields(data: any, user: any, existing?: any, db: any = this.prisma) {
        if (!data || typeof data !== 'object' || Array.isArray(data))
            throw new BadRequestException('Data tugas tidak valid');
        const merged = { ...existing, ...data };
        let classes: any = merged.kelas_list;
        if (classes == null)
            classes = merged.kelas ? [merged.kelas] : [];
        if (!Array.isArray(classes) || !classes.length || classes.length > 100)
            throw new BadRequestException('Pilih minimal satu kelas');
        classes = [...new Set(classes.map((k: any) => text(k, 'Kelas', 100)))];
        const main = data.kelas !== undefined ? text(data.kelas, 'Kelas utama', 100) : classes[0];
        if (!classes.includes(main))
            throw new BadRequestException('Kelas utama harus berada dalam daftar kelas');
        const start = date(merged.tanggal_mulai instanceof Date ? merged.tanggal_mulai.toISOString() : merged.tanggal_mulai), range = merged.is_range ?? false;
        if (typeof range !== 'boolean')
            throw new BadRequestException('Rentang tanggal tidak valid');
        const end = range ? date(merged.tanggal_selesai instanceof Date ? merged.tanggal_selesai.toISOString() : merged.tanggal_selesai) : null;
        if (end && end < start)
            throw new BadRequestException('Tanggal selesai mendahului tanggal mulai');
        const year = yearOf(start), semester = start.getUTCMonth() >= 6 ? 1 : 2;
        const result: any = { kelas: main, kelas_list: classes, judul_tugas: text(merged.judul_tugas, 'Judul', 255), tanggal_mulai: start, tanggal_selesai: end, is_range: range, tahun_ajaran: year, semester };
        if (!['tugas', 'pengingat'].includes(merged.jenis ?? 'tugas'))
            throw new BadRequestException('Jenis tidak valid');
        result.jenis = merged.jenis ?? 'tugas';
        for (const key of ['deskripsi', 'ruangan', 'durasi', 'sifat_ujian'])
            result[key] = merged[key] ? text(merged[key], key, key === 'deskripsi' ? 10000 : 255) : null;
        if (result.sifat_ujian && !['Ulangan Harian', 'UTS', 'UAS', 'Susulan', 'Lainnya'].includes(result.sifat_ujian))
            throw new BadRequestException('Sifat ujian tidak valid');
        const guruId = merged.guru_id || (rolesOf(user).includes('GURU') ? user.nip : null);
        if (!guruId)
            throw new BadRequestException('Guru wajib dipilih');
        if (rolesOf(user).includes('GURU') && !admin(user) && guruId !== user.nip)
            throw new ForbiddenException('Guru hanya dapat memberi tugas atas namanya sendiri');
        const guru = await db.master_guru.findFirst({ where: { nip: text(guruId, 'Guru', 100), aktif: true }, select: { nip: true, nama_lengkap: true } });
        if (!guru)
            throw new BadRequestException('Guru tidak ditemukan');
        result.guru_id = guru.nip;
        result.nama_guru = guru.nama_lengkap;
        const mapel = await db.master_mapel.findFirst({ where: { id: BigInt(integer(merged.mapel_id, 'Mapel', 2147483647)), aktif: true }, select: { id: true, nama: true } });
        if (!mapel)
            throw new BadRequestException('Mapel tidak ditemukan');
        result.mapel_id = Number(mapel.id);
        result.nama_mapel = mapel.nama;
        const masterClasses = await db.master_kelas.findMany({ where: { nama: { in: classes }, aktif: true }, select: { nama: true } });
        if (classes.some((k: string) => !masterClasses.some((m: any) => m.nama === k)))
            throw new BadRequestException('Kelas tidak ditemukan');
        const targets = merged.target_siswa;
        if (targets != null) {
            if (typeof targets !== 'object' || Array.isArray(targets) || Object.keys(targets).some(k => !classes.includes(k)))
                throw new BadRequestException('Target siswa tidak valid');
            for (const [kelas, nisns] of Object.entries(targets)) {
                if (!Array.isArray(nisns) || nisns.length > 1000 || nisns.some(n => typeof n !== 'string' || !/^\d{1,30}$/.test(n)))
                    throw new BadRequestException('Target siswa tidak valid');
                const members = await db.siswa_kelas.findMany({ where: { kelas, tahun_ajaran: year, aktif: true, nisn: { in: nisns } }, select: { nisn: true } });
                if (nisns.some(n => !members.some((m: any) => m.nisn === n)))
                    throw new BadRequestException('Target siswa bukan anggota kelas');
            }
        }
        result.target_siswa = targets == null || !Object.keys(targets).length ? Prisma.DbNull : targets;
        result.file_url = null;
        result.file_name = null;
        result.file_size = null;
        result.storage_type = null;
        if (merged.file_url) {
            const url = text(merged.file_url, 'URL lampiran', 2048);
            let parsed: URL;
            try {
                parsed = new URL(url);
            }
            catch {
                throw new BadRequestException('URL lampiran tidak valid');
            }
            if (!['https:', 'http:'].includes(parsed.protocol) || parsed.username || parsed.password)
                throw new BadRequestException('URL lampiran tidak aman');
            if (existing && url === existing.file_url) {
                for (const key of ['file_url', 'file_name', 'file_size', 'storage_type'])
                    result[key] = existing[key];
            }
            else {
                const file = await db.file_uploads.findUnique({ where: { file_url: url } });
                if (!file || file.folder !== `owner:${user.authId || user.auth_id || user.id}:tugas-siswa`)
                    throw new ForbiddenException('Lampiran bukan unggahan Anda');
                if (!/\.(pdf|docx?|xlsx?|pptx?|txt|csv|jpe?g|png|webp|zip)$/i.test(file.file_name || '') || Number(file.size_bytes) <= 0 || Number(file.size_bytes) > 10 * 1024 * 1024)
                    throw new BadRequestException('Lampiran tidak valid');
                Object.assign(result, { file_url: url, file_name: file.file_name, file_size: file.size_bytes, storage_type: file.storage_type });
            }
        }
        return result;
    }
    async create(data: any, user: any) {
        this.reader(user);
        const values = await this.fields(data, user);
        await this.writer(user, values);
        const row = await this.prisma.tugas_siswa.create({ data: { ...values, created_by: String(user.id), created_by_nip: user.nip || null, nisn_pembuat: pupil(user) ? user.nip : null, nama_pembuat: user.nama || user.nama_lengkap || null } });
        return this.output(row);
    }
    private async locked(id: number, work: (tx: any) => Promise<any>) { integer(id, 'ID'); return this.prisma.$transaction(async (tx) => { await tx.$executeRaw `SELECT pg_advisory_xact_lock(hashtext(${`tugas-siswa:${id}`}))`; return work(tx); }, { maxWait: 10000, timeout: 30000 }); }
    async update(id: number, data: any, user: any) {
        this.reader(user);
        return this.locked(id, async (tx) => {
            const existing = await tx.tugas_siswa.findUnique({ where: { id: BigInt(id) } });
            if (!existing)
                throw new NotFoundException('Tugas tidak ditemukan');
            this.owner(existing, user);
            if (data?.expected_updated_at !== (existing.updated_at?.toISOString() ?? null))
                throw new ConflictException('Tugas telah berubah. Buka ulang sebelum menyimpan');
            const values = await this.fields(data, user, existing, tx);
            await this.writer(user, values, tx);
            const row = await tx.tugas_siswa.update({ where: { id: BigInt(id) }, data: { ...values, updated_at: new Date(Math.max(Date.now(), (existing.updated_at?.getTime() || 0) + 1)) } });
            return this.output(row);
        });
    }
    async remove(id: number, user: any) {
        this.reader(user);
        return this.locked(id, async (tx) => {
            const row = await tx.tugas_siswa.findUnique({ where: { id: BigInt(id) } });
            if (!row)
                throw new NotFoundException('Tugas tidak ditemukan');
            this.owner(row, user);
            await this.writer(user, { ...row, kelas_list: Array.isArray(row.kelas_list) && row.kelas_list.length ? row.kelas_list : [row.kelas] }, tx);
            await tx.tugas_siswa_checklist.deleteMany({ where: { tugas_id: BigInt(id) } });
            await tx.tugas_siswa.delete({ where: { id: BigInt(id) } });
            return { ok: true };
        });
    }
    async getStats(filter: TugasSiswaFilter, user: any) {
        const today = new Date(schoolDay() + 'T00:00:00Z'), tomorrow = new Date(today.getTime() + 86400000);
        const tasks = await this.prisma.tugas_siswa.findMany({ where: await this.where(filter, user), select: { id: true, tanggal_mulai: true, tanggal_selesai: true } });
        const deadlines = tasks.map(t => t.tanggal_selesai || t.tanggal_mulai);
        const done = await this.prisma.tugas_siswa_checklist.count({ where: { siswa_id: BigInt(user.id), is_done: true, tugas_id: { in: tasks.map(t => t.id) } } });
        return { ok: true, stats: { totalActive: deadlines.filter(d => d && d >= today).length, upcoming: deadlines.filter(d => d && d >= today && d <= tomorrow).length, done } };
    }
    async toggleChecklist(tugasId: number, siswaId: number, isDone: boolean, user: any) {
        this.reader(user);
        if (!pupil(user) || String(user.id) !== String(siswaId))
            throw new ForbiddenException('Checklist hanya untuk siswa pemilik sesi');
        integer(siswaId, 'ID siswa');
        integer(tugasId, 'ID tugas');
        if (typeof isDone !== 'boolean')
            throw new BadRequestException('is_done harus boolean');
        return this.locked(tugasId, async (tx) => {
            const task = await tx.tugas_siswa.findFirst({ where: { AND: [{ id: BigInt(tugasId) }, await this.scope(user, tx)] } });
            if (!task)
                throw new NotFoundException('Tugas tidak ditemukan');
            if (isDone)
                await tx.tugas_siswa_checklist.upsert({ where: { tugas_id_siswa_id: { tugas_id: BigInt(tugasId), siswa_id: BigInt(siswaId) } }, create: { tugas_id: BigInt(tugasId), siswa_id: BigInt(siswaId), is_done: true }, update: { is_done: true } });
            else
                await tx.tugas_siswa_checklist.deleteMany({ where: { tugas_id: BigInt(tugasId), siswa_id: BigInt(siswaId) } });
            return { ok: true };
        });
    }
    async getMasterData(tahunAjaran: string | undefined, user: any) {
        this.reader(user);
        const [guru, mapel, kelas] = await Promise.all([this.prisma.master_guru.findMany({ where: { aktif: true }, orderBy: { nama_lengkap: 'asc' }, select: { nip: true, nama_lengkap: true } }), this.prisma.master_mapel.findMany({ where: { aktif: true }, orderBy: { nama: 'asc' }, select: { id: true, kode: true, nama: true } }), this.prisma.master_kelas.findMany({ where: { aktif: true }, orderBy: { nama: 'asc' }, select: { id: true, nama: true, tingkat: true, program: true } })]);
        return { ok: true, guru: guru.map(g => ({ guru_id: g.nip, nama_lengkap: g.nama_lengkap })), mapel: mapel.map(m => ({ ...m, id: Number(m.id) })), kelas: kelas.map(k => ({ ...k, id: Number(k.id) })) };
    }
}
