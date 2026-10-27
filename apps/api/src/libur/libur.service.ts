import {
  Injectable,
  BadRequestException,
  NotFoundException,
  BadGatewayException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  DEFAULT_ICS_URL,
  parseIcsLibur,
  rentangTanggalNasional,
  type EventLiburNasional,
} from './libur-nasional';

/** Feed Google jarang berubah; cukup diambil ulang tiap 6 jam (atau saat diminta). */
const CACHE_NASIONAL_MS = 6 * 60 * 60 * 1000;
const BATAS_ITEM_SINKRON = 200;
const BATAS_HARI_PER_ITEM = 31;

/** Tanggal saja (YYYY-MM-DD) dari kolom `@db.Date` yang dibaca sebagai UTC. */
function toDateOnly(d: Date | string | null | undefined): string {
  if (!d) return '';
  if (typeof d === 'string') return d.slice(0, 10);
  return d.toISOString().slice(0, 10);
}

/**
 * `YYYY-MM-DD` → Date tengah malam UTC, cocok dengan cara kolom `@db.Date`
 * dibaca kembali oleh `toDateOnly`. `new Date(str)` sendiri sudah UTC, tapi
 * dieksplisitkan supaya tidak ada yang menggantinya dengan konstruktor lokal.
 */
function dateOnlyToUtc(tanggal: string): Date {
  const [y, m, d] = tanggal.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

/**
 * Daftar tanggal `mulai`..`selesai` inklusif.
 *
 * Aritmetikanya murni UTC. Versi lama memakai `cur.setDate(cur.getDate() + 1)`
 * pada Date yang dibuat sebagai tengah malam UTC lalu membacanya kembali dengan
 * `toISOString()` — campuran zona lokal & UTC yang kebetulan benar di WITA
 * (UTC+8) tapi menggeser satu hari di zona ber-offset negatif.
 */
function rentangTanggal(mulai: string, selesai: string): string[] {
  const akhir = dateOnlyToUtc(selesai).getTime();
  const hasil: string[] = [];
  for (let t = dateOnlyToUtc(mulai).getTime(); t <= akhir; t += 86_400_000) {
    hasil.push(new Date(t).toISOString().slice(0, 10));
  }
  return hasil;
}

/** Lingkup yang valid; selain itu diperlakukan sebagai 'semua'. */
type Lingkup = 'semua' | 'tingkat' | 'kelas';

/** Sejajar dengan `parseTargetKelas` di apps/web/lib/libur.ts. */
function parseTargetKelas(value: unknown): string[] {
  if (Array.isArray(value)) return value.map((v) => String(v).trim()).filter(Boolean);
  if (typeof value === 'string') {
    const raw = value.trim();
    if (!raw) return [];
    const inner = raw.startsWith('{') && raw.endsWith('}') ? raw.slice(1, -1) : raw;
    return inner
      .split(',')
      .map((v) => v.trim().replace(/^"|"$/g, ''))
      .filter(Boolean);
  }
  return [];
}

/**
 * Lingkup efektif + targetnya. Target kosong selalu jatuh ke 'semua' supaya
 * baris tanpa target tidak pernah tersimpan sebagai libur "sebagian" yang
 * kenyataannya tidak meliburkan siapa pun.
 */
function normalisasiLingkup(body: any): { lingkup: Lingkup; target_kelas: string[] } {
  const raw = String(body?.lingkup ?? '').trim().toLowerCase();
  const target = parseTargetKelas(body?.target_kelas);
  if ((raw === 'tingkat' || raw === 'kelas') && target.length > 0) {
    return { lingkup: raw, target_kelas: target };
  }
  return { lingkup: 'semua', target_kelas: [] };
}

/** Normalisasi `jam_ke` jadi daftar jam; kosong/'semua' → ['Semua']. */
function parseJamKe(jamRaw: unknown): string[] {
  if (!jamRaw || String(jamRaw).toLowerCase() === 'semua') return ['Semua'];
  const list = Array.isArray(jamRaw)
    ? jamRaw.map(String).map((s) => s.trim())
    : String(jamRaw)
        .split(',')
        .map((s) => s.trim());
  const bersih = list.filter(Boolean);
  return bersih.length > 0 ? bersih : ['Semua'];
}

function bigIntAman(value: unknown, pesan: string): bigint {
  const raw = String(value ?? '').trim();
  if (!raw || !/^\d+$/.test(raw)) throw new BadRequestException(pesan);
  return BigInt(raw);
}

/**
 * Kalender hari libur madrasah.
 *
 * Sebelumnya menumpang di modul `jadwal` padahal pemakainya jauh lebih luas —
 * halaman Agenda (tab Data Libur), Jurnal, Jadwal, Absensi, Guru Asuh, dan
 * Wali Kelas. Dipisah agar kepemilikannya jelas dan otorisasinya punya satu
 * tempat yang jelas untuk dipasang (lihat `assertCanWrite` di controller).
 */
@Injectable()
export class LiburService {
  constructor(private readonly prisma: PrismaService) {}

  /** Bentuk baris yang dikirim ke klien. */
  private serialize(r: {
    id: bigint;
    tanggal: Date;
    jam_ke: string | null;
    keterangan: string;
    lingkup?: string | null;
    target_kelas?: string[];
    created_at?: Date | null;
  }) {
    return {
      id: r.id.toString(),
      tanggal: toDateOnly(r.tanggal),
      jam_ke: r.jam_ke || 'Semua',
      keterangan: r.keterangan,
      // Dikembalikan apa adanya: klien (lib/libur.ts) yang memutuskan baris
      // lama ber-lingkup NULL dibaca sebagai 'semua'.
      lingkup: r.lingkup ?? null,
      target_kelas: r.target_kelas ?? [],
      created_at: r.created_at ? r.created_at.toISOString() : null,
    };
  }

  async getLibur(params: {
    q?: string;
    tahun?: string;
    tahun_ajaran?: string;
    start?: string;
    end?: string;
    limit?: string | number;
  }) {
    const { q, tahun, tahun_ajaran, start, end } = params;
    const limit = Math.min(Math.max(Number(params.limit) || 2000, 1), 5000);

    const where: any = {};

    if (q) {
      where.keterangan = { contains: q, mode: 'insensitive' };
    }

    if (start && end) {
      where.tanggal = {
        gte: new Date(start),
        lte: new Date(end),
      };
    } else if (tahun && /^\d{4}$/.test(tahun)) {
      where.tanggal = {
        gte: new Date(`${tahun}-01-01`),
        lte: new Date(`${tahun}-12-31`),
      };
    } else if (tahun_ajaran && tahun_ajaran !== 'Semua') {
      const parts = tahun_ajaran.split('/');
      if (parts.length === 2) {
        const y1 = parseInt(parts[0], 10);
        const y2 = parseInt(parts[1], 10);
        if (y1 && y2) {
          where.tanggal = {
            gte: new Date(`${y1}-07-01`),
            lte: new Date(`${y2}-06-30`),
          };
        }
      }
    }

    const rows = await this.prisma.libur.findMany({
      where,
      orderBy: { tanggal: 'desc' },
      take: limit,
    });

    const data = rows.map((r) => this.serialize(r));

    return {
      ok: true,
      data,
      meta: { total: data.length, limit },
    };
  }

  async createLibur(body: any) {
    const items: any[] = Array.isArray(body)
      ? body
      : Array.isArray(body?.items)
        ? body.items
        : [body];

    if (items.length === 0) {
      throw new BadRequestException('Tidak ada data yang dikirim');
    }

    type Baris = {
      tanggal: string;
      jam_ke: string;
      keterangan: string;
      lingkup: Lingkup;
      target_kelas: string[];
    };

    const rowsToProcess: Baris[] = [];
    const errors: string[] = [];

    for (const item of items) {
      const mulai = String(item?.tanggal || item?.tanggal_mulai || '').trim();
      const selesai = String(item?.tanggal_selesai || mulai).trim() || mulai;
      const keterangan = String(item?.keterangan || '').trim();

      if (!mulai || !/^\d{4}-\d{2}-\d{2}$/.test(mulai)) {
        errors.push(`Format tanggal mulai tidak valid: ${mulai}`);
        continue;
      }
      if (!selesai || !/^\d{4}-\d{2}-\d{2}$/.test(selesai)) {
        errors.push(`Format tanggal selesai tidak valid: ${selesai}`);
        continue;
      }
      if (selesai < mulai) {
        errors.push(`Tanggal selesai (${selesai}) mendahului tanggal mulai (${mulai})`);
        continue;
      }
      if (!keterangan) {
        errors.push(`Keterangan wajib diisi untuk tanggal ${mulai}`);
        continue;
      }

      const { lingkup, target_kelas } = normalisasiLingkup(item);

      for (const tgl of rentangTanggal(mulai, selesai)) {
        for (const j of parseJamKe(item?.jam_ke)) {
          rowsToProcess.push({ tanggal: tgl, jam_ke: j, keterangan, lingkup, target_kelas });
        }
      }
    }

    if (rowsToProcess.length === 0) {
      throw new BadRequestException(errors[0] || 'Tidak ada baris libur valid untuk disimpan');
    }

    // Satu query untuk seluruh tanggal yang tersentuh, bukan findFirst per baris.
    // Impor setahun × belasan jam pelajaran sebelumnya berarti ribuan query
    // berurutan — cukup untuk membuat request timeout di tengah jalan.
    const tanggalUnik = [...new Set(rowsToProcess.map((r) => r.tanggal))];
    const existingRows = await this.prisma.libur.findMany({
      where: { tanggal: { in: tanggalUnik.map(dateOnlyToUtc) } },
    });
    const kunci = (tanggal: string, jam: string) => `${tanggal}|${jam}`;
    const existingMap = new Map(
      existingRows.map((r) => [kunci(toDateOnly(r.tanggal), r.jam_ke || 'Semua'), r]),
    );

    const perluDibuat: Baris[] = [];
    const perluDiubah: { id: bigint; row: Baris }[] = [];
    let skipped = 0;

    for (const r of rowsToProcess) {
      const existing = existingMap.get(kunci(r.tanggal, r.jam_ke));
      if (!existing) {
        perluDibuat.push(r);
        continue;
      }
      const sama =
        existing.keterangan === r.keterangan &&
        (existing.lingkup ?? 'semua') === r.lingkup &&
        (existing.target_kelas ?? []).join(',') === r.target_kelas.join(',');
      if (sama) skipped++;
      else perluDiubah.push({ id: existing.id, row: r });
    }

    // Transaksi: kegagalan di tengah tidak boleh menyisakan separuh rentang
    // tanggal tersimpan — persis mode gagal yang membuat pengguna melihat
    // "tersimpan" padahal sebagian datanya hilang.
    await this.prisma.$transaction(async (tx) => {
      if (perluDibuat.length > 0) {
        await tx.libur.createMany({
          data: perluDibuat.map((r) => ({
            tanggal: dateOnlyToUtc(r.tanggal),
            jam_ke: r.jam_ke,
            keterangan: r.keterangan,
            lingkup: r.lingkup,
            target_kelas: r.target_kelas,
          })),
        });
      }
      for (const { id, row } of perluDiubah) {
        await tx.libur.update({
          where: { id },
          data: {
            keterangan: row.keterangan,
            lingkup: row.lingkup,
            target_kelas: row.target_kelas,
          },
        });
      }
    });

    return {
      ok: true,
      created: perluDibuat.length,
      updated: perluDiubah.length,
      total: rowsToProcess.length,
      skipped,
      errors,
    };
  }

  async updateLibur(idOrBodyId: string | number, body: any) {
    const id = bigIntAman(idOrBodyId ?? body?.id, 'ID libur wajib diisi dan harus berupa angka');

    const tglStr = String(body.tanggal || '').trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(tglStr)) {
      throw new BadRequestException('Tanggal wajib diisi dengan format YYYY-MM-DD');
    }

    const keterangan = String(body.keterangan || '').trim();
    if (!keterangan) throw new BadRequestException('Keterangan wajib diisi');

    const { lingkup, target_kelas } = normalisasiLingkup(body);
    const jamList = parseJamKe(body.jam_ke);
    const tanggal = dateOnlyToUtc(tglStr);

    const existing = await this.prisma.libur.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Data libur tidak ditemukan');
    }

    const dataBersama = { keterangan, lingkup, target_kelas };

    // Satu baris = satu (tanggal, jam). Kalau pengguna memilih beberapa jam saat
    // mengedit, jamnya harus dipecah jadi beberapa baris — sama seperti jalur
    // tambah. Versi lama menyimpan "1,2" mentah ke satu baris, dan pembaca yang
    // membandingkan `jam_ke === '1'` tidak akan pernah cocok.
    const [jamUtama, ...jamTambahan] = jamList;

    const updated = await this.prisma.$transaction(async (tx) => {
      const utama = await tx.libur.update({
        where: { id },
        data: { tanggal, jam_ke: jamUtama, ...dataBersama },
      });

      for (const jam of jamTambahan) {
        const lain = await tx.libur.findFirst({
          where: { tanggal, jam_ke: jam, id: { not: id } },
        });
        if (lain) {
          await tx.libur.update({ where: { id: lain.id }, data: dataBersama });
        } else {
          await tx.libur.create({ data: { tanggal, jam_ke: jam, ...dataBersama } });
        }
      }

      return utama;
    });

    return {
      ok: true,
      data: this.serialize(updated),
      /** Jumlah baris tambahan yang dibuat/diselaraskan untuk jam lainnya. */
      extra_jam: jamTambahan.length,
    };
  }

  /* ------------------------- Libur nasional (Google) ------------------------- */

  private cacheNasional: { url: string; at: number; events: EventLiburNasional[] } | null = null;

  private async ambilFeedNasional(segarkan: boolean): Promise<{ url: string; events: EventLiburNasional[] }> {
    const url = (process.env.LIBUR_NASIONAL_ICS_URL || '').trim() || DEFAULT_ICS_URL;
    const c = this.cacheNasional;
    if (!segarkan && c && c.url === url && Date.now() - c.at < CACHE_NASIONAL_MS) {
      return { url, events: c.events };
    }

    let teks: string;
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(15_000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      teks = await res.text();
    } catch (err: any) {
      throw new BadGatewayException(
        `Kalender libur nasional Google tidak dapat diambil (${err?.message || err}). ` +
          'Pastikan server API punya akses internet ke calendar.google.com.',
      );
    }
    if (!teks.includes('BEGIN:VCALENDAR')) {
      throw new BadGatewayException('Respons kalender Google bukan format iCal yang valid.');
    }

    const events = parseIcsLibur(teks);
    this.cacheNasional = { url, at: Date.now(), events };
    return { url, events };
  }

  /**
   * Pratinjau libur nasional untuk satu tahun kalender, lengkap dengan tanda
   * tanggal mana yang SUDAH punya data di tabel `libur` (apa pun lingkupnya).
   * Tidak menulis apa pun.
   */
  async getLiburNasional(params: { tahun?: string; segarkan?: string }) {
    const tahunIni = new Date(Date.now() + 8 * 3_600_000).getUTCFullYear(); // WITA
    const tahun = /^\d{4}$/.test(String(params.tahun || '')) ? Number(params.tahun) : tahunIni;
    const segarkan = ['1', 'true', 'ya'].includes(String(params.segarkan || '').toLowerCase());

    const { url, events } = await this.ambilFeedNasional(segarkan);

    const awal = `${tahun}-01-01`;
    const akhir = `${tahun}-12-31`;
    const dalamTahun = events.filter((e) => e.tanggal_mulai <= akhir && e.tanggal_selesai >= awal);

    const tahunTersedia = [...new Set(events.map((e) => Number(e.tanggal_mulai.slice(0, 4))))].sort();

    const existing = await this.prisma.libur.findMany({
      where: { tanggal: { gte: dateOnlyToUtc(awal), lte: dateOnlyToUtc(akhir) } },
      select: { tanggal: true, keterangan: true },
    });
    const terisiMap = new Map<string, Set<string>>();
    for (const r of existing) {
      const k = toDateOnly(r.tanggal);
      if (!terisiMap.has(k)) terisiMap.set(k, new Set());
      terisiMap.get(k)!.add(r.keterangan);
    }

    const items = dalamTahun.map((e) => {
      const tanggal = rentangTanggalNasional(e.tanggal_mulai, e.tanggal_selesai);
      const terisi = tanggal.filter((t) => terisiMap.has(t));
      const keteranganAda = [...new Set(terisi.flatMap((t) => [...(terisiMap.get(t) || [])]))];
      return {
        ...e,
        jumlah_hari: tanggal.length,
        tanggal_terisi: terisi,
        keterangan_terisi: keteranganAda,
        status: terisi.length === 0 ? 'baru' : terisi.length === tanggal.length ? 'sudah_ada' : 'sebagian',
      };
    });

    return {
      ok: true,
      data: { tahun, sumber: url, tahun_tersedia: tahunTersedia, items },
    };
  }

  /**
   * Simpan libur nasional pilihan admin sebagai libur sehari penuh untuk
   * seluruh madrasah. Tanggal yang sudah punya baris libur apa pun DILEWATI —
   * data yang diisi manual (mis. libur khusus kelas XII) tidak pernah ditimpa.
   */
  async sinkronNasional(body: any) {
    const items: any[] = Array.isArray(body?.items) ? body.items : Array.isArray(body) ? body : [];
    if (items.length === 0) throw new BadRequestException('Pilih minimal satu hari libur.');
    if (items.length > BATAS_ITEM_SINKRON) {
      throw new BadRequestException(`Maksimal ${BATAS_ITEM_SINKRON} item per sinkronisasi.`);
    }

    // tanggal → keterangan (beberapa acara di tanggal yang sama digabung)
    const perTanggal = new Map<string, string[]>();
    for (const it of items) {
      const mulai = String(it?.tanggal_mulai || it?.tanggal || '').trim();
      const selesai = String(it?.tanggal_selesai || mulai).trim();
      const ket = String(it?.keterangan || '').trim().slice(0, 200);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(mulai) || !/^\d{4}-\d{2}-\d{2}$/.test(selesai) || selesai < mulai) {
        throw new BadRequestException(`Tanggal tidak valid: ${mulai} s.d. ${selesai}`);
      }
      if (!ket) throw new BadRequestException(`Keterangan kosong untuk tanggal ${mulai}`);
      const awalUtc = dateOnlyToUtc(mulai);
      const akhirUtc = dateOnlyToUtc(selesai);
      if (!Number.isFinite(awalUtc.getTime()) || !Number.isFinite(akhirUtc.getTime())
        || toDateOnly(awalUtc) !== mulai || toDateOnly(akhirUtc) !== selesai) {
        throw new BadRequestException(`Tanggal kalender tidak valid: ${mulai} s.d. ${selesai}`);
      }
      if ((akhirUtc.getTime() - awalUtc.getTime()) / 86_400_000 + 1 > BATAS_HARI_PER_ITEM) {
        throw new BadRequestException(`Rentang ${mulai} s.d. ${selesai} terlalu panjang.`);
      }
      const rentang = rentangTanggalNasional(mulai, selesai);
      if (rentang.length > BATAS_HARI_PER_ITEM) {
        throw new BadRequestException(`Rentang ${mulai} s.d. ${selesai} terlalu panjang.`);
      }
      for (const t of rentang) {
        const daftar = perTanggal.get(t) || [];
        if (!daftar.includes(ket)) daftar.push(ket);
        perTanggal.set(t, daftar);
      }
    }

    const semuaTanggal = [...perTanggal.keys()].sort();
    const existing = await this.prisma.libur.findMany({
      where: { tanggal: { in: semuaTanggal.map(dateOnlyToUtc) } },
      select: { tanggal: true },
    });
    const sudahAda = new Set(existing.map((r) => toDateOnly(r.tanggal)));

    const dibuat = semuaTanggal.filter((t) => !sudahAda.has(t));
    const dilewati = semuaTanggal.filter((t) => sudahAda.has(t));

    if (dibuat.length > 0) {
      await this.prisma.libur.createMany({
        data: dibuat.map((t) => ({
          tanggal: dateOnlyToUtc(t),
          jam_ke: 'Semua',
          keterangan: perTanggal.get(t)!.join(' / '),
          lingkup: 'semua',
          target_kelas: [],
        })),
      });
    }

    return {
      ok: true,
      created: dibuat.length,
      skipped: dilewati.length,
      tanggal_dibuat: dibuat,
      tanggal_dilewati: dilewati,
    };
  }

  async deleteLibur(idParam?: string, idsParam?: string) {
    const mentah = idsParam ? idsParam.split(',') : idParam ? [idParam] : [];
    const ids = mentah
      .map((v) => v.trim())
      .filter((v) => /^\d+$/.test(v))
      .map((v) => BigInt(v));

    if (ids.length === 0) {
      throw new BadRequestException('ID wajib diisi');
    }

    const res = await this.prisma.libur.deleteMany({
      where: { id: { in: ids } },
    });

    // Dulu selalu `ok: true` walau tidak ada baris yang terhapus, sehingga UI
    // menampilkan "berhasil dihapus" untuk id yang sudah tidak ada.
    if (res.count === 0) {
      throw new NotFoundException('Data libur tidak ditemukan');
    }

    return { ok: true, deleted: res.count };
  }
}
