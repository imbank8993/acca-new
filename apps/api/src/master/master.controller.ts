import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Param,
  Post,
  Put,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AccessService } from '../access/access.service';
import { PrismaService } from '../prisma/prisma.service';
import { aksesDiizinkan, parseKonfigurasiAkses } from '../auth/feature-access.guard';
import { MasterService, type ListQuery } from './master.service';

/**
 * Penanda akun SISWA. Sekali role ini ada, akunnya adalah siswa — titik.
 *
 * Role tambahan tidak mengubahnya. Di data nyata ada 9 akun `SISWA,PENGURUS_KELAS`
 * dan 1 akun `SISWA,BANKDATA`; semuanya siswa (username-nya NISN). Pemeriksaan
 * versi pertama memakai `roles.some(r => !BUKAN_PEGAWAI.includes(r))`, yang
 * meloloskan mereka sebagai pegawai hanya karena punya SATU role di luar daftar —
 * artinya justru jenis akun yang paling ingin dibatasi tetap bisa memanen daftar.
 */
const ROLE_SISWA = ['SISWA'];

/**
 * Role yang bukan pegawai madrasah, tetapi BOLEH berdampingan dengan role pegawai.
 *
 * `ORANG_TUA` sengaja di sini, bukan di `ROLE_SISWA`: ada akun `TU,ORANG_TUA` —
 * pegawai TU yang juga orang tua siswa — dan dia tetap harus dapat akses pegawai.
 * `TAMU` ikut karena akun tamu tidak mewakili pegawai mana pun.
 */
const BUKAN_PEGAWAI = ['ORANG_TUA', 'ORANGTUA', 'TAMU'];

/**
 * Entitas yang barisnya adalah daftar orang. Dibedakan dari entitas referensi
 * (kelas, mapel, waktu) karena daftar orang tidak boleh diambil borongan oleh
 * akun siswa dan orang tua — lihat MasterController.list().
 */
const ENTITAS_ORANG = ['siswa', 'guru'];

/**
 * Kunci "Hak Akses Fitur" per TAB master data.
 *
 * Hanya ADMIN yang melekat di kode. Pengelola tiap tab ditentukan lewat layar
 * Pengaturan Users → Hak Akses Fitur, satu baris `site_settings` per tab, jadi
 * wewenangnya bisa dipecah: "TU mengelola tab Siswa" tanpa ikut membuka tab
 * Pegawai atau Tahun Ajaran.
 *
 * Kuncinya dipetakan dari `entity` pada route `/master/:entity`, supaya gerbang
 * dan tab yang dilihat pengguna tidak bisa menyimpang. Tab Guru dan Tendik
 * berbagi satu kunci karena keduanya satu tabel (`master_guru`) yang dibedakan
 * hanya oleh kolom `jenis_pegawai`.
 */
const MASTER_TAB_ACCESS: Record<string, string> = {
  siswa: 'master_siswa_access_config',
  guru: 'master_guru_access_config',
  kelas: 'master_kelas_access_config',
  mapel: 'master_mapel_access_config',
  waktu: 'master_waktu_access_config',
  'kode-guru': 'master_kode_guru_access_config',
  'jp-mapel': 'master_jp_mapel_access_config',
  'mapel-kelas': 'master_mapel_access_config',
  'tahun-ajaran': 'master_tahun_ajaran_access_config',
};

/** Kunci untuk tab Ekstrakurikuler; dipakai EkskulController. */
export const MASTER_EKSKUL_ACCESS_KEY = 'master_ekskul_access_config';

/** Semua kunci tab, untuk endpoint ringkasan wewenang. */
export const SEMUA_KUNCI_TAB = [
  ...new Set([...Object.values(MASTER_TAB_ACCESS), MASTER_EKSKUL_ACCESS_KEY]),
];

@ApiTags('Master Data')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('master')
export class MasterController {
  constructor(
    private readonly masterService: MasterService,
    private readonly accessService: AccessService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Satu sumber kebenaran untuk tiga tingkat izin di controller ini:
   *
   *   1. Membaca baris referensi — semua PEGAWAI yang login. Puluhan halaman
   *      memakai daftar ini sebagai sumber dropdown dan hanya perlu nomor induk
   *      + nama. Akun siswa dan orang tua tidak termasuk.
   *   2. Menulis, dan membaca kolom pribadi — role ADMIN (melekat di kode),
   *      ATAU ditunjuk di "Hak Akses Fitur" untuk TAB YANG BERSANGKUTAN.
   *   3. Aksi merusak (mutasi jenis pegawai, `?scope=all`) — tingkat yang sama
   *      dengan (2), sesuai keputusan bahwa HANYA role ADMIN yang melekat di kode
   *      dan sisanya diatur dari layar Hak Akses Fitur. Yang menjaganya bukan lagi
   *      role, melainkan konfirmasi eksplisit di `remove()`.
   *
   * Wewenangnya per tab, bukan per halaman: `entity` menentukan baris
   * `site_settings` mana yang dibaca (lihat MASTER_TAB_ACCESS). Tanpa `entity`,
   * hanya ADMIN yang lolos — dipakai endpoint yang tidak terikat satu tab.
   *
   * Tabel `role_pages` (tab "Akses per Role") sengaja TIDAK ikut menentukan: itu
   * mengatur navigasi, bukan wewenang.
   */
  private async resolveFlags(req: any, entity?: string) {
    const kunci = entity ? MASTER_TAB_ACCESS[entity] : undefined;

    const [access, konfigRow] = await Promise.all([
      this.accessService.resolveUserAccess(req.user),
      kunci
        ? this.prisma.site_settings.findUnique({
            where: { key: kunci },
            select: { value: true },
          })
        : Promise.resolve(null),
    ]);

    const isAdmin = access.roles.some((r) => r === 'ADMIN' || r === 'ADMINISTRATOR');
    const roles = access.roles.map((r) => r.toUpperCase());
    const isSiswa = roles.some((r) => ROLE_SISWA.includes(r));
    const isPegawai = !isSiswa && roles.some((r) => !BUKAN_PEGAWAI.includes(r));

    // `aksesDiizinkan` meloloskan ADMIN tanpa bisa dicabut lewat konfigurasi.
    const ditunjuk = kunci
      ? aksesDiizinkan({ ...req.user, roles: access.roles }, parseKonfigurasiAkses(konfigRow?.value))
      : isAdmin;

    return { isAdmin, isPegawai, canManageMaster: isAdmin || ditunjuk };
  }

  /** Wewenang tiap tab untuk pemanggil, dipakai UI menyusun tab yang tampil. */
  private async resolveTabAccess(req: any) {
    const [access, rows] = await Promise.all([
      this.accessService.resolveUserAccess(req.user),
      this.prisma.site_settings.findMany({
        where: { key: { in: SEMUA_KUNCI_TAB } },
        select: { key: true, value: true },
      }),
    ]);

    const perKunci = new Map(rows.map((r) => [r.key, r.value]));
    const user = { ...req.user, roles: access.roles };
    const isAdmin = access.roles.some((r) => r === 'ADMIN' || r === 'ADMINISTRATOR');

    const boleh = (kunci: string) =>
      aksesDiizinkan(user, parseKonfigurasiAkses(perKunci.get(kunci)));

    const tabs: Record<string, boolean> = {};
    for (const [entity, kunci] of Object.entries(MASTER_TAB_ACCESS)) {
      tabs[entity] = boleh(kunci);
    }
    tabs.ekskul = boleh(MASTER_EKSKUL_ACCESS_KEY);

    return { isAdmin, tabs };
  }

  private async assertCanWrite(req: any, entity?: string) {
    const { canManageMaster } = await this.resolveFlags(req, entity);

    if (!canManageMaster) {
      throw new ForbiddenException('Anda tidak berwenang mengubah data master');
    }
  }

  /** Gerbang untuk data pribadi (alamat, nomor HP, rekening, tanggal lahir). */
  private async assertCanReadSensitive(req: any, entity: string) {
    const { canManageMaster } = await this.resolveFlags(req, entity);
    if (!canManageMaster) {
      throw new ForbiddenException('Anda tidak berwenang melihat data pribadi');
    }
  }

  /**
   * Wewenang pemanggil atas tiap tab master data.
   *
   * Satu permintaan, dihitung server. Alternatifnya adalah membuka sembilan baris
   * `site_settings` untuk dibaca klien lalu dievaluasi ulang di sana — lebih
   * banyak permintaan, dan aturannya jadi ditulis dua kali di dua bahasa.
   *
   * Didaftarkan SEBELUM `@Get(':entity')` supaya tidak tertangkap route itu.
   */
  @Get('my-access')
  @ApiOperation({ summary: 'Wewenang pemanggil per tab master data' })
  async getMyAccess(@Request() req: any) {
    return { ok: true, ...(await this.resolveTabAccess(req)) };
  }

  @Get('dropdown')
  @ApiOperation({ summary: 'Ambil opsi dropdown master data (ketidakhadiran, pangkat, dll)' })
  async getDropdown() {
    return { ok: true, data: await this.masterService.getDropdowns() };
  }

  @Post('jp-mapel/bulk')
  @ApiOperation({ summary: 'Bulk insert atau upsert jp-mapel' })
  async bulkJpMapel(@Request() req: any, @Body() body: any) {
    await this.assertCanWrite(req, 'jp-mapel');
    return { ok: true, ...(await this.masterService.bulkCreateJpMapel(body)) };
  }

  @Get('mapel-kelas/mappings')
  @ApiOperation({ summary: 'Daftar pemetaan mapel ke kelas dan guru' })
  async getMapelKelas(
    @Query('kelas') kelas: string,
    @Query('tahun_ajaran') tahunAjaran: string,
  ) {
    return { ok: true, data: await this.masterService.getMapelKelas(kelas, tahunAjaran) };
  }

  @Post('mapel-kelas/mappings')
  @ApiOperation({ summary: 'Simpan pemetaan mapel ke kelas dan guru' })
  async saveMapelKelas(@Request() req: any, @Body() body: any) {
    await this.assertCanWrite(req, 'mapel-kelas');
    return { ok: true, ...(await this.masterService.saveMapelKelas(body)) };
  }

  @Get('guru/rekening')
  @ApiOperation({ summary: 'Ambil daftar rekening guru (Admin / pemegang Hak Akses Fitur)' })
  async getGuruRekening(@Request() req: any, @Query('nip') nip: string) {
    await this.assertCanReadSensitive(req, 'guru');
    return { ok: true, data: await this.masterService.getGuruRekening(nip) };
  }

  @Get('guru/pindah')
  @ApiOperation({ summary: 'Ringkasan dampak penugasan sebelum mutasi guru/tendik' })
  async getPindah(@Request() req: any, @Query('nip') nip: string) {
    await this.assertCanWrite(req, 'guru');
    return { ok: true, data: await this.masterService.getPindahPreview(nip) };
  }

  @Post('guru/pindah')
  @ApiOperation({ summary: 'Eksekusi mutasi jenis pegawai guru <-> tendik' })
  async postPindah(@Request() req: any, @Body() body: any) {
    await this.assertCanWrite(req, 'guru');
    return { ok: true, data: await this.masterService.executePindah(body.nip, body.tujuan) };
  }

  /**
   * Langkah pra-simpan milik alur impor, jadi izinnya disamakan dengan menulis:
   * responsnya memasangkan baris berkas Excel dengan baris database dan ikut
   * mengembalikan potongan data yang cocok.
   */
  @Post('check-import')
  @ApiOperation({ summary: 'Cek konflik data impor sebelum simpan' })
  async checkImport(@Request() req: any, @Body() body: any) {
    // `type` menentukan tab mana yang sedang diimpor: 'siswa' | 'guru' | 'mapel'.
    await this.assertCanWrite(req, String(body?.type || ''));
    return { ok: true, ...(await this.masterService.checkImport(body.type, body.data)) };
  }

  /**
   * Barisnya terbuka untuk pegawai yang login — puluhan halaman memakai daftar
   * ini sebagai sumber dropdown dan cuma perlu nomor induk + nama. Kolom
   * pribadinya tidak: tanpa role ADMIN, `sensitiveFields` (alamat, nomor HP,
   * tanggal lahir, nomor rekening) dibuang dari respons.
   *
   * Akun siswa dan orang tua tidak ikut. Mereka tidak punya halaman yang
   * membaca daftar ini, sedangkan yang tetap terkirim setelah redaksi —
   * `nisn` + `nama_lengkap` — adalah persis daftar username akun siswa (NISN
   * dipakai sebagai username, lihat dashboard.service.ts). Satu akun siswa
   * cukup untuk memanen seluruh daftar akun seangkatan.
   */
  @Get(':entity')
  @ApiOperation({ summary: 'Daftar data master (pencarian, filter, paginasi)' })
  async list(@Request() req: any, @Param('entity') entity: string, @Query() query: ListQuery) {
    const { canManageMaster, isPegawai } = await this.resolveFlags(req, entity);
    if (ENTITAS_ORANG.includes(entity) && !isPegawai && !canManageMaster) {
      throw new ForbiddenException('Anda tidak memiliki izin melihat daftar ini');
    }
    return { ok: true, ...(await this.masterService.list(entity, query, canManageMaster)) };
  }

  @Post(':entity')
  @ApiOperation({ summary: 'Tambah data master (atau perbarui bila ?upsert=true)' })
  async create(
    @Request() req: any,
    @Param('entity') entity: string,
    @Query('upsert') upsert: string,
    @Body() body: Record<string, any>,
  ) {
    await this.assertCanWrite(req, entity);
    return { ok: true, data: await this.masterService.create(entity, body, upsert === 'true') };
  }

  @Put(':entity')
  @ApiOperation({ summary: 'Perbarui data master' })
  async update(
    @Request() req: any,
    @Param('entity') entity: string,
    @Body() body: Record<string, any>,
  ) {
    await this.assertCanWrite(req, entity);
    return { ok: true, data: await this.masterService.update(entity, body) };
  }

  @Delete(':entity')
  @ApiOperation({
    summary: 'Nonaktifkan satu data, atau hapus permanen (?scope=all&confirm=all)',
  })
  async remove(
    @Request() req: any,
    @Param('entity') entity: string,
    @Query('id') id?: string,
    @Query('scope') scope?: string,
    @Query() fullQuery?: Record<string, string>,
  ) {
    // Wewenangnya sama dengan menulis, yaitu per tab. Yang membedakan penghapusan
    // permanen dari penonaktifan satu baris bukan lagi role, melainkan
    // `?confirm=all` yang dituntut `MasterService.remove`.
    await this.assertCanWrite(req, entity);
    return { ok: true, ...(await this.masterService.remove(entity, id || null, scope, fullQuery)) };
  }
}

