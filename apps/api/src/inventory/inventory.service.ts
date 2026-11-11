import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

const consent = 'Saya menyetujui peminjaman barang ini, bertanggung jawab menjaga kondisinya, dan mengembalikannya sesuai waktu yang disetujui.';
const uuid = (v: any) => typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
const required = (v: any, label: string, max = 255) => {
  if (typeof v !== 'string' || !v.trim() || v.trim().length > max) throw new BadRequestException(`${label} wajib diisi (maksimal ${max} karakter)`);
  return v.trim();
};
const optional = (v: any, max = 1000) => v == null || v === '' ? null : required(v, 'Teks', max);
const positive = (v: any, label: string) => {
  const n = Number(v);
  if (!Number.isSafeInteger(n) || n < 1 || n > 100000) throw new BadRequestException(`${label} harus bilangan positif`);
  return n;
};
const identity = (u: any) => ({ id: String(u?.authId || u?.auth_id || u?.id || ''), name: String(u?.nama || u?.name || u?.username || u?.nip || '') });
const manager = (u: any) => [...(u?.roles || []), u?.role].some(r => ['ADMIN', 'ADMINISTRATOR', 'OP_INVENTARIS', 'KTU', 'WKM_SARPRAS'].includes(String(r).toUpperCase()));

@Injectable()
export class InventoryService {
  constructor(private readonly prisma: PrismaService) {}

  private ensureManager(user: any) { if (!manager(user)) throw new ForbiddenException('Hanya petugas inventaris yang dapat melakukan tindakan ini'); }
  private async itemFields(body: any, user: any, oldPhoto?: string | null) {
    const photo = optional(body.photo_url, 2048);
    if (!photo) throw new BadRequestException('Foto barang wajib diunggah');
    if (photo) {
      let url: URL;
      try { url = new URL(photo); } catch { throw new BadRequestException('URL foto tidak valid'); }
      if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) throw new BadRequestException('URL foto tidak valid');
      if (photo !== oldPhoto) {
        const file = await this.prisma.file_uploads.findUnique({ where: { file_url: photo } });
        const owner = identity(user).id;
        if (!file || file.folder !== `owner:${owner}:inventaris` || !/\.(jpe?g|png|webp)$/i.test(file.file_name || '') || Number(file.size_bytes) > 5 * 1024 * 1024) throw new ForbiddenException('Foto harus diunggah oleh petugas melalui halaman Inventaris');
      }
    }
    const condition = required(body.condition || 'Baik', 'Kondisi', 40);
    if (!['Baik', 'Perlu perbaikan', 'Rusak'].includes(condition)) throw new BadRequestException('Kondisi tidak valid');
    return { code: required(body.code, 'Kode barang', 60), name: required(body.name, 'Nama barang'), category: required(body.category, 'Kategori', 80), description: optional(body.description), location: optional(body.location, 120), condition, photo_url: photo, quantity: positive(body.quantity, 'Jumlah'), active: body.active !== false };
  }

  async items(query: any) {
    const search = typeof query?.search === 'string' ? query.search.trim().slice(0, 100) : '';
    const data = await this.prisma.inventory_items.findMany({ where: search ? { OR: [{ code: { contains: search, mode: 'insensitive' } }, { name: { contains: search, mode: 'insensitive' } }, { category: { contains: search, mode: 'insensitive' } }] } : {}, orderBy: { name: 'asc' }, take: 500 });
    const now = new Date();
    const reservations = await this.prisma.inventory_loans.groupBy({ by: ['item_id'], where: { item_id: { in: data.map(item => item.id) }, status: { in: ['Menunggu', 'Disetujui', 'Dipinjam'] }, start_at: { lte: now }, end_at: { gt: now } }, _sum: { quantity: true } });
    const reserved = new Map(reservations.map(row => [row.item_id, row._sum.quantity || 0]));
    return { ok: true, data: data.map(item => ({ ...item, available_now: Math.max(0, item.quantity - (reserved.get(item.id) || 0)) })) };
  }
  async createItem(body: any, user: any) {
    this.ensureManager(user);
    const data = await this.prisma.inventory_items.create({ data: await this.itemFields(body, user) });
    return { ok: true, data };
  }
  async updateItem(id: string, body: any, user: any) {
    this.ensureManager(user);
    if (!uuid(id)) throw new BadRequestException('ID barang tidak valid');
    const quantity = positive(body.quantity, 'Jumlah');
    const data = await this.prisma.$transaction(async tx => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${id}::text))`;
      const existing = await tx.inventory_items.findUnique({ where: { id } });
      if (!existing) throw new NotFoundException('Barang tidak ditemukan');
      const reservations = await tx.inventory_loans.findMany({ where: { item_id: id, status: { in: ['Menunggu', 'Disetujui', 'Dipinjam'] }, end_at: { gt: new Date() } }, select: { quantity: true, start_at: true, end_at: true } });
      const events = reservations.flatMap(loan => [{ time: loan.start_at.getTime(), delta: loan.quantity }, { time: loan.end_at.getTime(), delta: -loan.quantity }]).sort((a, b) => a.time - b.time || a.delta - b.delta);
      let reserved = 0;
      for (const event of events) { reserved += event.delta; if (reserved > quantity) throw new ConflictException('Jumlah unit tidak boleh kurang dari reservasi aktif'); }
      return tx.inventory_items.update({ where: { id }, data: await this.itemFields(body, user, existing.photo_url) });
    });
    return { ok: true, data };
  }
  async loans(user: any) {
    const actor = identity(user);
    if (!actor.id) throw new ForbiddenException('Sesi tidak dikenali');
    const data = await this.prisma.inventory_loans.findMany({ where: manager(user) ? {} : { borrower_id: actor.id }, include: { item: { select: { code: true, name: true, photo_url: true } } }, orderBy: { created_at: 'desc' }, take: 500 });
    return { ok: true, data };
  }
  async request(body: any, user: any) {
    const actor = identity(user);
    if (!actor.id || !actor.name) throw new ForbiddenException('Sesi tidak dikenali');
    if (!uuid(body?.item_id)) throw new BadRequestException('Barang tidak valid');
    if (body?.consent !== true) throw new BadRequestException('Persetujuan peminjam wajib diberikan');
    const start = new Date(body.start_at), end = new Date(body.end_at);
    if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || start < new Date() || end <= start) throw new BadRequestException('Rentang waktu peminjaman tidak valid');
    if (end.getTime() - start.getTime() > 30 * 86400000) throw new BadRequestException('Durasi maksimal 30 hari');
    const quantity = positive(body.quantity, 'Jumlah pinjam');
    const purpose = required(body.purpose, 'Keperluan', 1000);
    const data = await this.prisma.$transaction(async tx => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${body.item_id}::text))`;
      const item = await tx.inventory_items.findUnique({ where: { id: body.item_id } });
      if (!item || !item.active) throw new NotFoundException('Barang tidak tersedia');
      if (quantity > item.quantity) throw new BadRequestException('Jumlah melebihi stok');
      const overlapping = await tx.inventory_loans.findMany({ where: { item_id: item.id, status: { in: ['Menunggu', 'Disetujui', 'Dipinjam'] }, start_at: { lt: end }, end_at: { gt: start } }, select: { quantity: true, start_at: true, end_at: true } });
      const events = overlapping.flatMap(loan => [
        { time: Math.max(loan.start_at.getTime(), start.getTime()), delta: loan.quantity },
        { time: Math.min(loan.end_at.getTime(), end.getTime()), delta: -loan.quantity },
      ]).sort((a, b) => a.time - b.time || a.delta - b.delta);
      let reserved = 0;
      for (const event of events) { reserved += event.delta; if (reserved + quantity > item.quantity) throw new ConflictException('Stok tidak cukup pada rentang waktu tersebut'); }
      return tx.inventory_loans.create({ data: { item_id: item.id, borrower_id: actor.id, borrower_name: actor.name, quantity, purpose, start_at: start, end_at: end, consent_at: new Date(), consent_text: consent } });
    });
    return { ok: true, data };
  }
  async transition(id: string, body: any, user: any) {
    if (!uuid(id)) throw new BadRequestException('ID peminjaman tidak valid');
    const status = body?.status;
    const actor = identity(user);
    const loan = await this.prisma.inventory_loans.findUnique({ where: { id } });
    if (!loan) throw new NotFoundException('Peminjaman tidak ditemukan');
    if (status === 'Dibatalkan') {
      if (loan.borrower_id !== actor.id || loan.status !== 'Menunggu') throw new ForbiddenException('Hanya pengajuan sendiri yang masih menunggu dapat dibatalkan');
    } else this.ensureManager(user);
    const allowed: Record<string, string[]> = { Menunggu: ['Disetujui', 'Ditolak', 'Dibatalkan'], Disetujui: ['Dipinjam', 'Dibatalkan'], Dipinjam: ['Dikembalikan'] };
    if (!allowed[loan.status]?.includes(status)) throw new ConflictException('Perubahan status tidak valid. Muat ulang halaman');
    const note = optional(body.review_note, 1000);
    if (status === 'Ditolak' && !note) throw new BadRequestException('Alasan penolakan wajib diisi');
    const returnCondition = status === 'Dikembalikan' ? required(body.return_condition, 'Kondisi pengembalian', 120) : null;
    const now = new Date();
    const result = await this.prisma.inventory_loans.updateMany({ where: { id, status: loan.status }, data: { status, ...(status === 'Disetujui' || status === 'Ditolak' ? { reviewed_by: actor.name, reviewed_at: now, review_note: note } : {}), ...(status === 'Dipinjam' ? { handed_over_at: now } : {}), ...(status === 'Dikembalikan' ? { returned_at: now, return_condition: returnCondition } : {}) } });
    if (!result.count) throw new ConflictException('Peminjaman telah berubah. Muat ulang halaman');
    return { ok: true, data: await this.prisma.inventory_loans.findUnique({ where: { id } }) };
  }
}
