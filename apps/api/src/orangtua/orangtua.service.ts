import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { rolesUser } from '../auth/feature-access.guard';

export const VALID_STATUS = ['Ayah', 'Ibu', 'Wali'];
const MAKS_ORTU_PER_SISWA = 2;
const PESAN_DUPLIKAT_BAWAAN = 'Anda sudah mengklaim siswa ini sebelumnya.';

/**
 * Batas baris yang dikirim ke tab "Relasi Orang Tua" dalam satu permintaan.
 * Saat ini relasinya puluhan, tapi satu angkatan penuh berarti ~2 baris per
 * siswa: tanpa batas, layar itu akan menarik seluruh tabel setiap kali dibuka.
 */
const MAKS_BARIS_RELASI = 1000;

/** Bentuk `orangtua_siswa.id` — UUID. String lain tidak perlu sampai ke Prisma. */
const POLA_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface KelasInfo {
  kelas: string;
  tahun_ajaran: string;
}

@Injectable()
export class OrangtuaService {
  private readonly logger = new Logger(OrangtuaService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Kelas aktif per NISN, dibatasi tahun ajaran aktif (is_active bisa 2 baris:
   * Ganjil + Genap). Siswa bisa terdaftar di beberapa kelas sekaligus (Reguler +
   * peminatan/UTBK) — kelas Reguler diprioritaskan supaya yang tampil satu saja.
   */
  async getKelasByNisn(nisnList: string[]): Promise<Record<string, KelasInfo>> {
    if (nisnList.length === 0) return {};

    const tahunAktif = await this.prisma.master_tahun_ajaran.findMany({
      where: { is_active: true },
      select: { tahun_ajaran: true },
    });
    const activeYears = [...new Set(tahunAktif.map((t) => t.tahun_ajaran))];

    const [kelasRows, masterKelas] = await Promise.all([
      this.prisma.siswa_kelas.findMany({
        where: {
          nisn: { in: nisnList },
          aktif: true,
          ...(activeYears.length > 0 ? { tahun_ajaran: { in: activeYears } } : {}),
        },
        select: { nisn: true, kelas: true, tahun_ajaran: true },
        orderBy: { tahun_ajaran: 'desc' },
      }),
      this.prisma.master_kelas.findMany({ select: { nama: true, program: true } }),
    ]);

    const programByKelas: Record<string, string> = {};
    masterKelas.forEach((mk) => {
      programByKelas[mk.nama] = mk.program || '';
    });

    const hasil: Record<string, KelasInfo> = {};
    kelasRows.forEach((row) => {
      const existing = hasil[row.nisn];
      const isReguler = programByKelas[row.kelas] === 'Reguler';
      if (!existing || (isReguler && programByKelas[existing.kelas] !== 'Reguler')) {
        hasil[row.nisn] = { kelas: row.kelas, tahun_ajaran: row.tahun_ajaran };
      }
    });
    return hasil;
  }

  /**
   * Cocokkan NISN + tanggal lahir; dipakai semua jalur klaim mandiri.
   *
   * `samarkanAlasan` dipakai jalur PUBLIK (`POST /register/parent`, tanpa token).
   * Membedakan "NISN tidak ditemukan" dari "tanggal lahir tidak cocok" berarti
   * endpoint itu memberi tahu penebak NISN mana yang benar — dan NISN adalah
   * username login siswa. Untuk pemanggil yang sudah login, pesan spesifiknya
   * dipertahankan karena di sana pesan itu menolong, bukan membocorkan.
   */
  async verifySiswa(nisn: string, tanggalLahir: string, samarkanAlasan = false) {
    const gagal = () =>
      new BadRequestException(
        samarkanAlasan
          ? 'NISN dan tanggal lahir siswa tidak cocok dengan data sekolah. Periksa kembali, atau hubungi sekolah bila yakin sudah benar.'
          : 'Tanggal lahir yang dimasukkan tidak cocok dengan data sekolah. Verifikasi gagal.',
      );

    const siswa = await this.prisma.master_siswa.findFirst({
      where: { nisn },
      select: { nisn: true, nama_lengkap: true, tanggal_lahir: true },
    });
    if (!siswa) {
      if (samarkanAlasan) throw gagal();
      throw new NotFoundException('NISN tidak ditemukan di database sekolah');
    }

    const tglSiswa = siswa.tanggal_lahir
      ? siswa.tanggal_lahir.toISOString().slice(0, 10)
      : null;
    if (tglSiswa !== tanggalLahir) {
      throw gagal();
    }
    return siswa;
  }

  /**
   * Aturan klaim yang berlaku di SEMUA jalur (pendaftaran mandiri, tambah anak
   * dari dashboard, maupun penautan oleh admin): maksimal 2 orang tua per siswa,
   * satu akun tidak boleh mengklaim siswa yang sama dua kali, dan status
   * Ayah/Ibu unik per siswa (Wali boleh lebih dari satu).
   */
  async assertClaimAllowed(
    nisn: string,
    statusKeluarga: string,
    userId?: bigint,
    pesanDuplikat = PESAN_DUPLIKAT_BAWAAN,
  ) {
    if (!VALID_STATUS.includes(statusKeluarga)) {
      throw new BadRequestException('Status keluarga tidak valid');
    }

    const existing = await this.prisma.orangtua_siswa.findMany({
      where: { nisn },
      select: { user_id: true, status_keluarga: true },
    });

    this.periksaKuotaKlaim(existing, statusKeluarga, userId, pesanDuplikat);
  }

  /**
   * Bagian aturan yang tidak menyentuh basis data, supaya bisa dipakai baik
   * sebagai pemeriksaan awal (`assertClaimAllowed`) maupun di dalam transaksi
   * (`klaimAtomik`) tanpa menulis aturannya dua kali.
   */
  private periksaKuotaKlaim(
    existing: Array<{ user_id: bigint; status_keluarga: string }>,
    statusKeluarga: string,
    userId?: bigint,
    pesanDuplikat = PESAN_DUPLIKAT_BAWAAN,
  ) {
    if (userId !== undefined && existing.some((e) => e.user_id === userId)) {
      throw new BadRequestException(pesanDuplikat);
    }
    if (existing.length >= MAKS_ORTU_PER_SISWA) {
      throw new BadRequestException(
        'Siswa ini sudah diklaim batas maksimal oleh 2 akun orang tua. Hubungi admin sekolah jika ini adalah kesalahan.',
      );
    }
    if (
      statusKeluarga !== 'Wali' &&
      existing.some((e) => e.status_keluarga === statusKeluarga)
    ) {
      throw new BadRequestException(
        `Akun dengan status keluarga '${statusKeluarga}' sudah diklaim untuk siswa ini.`,
      );
    }
  }

  /**
   * Baca aturan kuota lalu tulis klaimnya dalam SATU transaksi.
   *
   * `assertClaimAllowed` disusul `createClaim` sebagai dua langkah terpisah bisa
   * dilewati dua permintaan yang tiba bersamaan: keduanya membaca "baru satu
   * orang tua", keduanya lolos, siswa berakhir dengan tiga. Basis data tidak bisa
   * menahannya sendiri — satu-satunya batasan di sana adalah
   * `@@unique([user_id, nisn])`, jadi kuota 2 orang tua dan keunikan Ayah/Ibu
   * hanya hidup di kode ini.
   *
   * Serializable membuat pembacaan di dalam transaksi ikut terkunci, sehingga
   * yang kalah gagal terang-terangan (P2034) dan bisa dicoba ulang, bukan menulis
   * diam-diam.
   */
  async createClaim(userId: bigint, nisn: string, statusKeluarga: string, pesanDuplikat?: string) {
    try {
      await this.prisma.$transaction(
        async (tx) => {
          const existing = await tx.orangtua_siswa.findMany({
            where: { nisn },
            select: { user_id: true, status_keluarga: true },
          });
          this.periksaKuotaKlaim(existing, statusKeluarga, userId, pesanDuplikat);
          await tx.orangtua_siswa.create({
            data: { user_id: userId, nisn, status_keluarga: statusKeluarga },
          });
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (e: any) {
      if (e?.code === 'P2002') {
        throw new BadRequestException(pesanDuplikat || PESAN_DUPLIKAT_BAWAAN);
      }
      if (e?.code === 'P2034') {
        throw new BadRequestException(
          'Ada pendaftaran lain untuk siswa ini yang sedang diproses. Coba lagi sebentar.',
        );
      }
      throw e;
    }
  }

  // ── Sisi orang tua ─────────────────────────────────────────────────────

  /**
   * `rolesUser` memecah daftar role (`"ORANG_TUA,TU"`) dan juga menerima bentuk
   * `roles: []`. Sebelumnya di sini dipakai `String(user.role).includes(...)`,
   * yang cocok sebagai potongan kata — jadi role baru yang kebetulan memuat
   * "ORANG_TUA" akan lolos, sementara token yang hanya membawa `roles` ditolak.
   */
  private assertOrangTua(user: any) {
    if (!rolesUser(user).includes('ORANG_TUA')) {
      throw new ForbiddenException('Akses ditolak. Anda bukan Orang Tua.');
    }
  }

  async listAnak(user: any) {
    this.assertOrangTua(user);

    const relasi = await this.prisma.orangtua_siswa.findMany({
      where: { user_id: BigInt(user.id) },
      select: { nisn: true, status_keluarga: true },
    });
    if (relasi.length === 0) return [];

    const nisnList = relasi.map((r) => r.nisn);
    const [siswa, kelasByNisn] = await Promise.all([
      this.prisma.master_siswa.findMany({
        where: { nisn: { in: nisnList } },
        select: { nisn: true, nama_lengkap: true },
      }),
      this.getKelasByNisn(nisnList),
    ]);

    // Dirunut dari `relasi`, bukan dari `siswa`: kalau baris master seorang anak
    // hilang (mis. NISN-nya sempat salah tulis), anak itu tetap tampil dengan
    // nama kosong — bukan menghilang tanpa keterangan dari dashboard orang tuanya.
    const siswaByNisn = new Map(siswa.map((s) => [s.nisn ?? '', s]));
    return relasi.map((r) => {
      const s = siswaByNisn.get(r.nisn);
      const kelas = kelasByNisn[r.nisn];
      return {
        nisn: r.nisn,
        nama_lengkap: s?.nama_lengkap ?? null,
        kelas: kelas?.kelas || '',
        rombel: '',
        tahun_ajaran: kelas?.tahun_ajaran || '',
        foto: null as string | null,
        status_keluarga: r.status_keluarga || 'Wali',
      };
    });
  }

  /**
   * Profil satu anak untuk halaman detail. Kepemilikannya diverifikasi di sini
   * (bukan di halaman) supaya orang tua tidak bisa membuka NISN yang bukan
   * anaknya hanya dengan mengganti URL.
   */
  async getAnakDetail(user: any, nisn: string) {
    this.assertOrangTua(user);

    const relasi = await this.prisma.orangtua_siswa.findFirst({
      where: { user_id: BigInt(user.id), nisn },
      select: { id: true },
    });
    if (!relasi) {
      throw new ForbiddenException(
        `Anda tidak memiliki akses untuk melihat data siswa dengan NISN ${nisn}`,
      );
    }

    const siswa = await this.prisma.master_siswa.findFirst({ where: { nisn } });
    if (!siswa) throw new NotFoundException('Siswa tidak ditemukan');

    const tahunAktif = await this.prisma.master_tahun_ajaran.findMany({
      where: { is_active: true },
      select: { tahun_ajaran: true },
    });
    const activeYears = [...new Set(tahunAktif.map((t) => t.tahun_ajaran))];

    const kelasRows = await this.prisma.siswa_kelas.findMany({
      where: {
        nisn,
        aktif: true,
        ...(activeYears.length > 0 ? { tahun_ajaran: { in: activeYears } } : {}),
      },
      select: { kelas: true },
    });
    const kelasAktif = [...new Set(kelasRows.map((k) => k.kelas).filter(Boolean))].join(', ');

    // BigInt & Date tidak bisa di-JSON-kan apa adanya.
    return JSON.parse(
      JSON.stringify({ ...siswa, kelas: kelasAktif || (siswa as any).kelas || '-' }, (_k, v) =>
        typeof v === 'bigint' ? v.toString() : v,
      ),
    );
  }

  /** Tambah anak dari dashboard orang tua — verifikasinya sama dengan pendaftaran awal. */
  async claimAnak(
    user: any,
    input: { nisn: string; tanggal_lahir_siswa: string; status_keluarga: string },
  ) {
    this.assertOrangTua(user);

    const nisn = String(input.nisn || '').trim();
    const tanggalLahir = String(input.tanggal_lahir_siswa || '').trim();
    const statusKeluarga = String(input.status_keluarga || '').trim();

    if (!nisn || !tanggalLahir || !statusKeluarga) {
      throw new BadRequestException(
        'NISN, tanggal lahir siswa, dan status keluarga wajib diisi',
      );
    }

    const siswa = await this.verifySiswa(nisn, tanggalLahir);
    await this.assertClaimAllowed(nisn, statusKeluarga, BigInt(user.id));
    await this.createClaim(BigInt(user.id), nisn, statusKeluarga);

    return { message: `${siswa.nama_lengkap} berhasil ditambahkan sebagai anak Anda.` };
  }

  // ── Sisi admin (tab Relasi Orang Tua) ──────────────────────────────────

  async searchSiswa(query: string) {
    const siswaRows = await this.prisma.master_siswa.findMany({
      where: {
        OR: [
          { nisn: { contains: query, mode: 'insensitive' } },
          { nama_lengkap: { contains: query, mode: 'insensitive' } },
        ],
      },
      select: { nisn: true, nama_lengkap: true },
      orderBy: { nama_lengkap: 'asc' },
      take: 20,
    });

    const nisnList = siswaRows.map((s) => s.nisn).filter((n): n is string => !!n);
    const [kelasByNisn, claims] = await Promise.all([
      this.getKelasByNisn(nisnList),
      nisnList.length
        ? this.prisma.orangtua_siswa.groupBy({
            by: ['nisn'],
            where: { nisn: { in: nisnList } },
            _count: { nisn: true },
          })
        : [],
    ]);

    const jumlahOrtu: Record<string, number> = {};
    claims.forEach((c: any) => {
      jumlahOrtu[c.nisn] = c._count.nisn;
    });

    return siswaRows.map((s) => ({
      nisn: s.nisn,
      nama_lengkap: s.nama_lengkap,
      kelas: s.nisn ? kelasByNisn[s.nisn]?.kelas || '' : '',
      jumlah_ortu: s.nisn ? jumlahOrtu[s.nisn] || 0 : 0,
    }));
  }

  async listRelasi() {
    const [totalRelasi, relasi, parentUsers] = await Promise.all([
      this.prisma.orangtua_siswa.count(),
      this.prisma.orangtua_siswa.findMany({
        select: { id: true, user_id: true, nisn: true, status_keluarga: true, created_at: true },
        // `created_at` bisa sama pada baris yang dibuat dalam satu impor; tanpa
        // pemutus, urutannya tidak stabil antar permintaan.
        orderBy: [{ created_at: 'desc' }, { id: 'asc' }],
        take: MAKS_BARIS_RELASI,
      }),
      this.prisma.public_users.findMany({
        where: { role: { contains: 'ORANG_TUA', mode: 'insensitive' } },
        select: {
          id: true,
          nama: true,
          email: true,
          username: true,
          aktif: true,
          role: true,
          created_at: true,
        },
        orderBy: [{ nama: 'asc' }, { id: 'asc' }],
        take: MAKS_BARIS_RELASI,
      }),
    ]);

    const parentById = new Map(parentUsers.map((p) => [p.id.toString(), p]));

    const nisnList = [...new Set(relasi.map((r) => r.nisn))];
    const [siswaRows, kelasByNisn] = await Promise.all([
      nisnList.length
        ? this.prisma.master_siswa.findMany({
            where: { nisn: { in: nisnList } },
            select: { nisn: true, nama_lengkap: true },
          })
        : ([] as Array<{ nisn: string | null; nama_lengkap: string | null }>),
      this.getKelasByNisn(nisnList),
    ]);
    const siswaByNisn = new Map<string, { nama_lengkap: string | null }>();
    siswaRows.forEach((s) => siswaByNisn.set(s.nisn ?? '', s));

    const relations = relasi.map((r) => {
      const parent = parentById.get(r.user_id.toString());
      const siswa = siswaByNisn.get(r.nisn);
      return {
        id: r.id,
        user_id: Number(r.user_id),
        nisn: r.nisn,
        status_keluarga: r.status_keluarga,
        created_at: r.created_at,
        ortu_nama: parent?.nama || '(akun tidak ditemukan)',
        ortu_email: parent?.email || parent?.username || '',
        ortu_aktif: parent?.aktif ?? false,
        siswa_nama: siswa?.nama_lengkap || '(siswa tidak ditemukan)',
        siswa_kelas: kelasByNisn[r.nisn]?.kelas || '',
      };
    });

    // Dihitung di basis data, bukan dari `relasi` yang sudah dipotong
    // `MAKS_BARIS_RELASI` — kalau tidak, "jumlah anak" ikut terpotong dan
    // pemeriksaan kuota di layar jadi menyesatkan.
    const perOrtu = await this.prisma.orangtua_siswa.groupBy({
      by: ['user_id'],
      _count: { user_id: true },
    });
    const jumlahAnak = new Map(perOrtu.map((g) => [g.user_id.toString(), g._count.user_id]));

    const parents = parentUsers.map((p) => ({
      id: Number(p.id),
      nama: p.nama,
      email: p.email || p.username || '',
      aktif: p.aktif,
      jumlah_anak: jumlahAnak.get(p.id.toString()) || 0,
    }));

    return { relations, parents, total: totalRelasi, truncated: totalRelasi > relasi.length };
  }

  /**
   * Pengelola tab menautkan siswa ke akun orang tua, tanpa verifikasi tanggal
   * lahir — berbeda dari klaim mandiri, di sini yang menautkan adalah petugas
   * yang wewenangnya sudah diperiksa di controller.
   */
  async addRelasi(input: { user_id: number; nisn: string; status_keluarga: string }) {
    const userId = Number(input.user_id);
    const nisn = String(input.nisn || '').trim();
    const statusKeluarga = String(input.status_keluarga || '').trim();

    if (!userId || !nisn || !statusKeluarga) {
      throw new BadRequestException('Akun orang tua, siswa, dan status keluarga wajib diisi');
    }
    // `BigInt(1.5)` melempar RangeError — tanpa penyaring ini, id pecahan atau di
    // luar jangkauan keluar sebagai 500, bukan sebagai kesalahan masukan.
    if (!Number.isSafeInteger(userId) || userId < 1) {
      throw new BadRequestException('ID akun orang tua tidak valid');
    }

    const parent = await this.prisma.public_users.findUnique({
      where: { id: BigInt(userId) },
      select: { id: true, nama: true, role: true },
    });
    if (!parent || !rolesUser(parent).includes('ORANG_TUA')) {
      throw new BadRequestException('Akun yang dipilih bukan akun Orang Tua');
    }

    const siswa = await this.prisma.master_siswa.findFirst({
      where: { nisn },
      select: { nama_lengkap: true },
    });
    if (!siswa) {
      throw new NotFoundException('NISN tidak ditemukan di database sekolah');
    }

    await this.assertClaimAllowed(
      nisn,
      statusKeluarga,
      BigInt(userId),
      'Akun ini sudah tertaut dengan siswa tersebut.',
    );
    await this.createClaim(
      BigInt(userId),
      nisn,
      statusKeluarga,
      'Akun ini sudah tertaut dengan siswa tersebut.',
    );

    return { message: `${siswa.nama_lengkap} berhasil ditautkan ke akun ${parent.nama}.` };
  }

  async updateRelasi(id: string, statusKeluarga: string) {
    if (!id || !statusKeluarga) {
      throw new BadRequestException('ID relasi dan status keluarga wajib diisi');
    }
    if (!VALID_STATUS.includes(statusKeluarga)) {
      throw new BadRequestException('Status keluarga tidak valid');
    }
    this.assertIdRelasi(id);

    const relasi = await this.prisma.orangtua_siswa.findUnique({
      where: { id },
      select: { id: true, nisn: true },
    });
    if (!relasi) throw new NotFoundException('Relasi tidak ditemukan');

    // Ayah/Ibu tetap harus unik di antara orang tua siswa yang sama.
    if (statusKeluarga !== 'Wali') {
      const bentrok = await this.prisma.orangtua_siswa.findFirst({
        where: { nisn: relasi.nisn, status_keluarga: statusKeluarga, NOT: { id } },
        select: { id: true },
      });
      if (bentrok) {
        throw new BadRequestException(
          `Siswa ini sudah punya orang tua berstatus '${statusKeluarga}'.`,
        );
      }
    }

    await this.prisma.orangtua_siswa.update({
      where: { id },
      data: { status_keluarga: statusKeluarga },
    });

    return { message: 'Status keluarga berhasil diperbarui.' };
  }

  /**
   * `orangtua_siswa.id` bertipe uuid di Postgres. String lain membuat Prisma
   * melempar P2023 ("Error creating UUID") yang lolos sampai ke pemanggil sebagai
   * 500 — padahal ini semata masukan yang salah bentuk.
   */
  private assertIdRelasi(id: string) {
    if (!POLA_UUID.test(id)) {
      throw new BadRequestException('ID relasi tidak valid');
    }
  }

  async deleteRelasi(id: string) {
    if (!id) throw new BadRequestException('ID relasi wajib diisi');
    this.assertIdRelasi(id);

    try {
      await this.prisma.orangtua_siswa.delete({ where: { id } });
    } catch (e: any) {
      if (e?.code === 'P2025') throw new NotFoundException('Relasi tidak ditemukan');
      throw e;
    }

    return { message: 'Relasi berhasil dihapus.' };
  }
}
