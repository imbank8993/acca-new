import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import sanitizeHtml = require('sanitize-html');

export const VALID_COLORS = [
  'default',
  'red',
  'orange',
  'yellow',
  'green',
  'teal',
  'blue',
  'purple',
  'pink',
  'brown',
  'gray',
] as const;

export type ValidColor = (typeof VALID_COLORS)[number];

export const VALID_JENIS = ['catatan', 'draft_agenda'] as const;
export type ValidJenis = (typeof VALID_JENIS)[number];

export const VALID_STATUS = ['active', 'pinned', 'archived', 'trashed'] as const;
export type ValidStatus = (typeof VALID_STATUS)[number];

export interface IsiBlock {
  type: string;
  text: string;
  checked?: boolean;
}

function rentangBulan(bulan: string): { start: Date; end: Date } {
  const cocok = /^(\d{4})-(\d{2})$/.exec(String(bulan).trim());
  if (!cocok) {
    throw new BadRequestException('Parameter bulan harus berformat YYYY-MM, mis. 2026-10');
  }
  const tahun = Number(cocok[1]);
  const bln = Number(cocok[2]);
  if (bln < 1 || bln > 12) {
    throw new BadRequestException('Bulan harus di antara 01 sampai 12');
  }
  const start = new Date(Date.UTC(tahun, bln - 1, 1, 0, 0, 0, 0));
  const end = new Date(Date.UTC(tahun, bln, 0, 23, 59, 59, 999));
  return { start, end };
}

function toLocalISODate(d: Date | null): string | null {
  if (!d) return null;
  if (typeof d === 'string') return (d as string).slice(0, 10);
  return d.toISOString().slice(0, 10);
}

function toLocalISOTime(d: Date | null): string | null {
  if (!d) return null;
  if (typeof d === 'string') return (d as string).slice(0, 8);
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

export function serializeCatatan(item: any) {
  if (!item) return item;
  return {
    ...item,
    id: typeof item.id === 'bigint' ? item.id.toString() : item.id,
    user_id: typeof item.user_id === 'bigint' ? item.user_id.toString() : item.user_id,
    tanggal_agenda: toLocalISODate(item.tanggal_agenda),
    waktu_agenda: toLocalISOTime(item.waktu_agenda),
    created_at: item.created_at instanceof Date ? item.created_at.toISOString() : item.created_at,
    updated_at: item.updated_at instanceof Date ? item.updated_at.toISOString() : item.updated_at,
    trashed_at: item.trashed_at instanceof Date ? item.trashed_at.toISOString() : item.trashed_at,
  };
}

@Injectable()
export class CatatanPribadiService {
  private readonly logger = new Logger(CatatanPribadiService.name);

  constructor(private readonly prisma: PrismaService) {}

  public parseBigIntId(id: any, label = 'ID'): bigint {
    if (id === null || id === undefined || String(id).trim() === '') {
      throw new BadRequestException(`${label} wajib diisi`);
    }
    const s = String(id).trim();
    if (!/^\d+$/.test(s)) {
      throw new BadRequestException(`${label} harus berupa angka bulat valid`);
    }
    try {
      return BigInt(s);
    } catch {
      throw new BadRequestException(`${label} tidak valid`);
    }
  }

  private validateJudul(judul: any): string {
    if (judul === undefined || judul === null) return '';
    if (typeof judul !== 'string') {
      throw new BadRequestException('Judul harus berupa string');
    }
    const trimmed = judul.trim();
    if (trimmed.length > 200) {
      throw new BadRequestException('Judul maksimal 200 karakter');
    }
    return trimmed;
  }

  private validateLabel(label: any): string[] {
    if (label === undefined || label === null) return [];
    if (!Array.isArray(label)) {
      throw new BadRequestException('Label harus berupa array');
    }
    if (label.length > 10) {
      throw new BadRequestException('Label maksimal 10 item');
    }
    return label.map((item: any, idx: number) => {
      if (typeof item !== 'string') {
        throw new BadRequestException(`Label ke-${idx + 1} harus berupa string`);
      }
      const trimmed = item.trim();
      if (trimmed.length > 50) {
        throw new BadRequestException(`Setiap label maksimal 50 karakter`);
      }
      return trimmed;
    }).filter(Boolean);
  }

  private validateWarna(warna: any): string {
    if (warna === undefined || warna === null || warna === '') return 'default';
    if (typeof warna !== 'string' || !VALID_COLORS.includes(warna as any)) {
      throw new BadRequestException(
        `Warna "${warna}" tidak valid. Pilihan valid: ${VALID_COLORS.join(', ')}`,
      );
    }
    return warna;
  }

  private validateJenis(jenis: any): ValidJenis {
    if (jenis === undefined || jenis === null || jenis === '') return 'catatan';
    if (typeof jenis !== 'string' || !VALID_JENIS.includes(jenis as any)) {
      throw new BadRequestException(
        `Jenis harus salah satu dari: ${VALID_JENIS.join(', ')}`,
      );
    }
    return jenis as ValidJenis;
  }

  private validateTempatAgenda(tempat: any): string | null {
    if (!tempat) return null;
    if (typeof tempat !== 'string') {
      throw new BadRequestException('Tempat agenda harus berupa string');
    }
    const trimmed = tempat.trim();
    if (trimmed.length > 255) {
      throw new BadRequestException('Tempat agenda maksimal 255 karakter');
    }
    return trimmed || null;
  }

  private parseDateOnly(d: any): Date | null {
    if (!d) return null;
    const date = new Date(d);
    if (isNaN(date.getTime())) {
      throw new BadRequestException(`Format tanggal tidak valid: ${d}`);
    }
    return date;
  }

  private parseTimeOnly(t: any): Date | null {
    if (!t) return null;
    const s = String(t).trim();
    const timeStr = s.includes('T') ? s : `1970-01-01T${s.length === 5 ? s + ':00' : s}`;
    const date = new Date(timeStr);
    if (isNaN(date.getTime())) {
      throw new BadRequestException(`Format waktu tidak valid: ${t}`);
    }
    return date;
  }

  private sanitizeIsi(raw: any): IsiBlock[] {
    if (!raw) return [];
    if (!Array.isArray(raw)) {
      throw new BadRequestException('Isi catatan harus berupa array of blocks');
    }
    return raw.map((block: any, index: number) => {
      if (!block || typeof block !== 'object') {
        throw new BadRequestException(`Blok isi ke-${index + 1} tidak valid`);
      }
      const type = typeof block.type === 'string' && block.type.trim() ? block.type.trim() : 'paragraph';
      const rawText = typeof block.text === 'string' ? block.text : '';
      const cleanText = sanitizeHtml(rawText, {
        allowedTags: [],
        allowedAttributes: {},
      });

      const sanitizedBlock: IsiBlock = {
        type,
        text: cleanText,
      };

      if (typeof block.checked === 'boolean') {
        sanitizedBlock.checked = block.checked;
      }

      return sanitizedBlock;
    });
  }

  /**
   * List notes with filtering, pagination, and sorting (pinned first, updated_at DESC)
   */
  async findAll(
    userId: bigint,
    query: {
      status?: string;
      jenis?: string;
      label?: string;
      search?: string;
      page?: string | number;
      limit?: string | number;
    },
  ) {
    const where: any = { user_id: userId };

    // Status filter (default: active,pinned)
    if (query.status && query.status.trim().toLowerCase() === 'all') {
      where.status = { not: 'trashed' };
    } else {
      const statusInput = query.status || 'active,pinned';
      const statusArr = statusInput
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      where.status = statusArr.length === 1 ? statusArr[0] : { in: statusArr };
    }

    // Jenis filter
    if (query.jenis && query.jenis.trim()) {
      where.jenis = query.jenis.trim();
    }

    // Label filter
    if (query.label && query.label.trim()) {
      where.label = { has: query.label.trim() };
    }

    // Search filter (ILIKE on judul)
    if (query.search && query.search.trim()) {
      where.judul = { contains: query.search.trim(), mode: 'insensitive' };
    }

    const page = Math.max(1, parseInt(String(query.page || '1'), 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(String(query.limit || '20'), 10) || 20));
    const skip = (page - 1) * limit;

    const [total, items] = await Promise.all([
      this.prisma.catatan_pribadi.count({ where }),
      this.prisma.catatan_pribadi.findMany({
        where,
        orderBy: [{ status: 'desc' }, { updated_at: 'desc' }],
        skip,
        take: limit,
      }),
    ]);

    // Ensure pinned items always appear before active items in memory as well
    items.sort((a, b) => {
      const aPinned = a.status === 'pinned';
      const bPinned = b.status === 'pinned';
      if (aPinned && !bPinned) return -1;
      if (!aPinned && bPinned) return 1;
      return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
    });

    return {
      data: items.map(serializeCatatan),
      meta: {
        total,
        page,
        limit,
        total_pages: Math.ceil(total / limit) || 1,
      },
    };
  }

  /**
   * Get single note by ID with ownership verification
   */
  async findOne(userId: bigint, idStr: string) {
    const id = this.parseBigIntId(idStr, 'ID Catatan');
    const note = await this.prisma.catatan_pribadi.findUnique({
      where: { id },
    });

    if (!note) {
      throw new NotFoundException('Catatan tidak ditemukan');
    }

    if (note.user_id !== userId) {
      throw new ForbiddenException('Anda tidak memiliki akses ke catatan ini');
    }

    return serializeCatatan(note);
  }

  /**
   * Create new note
   */
  async create(userId: bigint, body: any) {
    const judul = this.validateJudul(body.judul);
    const isi = this.sanitizeIsi(body.isi);
    const label = this.validateLabel(body.label);
    const warna = this.validateWarna(body.warna);
    const jenis = this.validateJenis(body.jenis);
    const tempat_agenda = this.validateTempatAgenda(body.tempat_agenda);
    const tanggal_agenda = this.parseDateOnly(body.tanggal_agenda);
    const waktu_agenda = this.parseTimeOnly(body.waktu_agenda);

    const initialStatus = body.status === 'pinned' ? 'pinned' : 'active';

    const created = await this.prisma.catatan_pribadi.create({
      data: {
        user_id: userId,
        jenis,
        judul,
        isi: isi as any,
        label,
        warna,
        tanggal_agenda,
        waktu_agenda,
        tempat_agenda,
        status: initialStatus,
        version: 1,
      },
    });

    return serializeCatatan(created);
  }

  /**
   * Update note with optimistic locking check
   */
  async update(userId: bigint, idStr: string, body: any) {
    const id = this.parseBigIntId(idStr, 'ID Catatan');
    const existing = await this.prisma.catatan_pribadi.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException('Catatan tidak ditemukan');
    }

    if (existing.user_id !== userId) {
      throw new ForbiddenException('Anda tidak memiliki akses ke catatan ini');
    }

    // Optimistic locking check
    if (!Number.isSafeInteger(body.version) || body.version < 1) {
      throw new BadRequestException('Versi catatan wajib berupa angka bulat positif');
    }
    if (body.version !== existing.version) {
      throw new ConflictException({
        success: false,
        message: 'Catatan telah diubah di sesi lain. Silakan muat ulang data terbaru.',
        serverData: serializeCatatan(existing),
      });
    }

    const data: any = {
      version: existing.version + 1,
      updated_at: new Date(),
    };

    if (body.judul !== undefined) {
      data.judul = this.validateJudul(body.judul);
    }
    if (body.isi !== undefined) {
      data.isi = this.sanitizeIsi(body.isi) as any;
    }
    if (body.label !== undefined) {
      data.label = this.validateLabel(body.label);
    }
    if (body.warna !== undefined) {
      data.warna = this.validateWarna(body.warna);
    }
    if (body.jenis !== undefined) {
      data.jenis = this.validateJenis(body.jenis);
    }
    if (body.tempat_agenda !== undefined) {
      data.tempat_agenda = this.validateTempatAgenda(body.tempat_agenda);
    }
    if (body.tanggal_agenda !== undefined) {
      data.tanggal_agenda = this.parseDateOnly(body.tanggal_agenda);
    }
    if (body.waktu_agenda !== undefined) {
      data.waktu_agenda = this.parseTimeOnly(body.waktu_agenda);
    }
    if (body.status !== undefined) {
      if (!VALID_STATUS.includes(body.status)) {
        throw new BadRequestException(`Status tidak valid. Pilihan: ${VALID_STATUS.join(', ')}`);
      }
      data.status = body.status;
      data.trashed_at = body.status === 'trashed' ? new Date() : null;
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const changed = await tx.catatan_pribadi.updateMany({
        where: { id, user_id: userId, version: body.version },
        data,
      });
      if (changed.count !== 1) {
        const current = await tx.catatan_pribadi.findFirst({ where: { id, user_id: userId } });
        if (!current) throw new NotFoundException('Catatan tidak ditemukan');
        throw new ConflictException({
          success: false,
          message: 'Catatan telah diubah di sesi lain. Silakan tinjau versi terbaru.',
          serverData: serializeCatatan(current),
        });
      }
      return tx.catatan_pribadi.findUnique({ where: { id } });
    });

    return serializeCatatan(updated);
  }

  /**
   * Change status (pin/unpin, archive, trash, restore)
   */
  async updateStatus(userId: bigint, idStr: string, body: any) {
    const id = this.parseBigIntId(idStr, 'ID Catatan');
    const existing = await this.prisma.catatan_pribadi.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException('Catatan tidak ditemukan');
    }

    if (existing.user_id !== userId) {
      throw new ForbiddenException('Anda tidak memiliki akses ke catatan ini');
    }

    let newStatus: string;
    const action = typeof body.action === 'string' ? body.action.trim().toLowerCase() : '';
    const statusInput = typeof body.status === 'string' ? body.status.trim().toLowerCase() : '';

    if (action === 'pin') {
      newStatus = existing.status === 'pinned' ? 'active' : 'pinned';
    } else if (action === 'unpin') {
      newStatus = 'active';
    } else if (action === 'archive') {
      newStatus = 'archived';
    } else if (action === 'unarchive') {
      newStatus = 'active';
    } else if (action === 'trash') {
      newStatus = 'trashed';
    } else if (action === 'restore') {
      newStatus = 'active';
    } else if (statusInput) {
      if (!VALID_STATUS.includes(statusInput as any)) {
        throw new BadRequestException(
          `Status "${statusInput}" tidak valid. Pilihan: ${VALID_STATUS.join(', ')}`,
        );
      }
      newStatus = statusInput;
    } else {
      throw new BadRequestException('Parameter status atau action wajib disertakan');
    }

    const trashed_at = newStatus === 'trashed' ? new Date() : null;

    const updated = await this.prisma.catatan_pribadi.update({
      where: { id },
      data: {
        status: newStatus,
        trashed_at,
        version: { increment: 1 },
        updated_at: new Date(),
      },
    });

    return serializeCatatan(updated);
  }

  /**
   * Restore note from trash
   */
  async restore(userId: bigint, idStr: string) {
    const id = this.parseBigIntId(idStr, 'ID Catatan');
    const existing = await this.prisma.catatan_pribadi.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException('Catatan tidak ditemukan');
    }

    if (existing.user_id !== userId) {
      throw new ForbiddenException('Anda tidak memiliki akses ke catatan ini');
    }

    const updated = await this.prisma.catatan_pribadi.update({
      where: { id },
      data: {
        status: 'active',
        trashed_at: null,
        version: { increment: 1 },
        updated_at: new Date(),
      },
    });

    return serializeCatatan(updated);
  }

  /**
   * Permanently delete note (only allowed from trash)
   */
  async remove(userId: bigint, idStr: string) {
    const id = this.parseBigIntId(idStr, 'ID Catatan');
    const existing = await this.prisma.catatan_pribadi.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException('Catatan tidak ditemukan');
    }

    if (existing.user_id !== userId) {
      throw new ForbiddenException('Anda tidak memiliki akses ke catatan ini');
    }

    if (existing.status !== 'trashed') {
      throw new BadRequestException(
        'Hanya catatan di dalam sampah (trash) yang dapat dihapus permanen',
      );
    }

    await this.prisma.catatan_pribadi.delete({
      where: { id },
    });

    return { message: 'Catatan berhasil dihapus permanen' };
  }

  /**
   * Get draft agenda items for a calendar month
   */
  async getKalender(userId: bigint, bulan: string) {
    const { start, end } = rentangBulan(bulan);

    const data = await this.prisma.catatan_pribadi.findMany({
      where: {
        user_id: userId,
        jenis: 'draft_agenda',
        status: { in: ['active', 'pinned'] },
        tanggal_agenda: {
          gte: start,
          lte: end,
        },
      },
      orderBy: [
        { tanggal_agenda: 'asc' },
        { waktu_agenda: 'asc' },
        { id: 'asc' },
      ],
    });

    return data.map(serializeCatatan);
  }

  /**
   * Get unique labels for user
   */
  async getLabels(userId: bigint) {
    const notes = await this.prisma.catatan_pribadi.findMany({
      where: {
        user_id: userId,
        status: { not: 'trashed' },
      },
      select: { label: true },
    });

    const labelSet = new Set<string>();
    for (const note of notes) {
      if (Array.isArray(note.label)) {
        for (const item of note.label) {
          if (typeof item === 'string' && item.trim()) {
            labelSet.add(item.trim());
          }
        }
      }
    }

    return Array.from(labelSet).sort((a, b) => a.localeCompare(b));
  }

  /**
   * Export notes data (by IDs or month) for PDF export
   */
  async exportData(userId: bigint, body: { ids?: any[]; bulan?: string }) {
    if (body?.ids && Array.isArray(body.ids) && body.ids.length > 0) {
      const ids = body.ids.map((id) => this.parseBigIntId(id, 'ID Catatan'));
      const notes = await this.prisma.catatan_pribadi.findMany({
        where: {
          id: { in: ids },
        },
      });

      // Verify ownership for all requested notes
      for (const note of notes) {
        if (note.user_id !== userId) {
          throw new ForbiddenException(
            'Anda tidak memiliki akses ke salah satu catatan yang dipilih',
          );
        }
      }

      const userNotes = notes.filter((n) => n.user_id === userId);
      userNotes.sort((a, b) => {
        const aPinned = a.status === 'pinned';
        const bPinned = b.status === 'pinned';
        if (aPinned && !bPinned) return -1;
        if (!aPinned && bPinned) return 1;
        return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
      });

      return userNotes.map(serializeCatatan);
    }

    if (body?.bulan) {
      const { start, end } = rentangBulan(body.bulan);
      const notes = await this.prisma.catatan_pribadi.findMany({
        where: {
          user_id: userId,
          status: { not: 'trashed' },
          OR: [
            {
              jenis: 'draft_agenda',
              tanggal_agenda: { gte: start, lte: end },
            },
            {
              created_at: { gte: start, lte: end },
            },
          ],
        },
        orderBy: [{ status: 'desc' }, { updated_at: 'desc' }],
      });

      notes.sort((a, b) => {
        const aPinned = a.status === 'pinned';
        const bPinned = b.status === 'pinned';
        if (aPinned && !bPinned) return -1;
        if (!aPinned && bPinned) return 1;
        return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
      });

      return notes.map(serializeCatatan);
    }

    // Default: return all active and pinned notes
    const notes = await this.prisma.catatan_pribadi.findMany({
      where: {
        user_id: userId,
        status: { in: ['active', 'pinned'] },
      },
      orderBy: [{ status: 'desc' }, { updated_at: 'desc' }],
    });

    notes.sort((a, b) => {
      const aPinned = a.status === 'pinned';
      const bPinned = b.status === 'pinned';
      if (aPinned && !bPinned) return -1;
      if (!aPinned && bPinned) return 1;
      return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
    });

    return notes.map(serializeCatatan);
  }
}
