import { CanActivate, ExecutionContext, ForbiddenException, Injectable, SetMetadata } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../prisma/prisma.service';

export const FEATURE_ACCESS_KEY = 'feature_access_key';

export interface AturanFitur {
  settingKey: string | string[];
  /**
   * Peran yang haknya melekat di kode dan TIDAK bisa dicabut lewat layar
   * pengaturan — mis. WKM pada modul informasi, yang memang pemilik kontennya.
   * Konfigurasi di site_settings hanya MENAMBAH di luar daftar ini.
   */
  peranBawaan: string[];
}

/**
 * Batasi endpoint ke pemegang "Hak Akses Fitur" untuk modul tertentu.
 *
 * `settingKey` adalah kunci baris `site_settings` yang menyimpan konfigurasi,
 * yaitu JSON `{ allowedRoles: string[], allowedUsers: [{ id, nip }] }` — format
 * yang sama dipakai modul Pusat Dokumen dan disunting admin lewat
 * Pengaturan Users → Hak Akses Fitur. Bisa berupa array jika diizinkan di salah satu modul.
 *
 *   @UseGuards(JwtAuthGuard, FeatureAccessGuard)
 *   @FeatureAccess(JADWAL_GENERATE_KEY)
 *   @FeatureAccess(INFORMASI_KELOLA_KEY, ...WKM_INFORMASI)
 */
export const FeatureAccess = (settingKey: string | string[], ...peranBawaan: string[]) =>
  SetMetadata(FEATURE_ACCESS_KEY, { settingKey, peranBawaan } satisfies AturanFitur);

/**
 * Kunci site_settings untuk hak MENINJAU pengajuan tukar jadwal.
 *
 * Dipisahkan dari `JADWAL_GENERATE_KEY`: menyusun jadwal dan menyetujui
 * pertukaran adalah dua wewenang berbeda, dan sekolah bisa menaruhnya pada orang
 * yang berbeda.
 *
 * Tanpa peran bawaan, mengikuti aturan yang sama dengan ketiga halaman
 * pengaturan: hanya ADMIN yang melekat di kode. Sebelumnya peninjaunya adalah
 * daftar tertanam `['WKM_AKADEMIK', 'ADMIN', 'ADMINISTRATOR', 'KURIKULUM']` di
 * jadwal.service.ts, yang tidak bisa diubah tanpa deploy dan tidak bisa menunjuk
 * satu orang tertentu.
 */
export const TUKAR_JADWAL_REVIEW_KEY = 'tukar_jadwal_review_access_config';

/** Kunci site_settings untuk hak kelola jadwal (Generate PBM & Generate Piket). */
export const JADWAL_GENERATE_KEY = 'jadwal_generate_access_config';

/**
 * Kunci site_settings untuk wewenang di halaman Izin Guru.
 *
 * Sebelumnya ketiganya dihardcode di `IzinGuruController.getApiUser`:
 * `isFullAccess = isAdmin || isOpIzinGuru` dan `isKamad`. Artinya wewenangnya
 * tidak bisa diubah tanpa deploy, dan tidak bisa menunjuk satu orang tertentu —
 * padahal persetujuan izin adalah jabatan, bukan sifat teknis akun.
 *
 * Dipecah tiga karena halaman ini memang punya tiga wewenang berbeda, dan
 * memisahkannya memungkinkan "KAMAD menyetujui izin & sakit" tanpa sekalian
 * membuka verifikasi dinas luar atau penyuntingan pengajuan orang lain.
 *
 * Mengajukan izin untuk DIRI SENDIRI tidak termasuk di sini — itu hak setiap
 * pegawai, dijaga `PegawaiGuard`, bukan wewenang yang perlu ditunjuk.
 */
export const IZIN_GURU_KELOLA_KEY = 'izin_guru_kelola_access_config';
export const IZIN_GURU_APPROVAL_KEY = 'izin_guru_approval_access_config';
export const IZIN_GURU_DINAS_KEY = 'izin_guru_dinas_access_config';

/** Kunci site_settings untuk hak kelola Informasi & Layanan (semua kategori). */
export const INFORMASI_KELOLA_KEY = 'informasi_access_config';

/** Kunci site_settings untuk hak kelola Informasi per kategori. */
export const INFORMASI_AKADEMIK_KEY = 'informasi_akademik_access_config';
export const INFORMASI_KEASRAMAAN_KEY = 'informasi_keasramaan_access_config';
export const INFORMASI_KESISWAAN_KEY = 'informasi_kesiswaan_access_config';
export const INFORMASI_UMUM_KEY = 'informasi_umum_access_config';

export const ALL_INFORMASI_KEYS = [
  INFORMASI_KELOLA_KEY,
  INFORMASI_AKADEMIK_KEY,
  INFORMASI_KEASRAMAAN_KEY,
  INFORMASI_KESISWAAN_KEY,
  INFORMASI_UMUM_KEY,
];

/** Kunci site_settings untuk hak kelola Pengumuman. */
export const PENGUMUMAN_KELOLA_KEY = 'pengumuman_access_config';

/**
 * Kunci site_settings untuk hak kelola Agenda Madrasah.
 * Tanpa peran bawaan: selain ADMIN, seluruhnya diatur dari layar pengaturan.
 */
export const AGENDA_KELOLA_KEY = 'agenda_access_config';

/** Kunci site_settings untuk hak kelola Data Hari Libur Madrasah. */
export const LIBUR_ACCESS_KEY = 'libur_access_config';

/** Kunci site_settings untuk hak kelola Absensi (Tab Kelola). */
export const ABSENSI_ACCESS_KEY = 'absensi_access_config';

/** Kunci site_settings untuk hak persetujuan / approval laporan bulanan Guru Asuh. */
export const GURU_ASUH_APPROVAL_KEY = 'guru_asuh_approval_access_config';

/** Kunci site_settings untuk hak akses modul Jurnal Pembelajaran. */
export const JURNAL_ACCESS_KEY = 'jurnal_access_config';
export const JURNAL_INPUT_ACCESS_KEY = 'jurnal_input_access_config';
export const JURNAL_REVIEW_BANDING_ACCESS_KEY = 'jurnal_review_banding_access_config';
export const JURNAL_GENERATE_ACCESS_KEY = 'jurnal_generate_access_config';

/**
 * Kunci site_settings untuk hak kelola survei Pengembangan Diri.
 *
 * Tanpa peran bawaan. Sebelumnya kedua endpointnya dijaga pencocokan SUBSTRING
 * di dalam handler -- `role.toLowerCase().includes('admin')` atau
 * `includes('operator')` -- sehingga role apa pun yang kebetulan memuat potongan
 * itu ikut lolos (ADMINISTRASI, OP_ADMIN, KOORDINATOR_OPERATOR).
 *
 * Klausa `operator` itu sendiri tidak pernah cocok dengan siapa pun: di basis
 * data tidak ada satu pun nilai `users.role` yang memuat "operator". Keluarga
 * operator yang benar-benar ada semuanya berawalan `OP_` (OP_KELAS, OP_AGENDA,
 * OP_UKS, OP_IZIN, OP_IZINGURU, OP_JURNAL), dan tidak satu pun di antaranya
 * jelas-jelas pemilik survei ini -- jadi tidak ada role yang layak ditanam di
 * kode. Pengelolanya ditunjuk dari layar Pengaturan Users -> Hak Akses Fitur,
 * dan default tanpa baris konfigurasi (ADMIN saja) persis sama dengan siapa yang
 * efektif punya akses sebelumnya.
 */
export const PENGEMBANGAN_DIRI_ACCESS_KEY = 'pengembangan_diri_access_config';

/**
 * Kunci "Hak Akses Fitur" per TAB halaman Pengaturan Data.
 *
 * Alasannya sama dengan Master Data: hanya ADMIN yang melekat di kode, sisanya
 * ditunjuk lewat layar Pengaturan Users -> Hak Akses Fitur, per tab, supaya
 * wewenangnya bisa sesempit kebutuhan.
 *
 * Sebelumnya enam tab di halaman ini dijaga EMPAT mekanisme berbeda: dekorator
 * `@Roles` dengan daftar role tertanam (Siswa Kelas, Guru Mapel), `isManager`
 * milik ekskul, `pageIds.includes('pengaturan-data')` (Relasi Orang Tua), dan
 * pemeriksaan `role.includes('admin')` di dalam handler (Dropdown) — sementara
 * Ganti Data Massal tidak dijaga sama sekali.
 *
 * CATATAN untuk tab Siswa Ekskul: `POST/DELETE /ekskul/siswa` dipakai DUA pihak,
 * jadi kunci ini menentukan satu hal saja — boleh tidaknya bertindak atas
 * kepesertaan MILIK ORANG LAIN. Siswa tetap bisa mendaftar dan membatalkan dirinya
 * sendiri tanpa ditunjuk di mana pun; di jalur itu `EkskulService` memaksa
 * `siswa_id` ke milik pemanggil dan memeriksa kepemilikan per baris.
 */
export const PENGATURAN_DATA_ACCESS_KEYS = {
  siswa_kelas: 'pengaturan_data_siswa_kelas_access_config',
  guru_mapel: 'pengaturan_data_guru_mapel_access_config',
  ekskul_siswa: 'pengaturan_data_ekskul_siswa_access_config',
  relasi_ortu: 'pengaturan_data_relasi_ortu_access_config',
  dropdown: 'pengaturan_data_dropdown_access_config',
  ganti_massal: 'pengaturan_data_ganti_massal_access_config',
} as const;

export type PengaturanDataTab = keyof typeof PENGATURAN_DATA_ACCESS_KEYS;

/**
 * Kunci "Hak Akses Fitur" per TAB halaman Pengaturan Tugas.
 *
 * Alasannya sama dengan Master Data dan Pengaturan Data: hanya ADMIN yang melekat
 * di kode, sisanya ditunjuk per tab dari layar Pengaturan Users -> Hak Akses
 * Fitur.
 *
 * Sebelumnya empat tab di halaman ini dijaga EMPAT mekanisme berbeda, dan tiga di
 * antaranya bermasalah:
 *
 *   - Wali Kelas: dekorator `@Roles` dengan daftar role tertanam.
 *   - Guru Asuh: `apiUser.role === 'ADMIN'` di dalam service — perbandingan string
 *     UTUH, padahal ketiga akun admin di basis data ini punya role gabungan
 *     (`ADMIN,GURU`, `GURU,ADMIN,WKM_AKADEMIK`, ...). Tidak satu pun bernilai
 *     tepat `'ADMIN'`, jadi pemeriksaan itu selalu gagal dan tab Guru Asuh tidak
 *     bisa dikelola siapa pun.
 *   - Tugas Tambahan: `@RequiresPage('tugas-tambahan', 'pengaturan-tugas')`, yaitu
 *     tabel `role_pages` yang mengatur NAVIGASI. Role GURU dan TAMU memegang
 *     halaman `tugas-tambahan` di sana, sehingga keduanya bisa menulis ke tabel
 *     yang menentukan role tugas (`granted_role`, dibaca
 *     `AccessService.getDutyRoles`) — memberi diri sendiri WALI_KELAS atau
 *     PEMBINA_EKSKUL, atau mencabutnya dari orang lain.
 *   - Pembina Ekskul: `EkskulService.isManager`, daftar role tertanam.
 */
export const PENGATURAN_TUGAS_ACCESS_KEYS = {
  wali_kelas: 'pengaturan_tugas_wali_kelas_access_config',
  guru_asuh: 'pengaturan_tugas_guru_asuh_access_config',
  ploting_tugas: 'pengaturan_tugas_ploting_access_config',
  pembina_ekskul: 'pengaturan_tugas_pembina_ekskul_access_config',
} as const;

export type PengaturanTugasTab = keyof typeof PENGATURAN_TUGAS_ACCESS_KEYS;

/**
 * WKM adalah pemilik konten informasi per bidangnya, jadi haknya melekat di
 * kode — bukan sesuatu yang perlu (atau boleh) dicabut dari layar pengaturan.
 */
export const WKM_INFORMASI = [
  'WKM_AKADEMIK',
  'WKM_KESISWAAN',
  'WKM_KEASRAMAAN',
  'WKM_HUMAS',
];

export interface KonfigurasiAkses {
  allowedRoles: string[];
  allowedUsers: Array<{ id?: string; nip?: string }>;
}

/** ADMIN selalu punya akses penuh dan tidak bisa dicabut lewat konfigurasi. */
export const ROLE_ADMIN = ['ADMIN', 'ADMINISTRATOR'];

export function parseKonfigurasiAkses(nilai: unknown): KonfigurasiAkses {
  let raw: any = nilai;
  if (typeof raw === 'string') {
    try {
      raw = JSON.parse(raw);
    } catch {
      raw = null;
    }
  }
  return {
    allowedRoles: Array.isArray(raw?.allowedRoles) ? raw.allowedRoles.map(String) : [...ROLE_ADMIN],
    allowedUsers: Array.isArray(raw?.allowedUsers) ? raw.allowedUsers : [],
  };
}

export function rolesUser(user: any): string[] {
  return (
    Array.isArray(user?.roles) ? user.roles : String(user?.role || '').split(/[,|]/)
  )
    .map((r: string) => String(r).trim().toUpperCase())
    .filter(Boolean);
}

/**
 * Apakah `user` termasuk yang diizinkan?
 *
 * Tiga jalur, cukup salah satu terpenuhi:
 *   1. ADMIN / ADMINISTRATOR — selalu, tidak bisa dicabut.
 *   2. `peranBawaan` — hak yang melekat di kode untuk modul ini.
 *   3. `konfig` — role atau pengguna yang ditunjuk admin lewat Hak Akses Fitur.
 */
export function aksesDiizinkan(
  user: any,
  konfig: KonfigurasiAkses,
  peranBawaan: string[] = [],
): boolean {
  const roles = rolesUser(user);

  if (roles.some((r) => ROLE_ADMIN.includes(r))) return true;
  if (peranBawaan.some((r) => roles.includes(String(r).trim().toUpperCase()))) return true;
  if (konfig.allowedRoles.some((r) => roles.includes(String(r).trim().toUpperCase()))) return true;

  const idUser = String(user?.id ?? '');
  const nipUser = String(user?.nip ?? '');
  return konfig.allowedUsers.some((u) => {
    const id = String(u?.id ?? '');
    const nip = String(u?.nip ?? '');
    return (!!idUser && id === idUser) || (!!nipUser && nip === nipUser);
  });
}

@Injectable()
export class FeatureAccessGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const aturan = this.reflector.getAllAndOverride<AturanFitur>(FEATURE_ACCESS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!aturan?.settingKey) return true;

    const req = context.switchToHttp().getRequest();

    const expectedKey = process.env.INTERNAL_API_KEY;
    if (expectedKey && req.headers['x-internal-key'] === expectedKey) return true;

    const keys = Array.isArray(aturan.settingKey) ? aturan.settingKey : [aturan.settingKey];
    let diizinkan = false;

    for (const key of keys) {
      const konfig = await this.bacaKonfigurasi(key);
      if (aksesDiizinkan(req.user, konfig, aturan.peranBawaan || [])) {
        diizinkan = true;
        break;
      }
    }

    if (!diizinkan) {
      throw new ForbiddenException(
        'Akses ditolak. Anda bukan pengelola modul ini — hubungi admin untuk diberi Hak Akses Fitur.',
      );
    }
    return true;
  }

  /** Baris belum pernah dibuat → hanya ADMIN + peran bawaan, seperti sebelum fitur ini ada. */
  async bacaKonfigurasi(settingKey: string): Promise<KonfigurasiAkses> {
    const row = await this.prisma.site_settings.findUnique({
      where: { key: settingKey },
      select: { value: true },
    });
    return parseKonfigurasiAkses(row?.value);
  }
}
