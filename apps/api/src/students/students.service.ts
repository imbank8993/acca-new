import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface CardInfo {
  card_id: string;
  card_name: string;
  is_active: boolean;
  issued_at: Date | null;
}

export interface Kandidat {
  nisn: string;
  nama_lengkap: string;
  gender: string | null;
  kelas_terakhir: string | null;
  tahun_ajaran_terakhir: string | null;
  /** null = tidak punya akun login sama sekali */
  akun_login: 'aktif' | 'nonaktif' | null;
}

const CHARS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';

function generateCardId(): string {
  let id = 'ACCA-';
  for (let i = 0; i < 8; i++) {
    id += CHARS[Math.floor(Math.random() * CHARS.length)];
  }
  return id;
}

const isKelasReguler = (kode: string | null, program: string | null) =>
  !kode && (!program || program === 'Reguler');

@Injectable()
export class StudentsService {
  private readonly logger = new Logger(StudentsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Ambil atau buat kartu siswa untuk daftar NISN.
   * Mengembalikan map NISN -> info kartu.
   */
  async getOrCreateCards(nisns: string[]): Promise<Record<string, CardInfo>> {
    const result: Record<string, CardInfo> = {};

    // Ambil kartu aktif yang sudah ada
    const existing = await this.prisma.student_cards.findMany({
      where: { nisn: { in: nisns }, is_active: true },
      select: { nisn: true, card_id: true, card_name: true, is_active: true, issued_at: true },
    });

    for (const card of existing) {
      result[card.nisn] = {
        card_id: card.card_id,
        card_name: card.card_name || 'Kartu Siswa',
        is_active: card.is_active ?? true,
        issued_at: card.issued_at,
      };
    }

    // Generate kartu untuk yang belum punya
    const missingNisns = nisns.filter((n) => !result[n]);

    for (const nisn of missingNisns) {
      for (let attempt = 0; attempt < 10; attempt++) {
        const card_id = generateCardId();
        try {
          const created = await this.prisma.student_cards.create({
            data: { card_id, nisn, card_name: 'Kartu Siswa' },
            select: { card_id: true, card_name: true, is_active: true, issued_at: true },
          });
          result[nisn] = {
            card_id: created.card_id,
            card_name: created.card_name || 'Kartu Siswa',
            is_active: created.is_active ?? true,
            issued_at: created.issued_at,
          };
          break;
        } catch (err: any) {
          // P2002 = unique constraint violation (card_id collision) → retry
          if (err?.code !== 'P2002') {
            this.logger.warn(`[getOrCreateCards] nisn=${nisn} gagal: ${err?.message}`);
            break;
          }
        }
      }
    }

    return result;
  }

  /**
   * Audit status massal siswa.
   */
  async auditBulkStatus(
    tahunAjaran: string,
    mode: 'aktif' | 'nonaktif',
  ): Promise<{ data: Kandidat[]; meta: Record<string, any> }> {
    // 1. Master kelas
    const kelasRows = await this.prisma.master_kelas.findMany({
      select: { nama: true, kode: true, program: true },
    });
    const namaReguler = new Set(
      kelasRows.filter((k) => isKelasReguler(k.kode ?? null, k.program ?? null)).map((k) => k.nama),
    );
    const namaDikenal = new Set(kelasRows.map((k) => k.nama));

    // 2. Enrolment pada TA terpilih
    const enrolRows = await this.prisma.siswa_kelas.findMany({
      where: { tahun_ajaran: tahunAjaran, aktif: true },
      select: { nisn: true, kelas: true },
    });
    const terdaftarReguler = new Set(
      enrolRows
        .filter((r) => namaReguler.has(r.kelas) || !namaDikenal.has(r.kelas))
        .map((r) => String(r.nisn)),
    );

    // 3. Siswa dengan status sumber
    const statusSumber = mode === 'aktif' ? false : true;
    const siswaRows = await this.prisma.master_siswa.findMany({
      where: { aktif: statusSumber },
      select: { nisn: true, nama_lengkap: true, gender: true },
      orderBy: { nama_lengkap: 'asc' },
    });

    const punyaKelas = siswaRows.filter((s) => terdaftarReguler.has(String(s.nisn)));
    const kandidatDasar =
      mode === 'aktif'
        ? punyaKelas
        : siswaRows.filter((s) => !terdaftarReguler.has(String(s.nisn)));

    // 4. Kelas terakhir per kandidat
    const nisnKandidat = kandidatDasar.map((s) => String(s.nisn));
    const riwayat = new Map<string, { kelas: string; tahun_ajaran: string }>();

    if (nisnKandidat.length > 0) {
      const riwayatRows = await this.prisma.siswa_kelas.findMany({
        where: { nisn: { in: nisnKandidat } },
        select: { nisn: true, kelas: true, tahun_ajaran: true },
        orderBy: { tahun_ajaran: 'desc' },
      });
      for (const row of riwayatRows) {
        const key = String(row.nisn);
        const prev = riwayat.get(key);
        const lebihBaru = !prev || String(row.tahun_ajaran) > prev.tahun_ajaran;
        const prevReguler = prev ? namaReguler.has(prev.kelas) : false;
        if (lebihBaru || (!prevReguler && namaReguler.has(row.kelas))) {
          riwayat.set(key, { kelas: row.kelas, tahun_ajaran: String(row.tahun_ajaran) });
        }
      }
    }

    // 5. Status akun login (public_users, role mengandung 'SISWA')
    const akunMap = new Map<string, { aktif: boolean }>();
    if (nisnKandidat.length > 0) {
      const akunRows = await this.prisma.public_users.findMany({
        where: {
          nip: { in: nisnKandidat },
          role: { contains: 'SISWA' },
        },
        select: { nip: true, aktif: true },
      });
      for (const u of akunRows) {
        if (!u.nip) continue;
        akunMap.set(u.nip, { aktif: u.aktif === true });
      }
    }

    const data: Kandidat[] = kandidatDasar.map((s) => {
      const nisn = String(s.nisn);
      const last = riwayat.get(nisn);
      const akun = akunMap.get(nisn);
      return {
        nisn,
        nama_lengkap: s.nama_lengkap ?? '',
        gender: s.gender ?? null,
        kelas_terakhir: last?.kelas ?? null,
        tahun_ajaran_terakhir: last?.tahun_ajaran ?? null,
        akun_login: akun ? (akun.aktif ? 'aktif' : 'nonaktif') : null,
      };
    });

    return {
      data,
      meta: {
        tahun_ajaran: tahunAjaran,
        mode,
        total_diperiksa: siswaRows.length,
        total_punya_kelas: punyaKelas.length,
        total_kandidat: data.length,
        total_akun_relevan: data.filter(
          (d) => d.akun_login === (mode === 'aktif' ? 'nonaktif' : 'aktif'),
        ).length,
        tanpa_data_kelas: enrolRows.length === 0,
      },
    };
  }

  /**
   * Terapkan perubahan status aktif massal.
   */
  async applyBulkStatus(
    nisns: string[],
    aktif: boolean,
    sertakanAkun: boolean,
  ): Promise<{ updated: number; akun_updated: number }> {
    const { count: updated } = await this.prisma.master_siswa.updateMany({
      where: { nisn: { in: nisns } },
      data: { aktif },
    });

    let akun_updated = 0;
    if (sertakanAkun) {
      const { count } = await this.prisma.public_users.updateMany({
        where: {
          nip: { in: nisns },
          role: { contains: 'SISWA' },
        },
        data: { aktif },
      });
      akun_updated = count;
    }

    return { updated, akun_updated };
  }

  /**
   * Verifikasi identitas siswa lewat kartu atau NISN.
   */
  async verifyStudent(nisn?: string, cardId?: string) {
    let siswa: any = null;
    let resolvedCardId: string | null = null;

    if (cardId) {
      // Lookup by card_id
      const card = await this.prisma.student_cards.findUnique({
        where: { card_id: cardId },
      });

      if (!card) {
        return { ok: false, error: 'Kartu tidak ditemukan', status: 404 };
      }

      if (!card.is_active) {
        return {
          ok: true,
          data: {
            card_id: card.card_id,
            card_name: card.card_name,
            is_active: false,
            siswa: null as any,
            status: 'CARD_INACTIVE',
            message: `Kartu ID ${card.card_id} tidak aktif. Silakan hubungi admin sekolah untuk kartu pengganti.`,
          },
        };
      }

      // Update last_used_at
      await this.prisma.student_cards.update({
        where: { card_id: cardId },
        data: { last_used_at: new Date() },
      });

      siswa = await this.prisma.master_siswa.findUnique({ where: { nisn: card.nisn } });
      if (!siswa) {
        return { ok: false, error: 'Data siswa tidak ditemukan', status: 404 };
      }
      resolvedCardId = card.card_id;
    } else if (nisn) {
      siswa = await this.prisma.master_siswa.findUnique({ where: { nisn } });
      if (!siswa) {
        return { ok: false, error: 'Siswa tidak ditemukan', status: 404 };
      }
      const card = await this.prisma.student_cards.findFirst({
        where: { nisn, is_active: true },
        orderBy: { issued_at: 'desc' },
      });
      resolvedCardId = card?.card_id ?? null;
    } else {
      return { ok: false, error: 'NISN atau card_id wajib disertakan', status: 400 };
    }

    // Profil sekolah
    let schoolName = 'Sistem ACCA';
    let schoolLogo = '';
    try {
      const profil = await this.prisma.profil_sekolah.findFirst({
        orderBy: { updated_at: 'desc' },
        select: { nama: true, logo_url: true },
      });
      if (profil) {
        schoolName = profil.nama || schoolName;
        schoolLogo = profil.logo_url || '';
      }
    } catch (e) {
      this.logger.warn(`verifyStudent: gagal ambil profil_sekolah: ${(e as Error).message}`);
    }

    const statusVal = cardId
      ? siswa.aktif === true
        ? 'ACTIVE_CARD_STUDENT_ACTIVE'
        : 'ACTIVE_CARD_STUDENT_INACTIVE'
      : 'DIRECT_NISN_LOOKUP';

    const message =
      siswa.aktif === true
        ? `${siswa.nama_lengkap} merupakan siswa aktif di ${schoolName}.`
        : `${siswa.nama_lengkap} saat ini berstatus NON-AKTIF di ${schoolName}.`;

    return {
      ok: true,
      data: {
        siswa,
        card_id: resolvedCardId,
        schoolName,
        schoolLogo,
        verified: siswa.aktif === true,
        status: statusVal,
        message,
      },
    };
  }
}
