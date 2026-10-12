import { Injectable, NotFoundException, BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

const CATEGORIES = ['Akademik', 'Olahraga', 'Seni & Budaya', 'Keagamaan', 'Lainnya'];
const LEVELS = ['Sekolah', 'Kabupaten/Kota', 'Provinsi', 'Nasional', 'Internasional'];
const STATUSES = ['Menunggu', 'Disetujui', 'Ditolak'];
function serialize(value: any): any {
  if (value == null) return value;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'bigint') return value.toString();
  if (Array.isArray(value)) return value.map(serialize);
  if (typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, serialize(item)]));
  return value;
}
function text(value: any, field: string, max = 255): string {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > max) throw new BadRequestException(`${field} tidak valid`);
  return value.trim();
}
function choice(value: any, options: string[], field: string): string {
  if (!options.includes(value)) throw new BadRequestException(`${field} tidak valid`);
  return value;
}
function date(value: any): Date {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}(?:T00:00:00(?:\.000)?Z)?$/.test(value)) throw new BadRequestException('Tanggal pelaksanaan tidak valid');
  const result = new Date(value.slice(0, 10) + 'T00:00:00.000Z');
  if (!Number.isFinite(result.getTime()) || result.toISOString().slice(0, 10) !== value.slice(0, 10)) throw new BadRequestException('Tanggal pelaksanaan tidak valid');
  return result;
}
function idValue(id: string) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) throw new BadRequestException('ID prestasi tidak valid');
}

@Injectable()
export class PrestasiService {
  constructor(private readonly prisma: PrismaService) {}

  private actor(user: any) {
    if (!user?.id) throw new ForbiddenException('Sesi tidak dikenali');
    const roles = [...(Array.isArray(user.roles) ? user.roles : []), ...String(user.role || '').split(/[,|]/)].map((r: any) => String(r).trim().toUpperCase());
    const validator = roles.some(r => ['ADMIN', 'ADMINISTRATOR', 'OP_LOMBA', 'WKM KESISWAAN', 'WKM_KESISWAAN'].includes(r));
    const nisn = String(user.nisn || user.nip || user.username || '').trim();
    if (!validator && (!roles.includes('SISWA') || !nisn)) throw new ForbiddenException('Anda tidak memiliki peran Prestasi Lomba');
    return { validator, nisn, owner: String(user.authId || user.auth_id || user.id), name: user.nama || user.username || user.nip || String(user.id) };
  }

  private async attachment(value: any, actor: ReturnType<PrestasiService['actor']>, photo = false) {
    const url = text(value, 'URL lampiran', 2048);
    let parsed: URL;
    try { parsed = new URL(url); } catch { throw new BadRequestException('URL lampiran tidak valid'); }
    if (!['https:', 'http:'].includes(parsed.protocol) || parsed.username || parsed.password) throw new BadRequestException('URL lampiran tidak aman');
    const file = await this.prisma.file_uploads.findUnique({ where: { file_url: url } });
    if (!file || file.folder !== `owner:${actor.owner}:prestasi`) throw new ForbiddenException('Lampiran harus diunggah oleh pemanggil melalui halaman Prestasi');
    if (!(photo ? /\.(png|jpe?g)$/i : /\.(pdf|png|jpe?g)$/i).test(file.file_name || '') || Number(file.size_bytes) <= 0 || Number(file.size_bytes) > 10 * 1024 * 1024) throw new BadRequestException('Format atau ukuran lampiran tidak valid');
    return url;
  }

  private async fields(payload: any, actor: ReturnType<PrestasiService['actor']>, existing?: any) {
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) throw new BadRequestException('Data prestasi tidak valid');
    const data: any = {};
    for (const key of ['nisn', 'nama_lomba', 'penyelenggara', 'prestasi_diraih']) {
      if (!existing || payload[key] !== undefined) data[key] = text(payload[key], key, key === 'nisn' ? 30 : 255);
    }
    if (!existing || payload.kategori !== undefined) data.kategori = choice(payload.kategori, CATEGORIES, 'Kategori');
    if (!existing || payload.tingkat !== undefined) data.tingkat = choice(payload.tingkat, LEVELS, 'Tingkat');
    if (!existing || payload.tanggal_pelaksanaan !== undefined) data.tanggal_pelaksanaan = date(payload.tanggal_pelaksanaan);
    if (!existing || payload.bukti_sertifikat !== undefined) {
      data.bukti_sertifikat = existing && payload.bukti_sertifikat === existing.bukti_sertifikat ? existing.bukti_sertifikat : await this.attachment(payload.bukti_sertifikat, actor);
    }
    if (payload.foto_kegiatan !== undefined) data.foto_kegiatan = !payload.foto_kegiatan ? null : existing && payload.foto_kegiatan === existing.foto_kegiatan ? existing.foto_kegiatan : await this.attachment(payload.foto_kegiatan, actor, true);
    return data;
  }

  async findAll(query: any, currentUser?: any) {
    const actor = this.actor(currentUser);
    const where: any = {};
    if (!actor.validator) where.nisn = actor.nisn;
    else if (query?.nisn) where.nisn = text(query.nisn, 'NISN', 30);
    if (query?.status_validasi) where.status_validasi = choice(query.status_validasi, STATUSES, 'Status');
    if (query?.tingkat) where.tingkat = choice(query.tingkat, LEVELS, 'Tingkat');
    if (query?.kategori) where.kategori = choice(query.kategori, CATEGORIES, 'Kategori');
    if (query?.search) {
      const search = text(query.search, 'Pencarian', 255);
      where.OR = ['nama_lomba', 'penyelenggara', 'prestasi_diraih'].map(key => ({ [key]: { contains: search, mode: 'insensitive' } }));
    }
    const page = Number(query?.page ?? 1), limit = Number(query?.limit ?? 200);
    if (!Number.isSafeInteger(page) || page < 1 || page > 10000 || !Number.isSafeInteger(limit) || limit < 1 || limit > 500) throw new BadRequestException('Parameter halaman tidak valid');
    const rows = await this.prisma.prestasi_lomba.findMany({ where, orderBy: [{ created_at: 'desc' }, { id: 'asc' }], skip: (page - 1) * limit, take: limit + 1 });
    return { ok: true, data: serialize(rows.slice(0, limit)), has_more: rows.length > limit, page };
  }

  async findOne(id: string, currentUser?: any) {
    const actor = this.actor(currentUser); idValue(id);
    const item = await this.prisma.prestasi_lomba.findUnique({ where: { id } });
    if (!item) throw new NotFoundException('Prestasi tidak ditemukan');
    if (!actor.validator && item.nisn !== actor.nisn) throw new ForbiddenException('Prestasi bukan milik Anda');
    return { ok: true, data: serialize(item) };
  }

  async create(payload: any, currentUser?: any) {
    const actor = this.actor(currentUser);
    if (!actor.validator && payload?.nisn !== undefined && payload.nisn !== actor.nisn) throw new ForbiddenException('Tidak dapat mengajukan prestasi atas nama siswa lain');
    const data = await this.fields(actor.validator ? payload : { ...payload, nisn: actor.nisn }, actor);
    const item = await this.prisma.prestasi_lomba.create({ data: { ...data, status_validasi: 'Menunggu', catatan_validator: null, validated_by: null, validated_at: null } });
    return { ok: true, data: serialize(item) };
  }

  async update(id: string, payload: any, currentUser?: any) {
    const actor = this.actor(currentUser);
    if (!actor.validator) throw new ForbiddenException('Hanya validator yang boleh mengubah prestasi');
    idValue(id);
    const existing = await this.prisma.prestasi_lomba.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Prestasi tidak ditemukan');
    if (existing.status_validasi === 'Disetujui') throw new ConflictException('Prestasi sudah disetujui dan tidak dapat diubah');
    const data = await this.fields(payload, actor, existing);
    if (payload.status_validasi !== undefined) {
      const expected = existing.updated_at?.toISOString() ?? null;
      if (payload.expected_updated_at !== expected) throw new ConflictException('Prestasi telah berubah. Muat ulang sebelum memvalidasi kembali');
      data.status_validasi = choice(payload.status_validasi, ['Disetujui', 'Ditolak'], 'Keputusan validasi');
      data.catatan_validator = payload.catatan_validator ? text(payload.catatan_validator, 'Catatan validator', 2000) : null;
      if (data.status_validasi === 'Ditolak' && !data.catatan_validator) throw new BadRequestException('Alasan penolakan wajib diisi');
      data.validated_by = actor.name; data.validated_at = new Date();
    } else {
      if (payload.catatan_validator !== undefined) throw new BadRequestException('Catatan harus disimpan bersama keputusan validasi');
      if (!Object.keys(data).length) throw new BadRequestException('Tidak ada perubahan prestasi');
      // Perubahan isi mengharuskan pemeriksaan ulang dan menghapus metadata keputusan lama.
      data.status_validasi = 'Menunggu'; data.catatan_validator = null; data.validated_by = null; data.validated_at = null;
    }
    data.updated_at = new Date(Math.max(Date.now(), (existing.updated_at?.getTime() || 0) + 1));
    // PostgreSQL menyimpan mikrodetik, sementara Date JavaScript hanya milidetik.
    // Cocokkan rentang milidetik yang sama agar baris lama tetap dapat divalidasi.
    const version = existing.updated_at ? { gte: existing.updated_at, lt: new Date(existing.updated_at.getTime() + 1) } : null;
    const result = await this.prisma.prestasi_lomba.updateMany({ where: { id, status_validasi: existing.status_validasi, updated_at: version }, data });
    if (!result.count) throw new ConflictException('Prestasi telah berubah. Muat ulang sebelum memvalidasi kembali');
    return { ok: true, data: serialize(await this.prisma.prestasi_lomba.findUnique({ where: { id } })) };
  }

  async delete(id: string, currentUser?: any) {
    const actor = this.actor(currentUser); idValue(id);
    const where: any = { id };
    if (!actor.validator) { where.nisn = actor.nisn; where.status_validasi = { in: ['Menunggu', 'Ditolak'] }; }
    const result = await this.prisma.prestasi_lomba.deleteMany({ where });
    if (!result.count) throw new ConflictException('Prestasi tidak ditemukan atau tidak dapat dihapus');
    return { ok: true, message: 'Prestasi berhasil dihapus' };
  }
}
