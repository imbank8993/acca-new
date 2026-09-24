import { Injectable, BadRequestException, NotFoundException, Logger } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../common/storage.service';
import { AuditService } from '../common/audit.service';
import {
  AGENDA_KELOLA_KEY,
  LIBUR_ACCESS_KEY,
  FeatureAccessGuard,
  aksesDiizinkan,
} from '../auth/feature-access.guard';

/**
 * Terjemahkan `bulan` (YYYY-MM) jadi rentang tanggal.
 *
 * Nilai cacat dulu menghasilkan Invalid Date yang diteruskan apa adanya ke
 * Prisma dan berujung HTTP 500 — termasuk untuk `2026-9`, salah ketik yang
 * sangat wajar. Sekarang ditolak lebih awal sebagai 400.
 */
function rentangBulan(bulan: string): { start: Date; end: Date } {
  const cocok = /^(\d{4})-(\d{2})$/.exec(String(bulan).trim());
  if (!cocok) {
    throw new BadRequestException('Parameter bulan harus berformat YYYY-MM, mis. 2026-09');
  }
  const tahun = Number(cocok[1]);
  const bln = Number(cocok[2]);
  if (bln < 1 || bln > 12) {
    throw new BadRequestException('Bulan harus di antara 01 sampai 12');
  }
  // Kolomnya `@db.Date`; pakai UTC di kedua ujung agar batas rentang tidak
  // bergeser mengikuti zona waktu server.
  const start = new Date(Date.UTC(tahun, bln - 1, 1, 0, 0, 0, 0));
  const end = new Date(Date.UTC(tahun, bln, 0, 23, 59, 59, 999));
  return { start, end };
}

/** Jenis gambar yang diizinkan → ekstensi yang dipakai saat menyimpan. */
const EXT_PER_MIME: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
};

function toLocalISODate(d: Date | null) {
  if (!d) return null;
  if (typeof d === 'string') return (d as string).slice(0, 10);
  return d.toISOString().slice(0, 10);
}

function toLocalISOTime(d: Date | null) {
  if (!d) return null;
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function formatAgenda(item: any) {
  return {
    ...item,
    id: item.id ? item.id.toString() : item.id,
    tanggal_mulai: toLocalISODate(item.tanggal_mulai),
    tanggal_selesai: toLocalISODate(item.tanggal_selesai),
    waktu_mulai: toLocalISOTime(item.waktu_mulai),
    waktu_selesai: toLocalISOTime(item.waktu_selesai),
  };
}

@Injectable()
export class AgendaService {
  private readonly logger = new Logger(AgendaService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly featureAccess: FeatureAccessGuard,
    private readonly audit?: AuditService,
  ) {}

  /**
   * Helper parsing ID numerik aman (mencegah unhandled BigInt exception HTTP 500).
   */
  private parseBigIntId(id: any, label = 'ID'): bigint {
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

  /**
   * Helper parsing format tanggal YYYY-MM-DD aman (mencegah unhandled Invalid Date).
   */
  private parseDateOnly(d: any, label: string): Date {
    if (!d) throw new BadRequestException(`${label} wajib diisi`);
    const date = new Date(d);
    if (isNaN(date.getTime())) {
      throw new BadRequestException(`Format ${label} tidak valid: ${d}`);
    }
    return date;
  }

  /**
   * Helper parsing waktu aman (HH:mm atau HH:mm:ss).
   */
  private parseTimeOnly(t: any, label: string): Date | null {
    if (!t) return null;
    const s = String(t).trim();
    const timeStr = s.includes('T') ? s : `1970-01-01T${s.length === 5 ? s + ':00' : s}`;
    const date = new Date(timeStr);
    if (isNaN(date.getTime())) {
      throw new BadRequestException(`Format ${label} tidak valid: ${t}`);
    }
    return date;
  }

  /**
   * Hak kelola agenda: ADMIN melekat di kode, selebihnya — termasuk OP_AGENDA —
   * diatur admin lewat Pengaturan Users → Hak Akses Fitur.
   */
  async bolehKelola(user: any): Promise<boolean> {
    const konfig = await this.featureAccess.bacaKonfigurasi(AGENDA_KELOLA_KEY);
    return aksesDiizinkan(user, konfig, ['OP_AGENDA']);
  }

  /**
   * Hak kelola data libur: ADMIN dan OP_JURNAL melekat di kode, selebihnya
   * diatur admin lewat Pengaturan Users → Hak Akses Fitur.
   */
  async bolehKelolaLibur(user: any): Promise<boolean> {
    const konfig = await this.featureAccess.bacaKonfigurasi(LIBUR_ACCESS_KEY);
    return aksesDiizinkan(user, konfig, ['OP_JURNAL']);
  }

  async getIzinAgenda(user: any) {
    return {
      success: true,
      data: {
        bolehKelola: await this.bolehKelola(user),
        bolehKelolaLibur: await this.bolehKelolaLibur(user),
      },
    };
  }

  // AGENDA MADRASAH
  async getPublicAgendas(bulan?: string, limit = 50) {
    const where: any = { is_publik: true };
    if (bulan) {
      const { start, end } = rentangBulan(bulan);
      where.tanggal_mulai = { lte: end };
      where.OR = [
        { tanggal_selesai: { gte: start } },
        { tanggal_mulai: { gte: start } },
      ];
    }

    const data = await this.prisma.agenda_akademik.findMany({
      where,
      orderBy: { tanggal_mulai: 'asc' },
      take: limit,
    });

    return data.map(formatAgenda);
  }

  async getAgendas(bulan?: string) {
    let where: any = {};
    if (bulan) {
      const { start, end } = rentangBulan(bulan);

      where = {
        OR: [
          {
            tanggal_mulai: { lte: end },
            tanggal_selesai: { gte: start },
          },
          {
            tanggal_mulai: { gte: start, lte: end },
          }
        ]
      };
    }

    const data = await this.prisma.agenda_akademik.findMany({
      where,
      orderBy: [{ tanggal_mulai: 'desc' }, { id: 'desc' }],
    });
    return data.map(formatAgenda);
  }

  async createAgenda(body: any, user?: any, req?: any) {
    const { judul, deskripsi, tanggal_mulai, tanggal_selesai, waktu_mulai, waktu_selesai, lokasi, kategori, warna, is_publik, skip_hari_libur } = body;
    if (!judul || typeof judul !== 'string' || !judul.trim()) {
      throw new BadRequestException('Judul agenda wajib diisi');
    }
    const tglMulai = this.parseDateOnly(tanggal_mulai, 'tanggal_mulai');
    let tglSelesai: Date | null = null;
    if (tanggal_selesai) {
      tglSelesai = this.parseDateOnly(tanggal_selesai, 'tanggal_selesai');
      if (tglSelesai.getTime() < tglMulai.getTime()) {
        throw new BadRequestException('Tanggal selesai tidak boleh lebih awal dari tanggal mulai');
      }
    }

    const wktMulai = this.parseTimeOnly(waktu_mulai, 'waktu_mulai');
    const wktSelesai = this.parseTimeOnly(waktu_selesai, 'waktu_selesai');

    const data = await this.prisma.agenda_akademik.create({
      data: {
        judul: judul.trim(),
        deskripsi: deskripsi ? String(deskripsi).trim() : null,
        tanggal_mulai: tglMulai,
        tanggal_selesai: tglSelesai,
        waktu_mulai: wktMulai,
        waktu_selesai: wktSelesai,
        lokasi: lokasi ? String(lokasi).trim() : null,
        kategori: kategori ? String(kategori).trim() : 'Umum',
        warna: warna ? String(warna).trim() : '#3083FF',
        is_publik: is_publik !== false,
        skip_hari_libur: !!skip_hari_libur,
      },
    });

    if (this.audit) {
      await this.audit.record({
        user,
        req,
        action: 'CREATE_AGENDA',
        entity: 'agenda_akademik',
        entityId: data.id.toString(),
        details: {
          judul: data.judul,
          kategori: data.kategori,
          tanggal_mulai: toLocalISODate(data.tanggal_mulai),
          tanggal_selesai: toLocalISODate(data.tanggal_selesai),
          is_publik: data.is_publik,
        },
      });
    }

    return formatAgenda(data);
  }

  async updateAgenda(body: any, user?: any, req?: any) {
    const idBigInt = this.parseBigIntId(body?.id, 'ID Agenda');
    const { judul, deskripsi, tanggal_mulai, tanggal_selesai, waktu_mulai, waktu_selesai, lokasi, kategori, warna, is_publik, skip_hari_libur } = body;
    if (!judul || typeof judul !== 'string' || !judul.trim()) {
      throw new BadRequestException('Judul agenda wajib diisi');
    }
    const tglMulai = this.parseDateOnly(tanggal_mulai, 'tanggal_mulai');
    let tglSelesai: Date | null = null;
    if (tanggal_selesai) {
      tglSelesai = this.parseDateOnly(tanggal_selesai, 'tanggal_selesai');
      if (tglSelesai.getTime() < tglMulai.getTime()) {
        throw new BadRequestException('Tanggal selesai tidak boleh lebih awal dari tanggal mulai');
      }
    }

    const wktMulai = this.parseTimeOnly(waktu_mulai, 'waktu_mulai');
    const wktSelesai = this.parseTimeOnly(waktu_selesai, 'waktu_selesai');

    const data = await this.prisma.agenda_akademik.update({
      where: { id: idBigInt },
      data: {
        judul: judul.trim(),
        deskripsi: deskripsi ? String(deskripsi).trim() : null,
        tanggal_mulai: tglMulai,
        tanggal_selesai: tglSelesai,
        waktu_mulai: wktMulai,
        waktu_selesai: wktSelesai,
        lokasi: lokasi ? String(lokasi).trim() : null,
        kategori: kategori ? String(kategori).trim() : 'Umum',
        warna: warna ? String(warna).trim() : '#3083FF',
        is_publik: is_publik !== false,
        skip_hari_libur: !!skip_hari_libur,
      },
    });

    if (this.audit) {
      await this.audit.record({
        user,
        req,
        action: 'UPDATE_AGENDA',
        entity: 'agenda_akademik',
        entityId: data.id.toString(),
        details: {
          judul: data.judul,
          kategori: data.kategori,
          tanggal_mulai: toLocalISODate(data.tanggal_mulai),
          tanggal_selesai: toLocalISODate(data.tanggal_selesai),
          is_publik: data.is_publik,
        },
      });
    }

    return formatAgenda(data);
  }

  async deleteAgenda(id: string, user?: any, req?: any) {
    const idBigInt = this.parseBigIntId(id, 'ID Agenda');

    const agenda = await this.prisma.agenda_akademik.findUnique({
      where: { id: idBigInt },
      select: { id: true, judul: true, kategori: true, foto: true }
    });
    if (!agenda) throw new NotFoundException('Agenda tidak ditemukan');
    
    if (agenda && Array.isArray(agenda.foto)) {
      for (const f of agenda.foto) {
        if (!(f as any)?.url) continue;
        const url = (f as any).url;
        const { error } = await this.storage.removeByUrl(url);
        if (error) this.logger.warn(`Gagal menghapus berkas foto ${url}: ${error.message}`);
        await this.unregisterUpload(url);
      }
    }

    await this.prisma.agenda_akademik.delete({
      where: { id: idBigInt },
    });

    if (this.audit) {
      await this.audit.record({
        user,
        req,
        action: 'DELETE_AGENDA',
        entity: 'agenda_akademik',
        entityId: idBigInt.toString(),
        details: {
          judul: agenda.judul,
          kategori: agenda.kategori,
        },
      });
    }

    return { success: true };
  }

  // KATEGORI AGENDA
  async getKategori() {
    const list = await this.prisma.master_agenda_kategori.findMany({
      orderBy: { nama: 'asc' },
    });
    return list.map((k) => ({
      ...k,
      id: k.id.toString(),
    }));
  }

  async createKategori(body: any, user?: any, req?: any) {
    const { nama, color, icon } = body;
    if (!nama || typeof nama !== 'string' || !nama.trim()) {
      throw new BadRequestException('Nama kategori wajib diisi');
    }

    const data = await this.prisma.master_agenda_kategori.create({
      data: {
        nama: nama.trim(),
        color: color ? String(color).trim() : '#0038A8',
        icon: icon ? String(icon).trim() : 'bi-calendar-event',
      },
    });

    if (this.audit) {
      await this.audit.record({
        user,
        req,
        action: 'CREATE_AGENDA_KATEGORI',
        entity: 'master_agenda_kategori',
        entityId: data.id.toString(),
        details: { nama: data.nama, color: data.color, icon: data.icon },
      });
    }

    return {
      ...data,
      id: data.id.toString(),
    };
  }

  async updateKategori(body: any, user?: any, req?: any) {
    const idBigInt = this.parseBigIntId(body?.id, 'ID Kategori');
    const { nama, color, icon } = body;
    if (!nama || typeof nama !== 'string' || !nama.trim()) {
      throw new BadRequestException('Nama kategori wajib diisi');
    }

    const existingKat = await this.prisma.master_agenda_kategori.findUnique({
      where: { id: idBigInt },
    });

    const data = await this.prisma.master_agenda_kategori.update({
      where: { id: idBigInt },
      data: {
        nama: nama.trim(),
        color: color ? String(color).trim() : undefined,
        icon: icon ? String(icon).trim() : undefined,
      },
    });

    if (existingKat) {
      const oldNama = existingKat.nama;
      const newNama = nama.trim();
      const newWarna = color ? String(color).trim() : existingKat.color;
      await this.prisma.agenda_akademik.updateMany({
        where: { kategori: oldNama },
        data: {
          kategori: newNama,
          warna: newWarna,
        },
      });
    }

    if (this.audit) {
      await this.audit.record({
        user,
        req,
        action: 'UPDATE_AGENDA_KATEGORI',
        entity: 'master_agenda_kategori',
        entityId: data.id.toString(),
        details: { nama: data.nama, color: data.color, icon: data.icon },
      });
    }

    return {
      ...data,
      id: data.id.toString(),
    };
  }

  async deleteKategori(id: string, user?: any, req?: any) {
    const idBigInt = this.parseBigIntId(id, 'ID Kategori');

    const existing = await this.prisma.master_agenda_kategori.findUnique({
      where: { id: idBigInt },
    });
    if (!existing) throw new NotFoundException('Kategori tidak ditemukan');

    await this.prisma.master_agenda_kategori.delete({
      where: { id: idBigInt },
    });

    if (this.audit) {
      await this.audit.record({
        user,
        req,
        action: 'DELETE_AGENDA_KATEGORI',
        entity: 'master_agenda_kategori',
        entityId: idBigInt.toString(),
        details: { nama: existing.nama },
      });
    }

    return { success: true };
  }

  // FOTO AGENDA
  private parseFoto(raw: any) {
    if (!Array.isArray(raw)) return [];
    return raw
      .filter((f: any) => f && typeof f.url === 'string')
      .map((f: any) => ({ url: f.url, caption: f.caption || null, tanggal: f.tanggal || null }));
  }

  async uploadFoto(agendaId: any, files: any[], captions: string[], tanggals: string[], user?: any, req?: any) {
    const agendaIdBigInt = this.parseBigIntId(agendaId, 'agenda_id');
    const MAX_FOTO = 10;
    const MAX_SIZE_BYTES = 5 * 1024 * 1024;
    // Satu sumber kebenaran dengan EXT_PER_MIME agar keduanya tak bisa berbeda.

    const existingAgenda = await this.prisma.agenda_akademik.findUnique({
      where: { id: agendaIdBigInt },
      select: { id: true, judul: true, foto: true }
    });

    if (!existingAgenda) throw new NotFoundException('Agenda tidak ditemukan');
    const existing = this.parseFoto(existingAgenda.foto);

    if (existing.length + files.length > MAX_FOTO) {
      throw new BadRequestException(`Maksimal ${MAX_FOTO} foto per agenda`);
    }

    for (const file of files) {
      if (!EXT_PER_MIME[file.mimetype]) {
        throw new BadRequestException(`Format ${file.mimetype} tidak didukung (hanya JPG/PNG/WebP/GIF)`);
      }
      if (file.size > MAX_SIZE_BYTES) {
        throw new BadRequestException(`Ukuran file melebihi 5MB`);
      }
    }

    const uploaded = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      // Ekstensi diturunkan dari jenis berkas yang SUDAH lolos allowlist, bukan
      // dari nama kiriman klien. `originalname.split('.').pop()` dulu meloloskan
      // apa saja — termasuk `php`, `svg`, bahkan nilai bergaris miring seperti
      // `/evil` (dari "a../../../evil") yang menyelipkan path ke luar folder.
      const ext = EXT_PER_MIME[file.mimetype] || 'jpg';
      const fileName = `${Date.now()}_${randomBytes(6).toString('hex')}.${ext}`;
      const filePath = `agenda/${agendaIdBigInt.toString()}/${fileName}`;

      const { error: uploadError } = await this.storage
        .from('documents')
        .upload(filePath, file.buffer, { contentType: file.mimetype, upsert: false });
      
      if (uploadError) throw new BadRequestException(uploadError.message);

      const { data: { publicUrl } } = this.storage.from('documents').getPublicUrl(filePath);
      uploaded.push({ 
        url: publicUrl, 
        caption: captions[i]?.trim() || null, 
        tanggal: tanggals[i]?.trim() || null 
      });

      await this.registerUpload({
        file_url: publicUrl,
        file_name: file.originalname,
        folder: 'agenda',
        size_bytes: file.size,
        storage_type: 'cloudflare',
      });
    }

    const newFoto = [...existing, ...uploaded];
    await this.prisma.agenda_akademik.update({
      where: { id: agendaIdBigInt },
      data: { foto: newFoto as any }
    });

    if (this.audit) {
      await this.audit.record({
        user,
        req,
        action: 'UPLOAD_AGENDA_FOTO',
        entity: 'agenda_akademik',
        entityId: agendaIdBigInt.toString(),
        details: {
          judul: existingAgenda.judul,
          jumlah_foto: files.length,
          files: uploaded.map(u => ({ url: u.url, caption: u.caption })),
        },
      });
    }

    return newFoto;
  }

  async updateFotoUrutan(body: any, user?: any, req?: any) {
    const agendaIdBigInt = this.parseBigIntId(body?.agenda_id, 'agenda_id');
    const MAX_FOTO = 10;

    const existingAgenda = await this.prisma.agenda_akademik.findUnique({
      where: { id: agendaIdBigInt },
      select: { id: true, judul: true, foto: true }
    });
    if (!existingAgenda) throw new NotFoundException('Agenda tidak ditemukan');

    const existing = this.parseFoto(existingAgenda.foto);
    const existingUrls = new Set(existing.map((f: any) => f.url));

    const newFoto = this.parseFoto(body.foto)
      .filter((f: any) => existingUrls.has(f.url))
      .slice(0, MAX_FOTO);

    await this.prisma.agenda_akademik.update({
      where: { id: agendaIdBigInt },
      data: { foto: newFoto as any }
    });

    if (this.audit) {
      await this.audit.record({
        user,
        req,
        action: 'UPDATE_AGENDA_FOTO_ORDER',
        entity: 'agenda_akademik',
        entityId: agendaIdBigInt.toString(),
        details: {
          judul: existingAgenda.judul,
          total_foto: newFoto.length,
        },
      });
    }

    return newFoto;
  }

  async deleteFoto(agendaId: string, url: string, user?: any, req?: any) {
    const agendaIdBigInt = this.parseBigIntId(agendaId, 'agenda_id');

    const existingAgenda = await this.prisma.agenda_akademik.findUnique({
      where: { id: agendaIdBigInt },
      select: { id: true, judul: true, foto: true }
    });
    if (!existingAgenda) throw new NotFoundException('Agenda tidak ditemukan');

    const existing = this.parseFoto(existingAgenda.foto);
    const target = existing.find((f: any) => f.url === url);
    if (!target) throw new NotFoundException('Foto tidak ditemukan pada agenda ini');

    const { error } = await this.storage.removeByUrl(url);
    if (error) this.logger.warn(`Gagal menghapus berkas foto ${url}: ${error.message}`);
    await this.unregisterUpload(url);

    const newFoto = existing.filter((f: any) => f.url !== url);
    await this.prisma.agenda_akademik.update({
      where: { id: agendaIdBigInt },
      data: { foto: newFoto as any }
    });

    if (this.audit) {
      await this.audit.record({
        user,
        req,
        action: 'DELETE_AGENDA_FOTO',
        entity: 'agenda_akademik',
        entityId: agendaIdBigInt.toString(),
        details: {
          judul: existingAgenda.judul,
          url,
        },
      });
    }

    return newFoto;
  }

  private async registerUpload(entry: any) {
    if (!entry.file_url) return;
    try {
      await this.prisma.file_uploads.upsert({
        where: { file_url: entry.file_url },
        create: {
          file_url: entry.file_url,
          file_name: entry.file_name || null,
          folder: entry.folder || 'general',
          size_bytes: entry.size_bytes ? BigInt(entry.size_bytes) : BigInt(0),
          storage_type: entry.storage_type || null,
        },
        update: {
          file_name: entry.file_name || null,
          folder: entry.folder || 'general',
          size_bytes: entry.size_bytes ? BigInt(entry.size_bytes) : BigInt(0),
          storage_type: entry.storage_type || null,
        },
      });
    } catch (err) {
      // ignore
    }
  }

  private async unregisterUpload(fileUrl: string) {
    if (!fileUrl) return;
    try {
      await this.prisma.file_uploads.deleteMany({
        where: { file_url: fileUrl },
      });
    } catch (err) {
      // ignore
    }
  }
}

