import { Controller, Get, Post, Put, Delete, Query, Body, UseGuards, Request, ForbiddenException } from '@nestjs/common';
import { SettingsService } from './settings.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { FeatureAccess, FeatureAccessGuard, JADWAL_GENERATE_KEY } from '../auth/feature-access.guard';
import { AccessService } from '../access/access.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  aksesDiizinkan,
  parseKonfigurasiAkses,
  PENGATURAN_DATA_ACCESS_KEYS,
  PENGATURAN_TUGAS_ACCESS_KEYS,
  type PengaturanDataTab,
  type PengaturanTugasTab,
} from '../auth/feature-access.guard';

/**
 * Aturannya sama dengan master.controller.ts — lihat penjelasan lengkap di sana.
 *
 * Ringkasnya: role `SISWA` membuat akun itu siswa apa pun role tambahannya
 * (ada `SISWA,PENGURUS_KELAS` dan `SISWA,BANKDATA` di data nyata), sedangkan
 * `ORANG_TUA` boleh berdampingan dengan role pegawai (ada `TU,ORANG_TUA`).
 */
const ROLE_SISWA = ['SISWA'];
const BUKAN_PEGAWAI = ['ORANG_TUA', 'ORANGTUA', 'TAMU'];

// Controller ini sebelumnya TIDAK punya guard sama sekali: `/api/settings/*`
// (termasuk DELETE jadwal-guru?delete_all=true) bisa dipanggil tanpa token
// oleh siapa pun yang dapat menjangkau port NestJS. Guard kelas menutup itu;
// pemanggilan antar-service tetap lolos lewat header `x-internal-key`.
@UseGuards(JwtAuthGuard, RolesGuard, FeatureAccessGuard)
@Controller('settings')
export class SettingsController {
  constructor(
    private readonly settingsService: SettingsService,
    private readonly accessService: AccessService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Gerbang wewenang per tab halaman Pengaturan Data.
   *
   * Hanya ADMIN yang melekat di kode (dijamin `aksesDiizinkan`); sisanya ditunjuk
   * di Pengaturan Users -> Hak Akses Fitur. Menggantikan dekorator `@Roles` dengan
   * daftar role tertanam, yang tidak bisa diubah tanpa deploy dan tidak bisa
   * menunjuk satu orang tertentu.
   */
  private async assertTabAccess(req: any, tab: PengaturanDataTab) {
    await this.assertAkses(req, PENGATURAN_DATA_ACCESS_KEYS[tab]);
  }

  /** Pasangan `assertTabAccess` untuk tab halaman Pengaturan Tugas. */
  private async assertTabTugas(req: any, tab: PengaturanTugasTab) {
    await this.assertAkses(req, PENGATURAN_TUGAS_ACCESS_KEYS[tab]);
  }

  /** Inti kedua gerbang di atas: satu baris `site_settings`, satu aturan. */
  private async assertAkses(req: any, kunci: string) {
    const [access, row] = await Promise.all([
      this.accessService.resolveUserAccess(req.user),
      this.prisma.site_settings.findUnique({ where: { key: kunci }, select: { value: true } }),
    ]);
    const boleh = aksesDiizinkan(
      { ...req.user, roles: access.roles },
      parseKonfigurasiAkses(row?.value),
    );
    if (!boleh) {
      throw new ForbiddenException(
        'Anda tidak berwenang atas bagian ini. Minta Admin menunjuk akun/role Anda di Hak Akses Fitur.',
      );
    }
  }

  /** Apakah pemanggil pengelola tab ini? Dipakai jalur yang punya dua perilaku. */
  private async bolehKelolaTugas(req: any, tab: PengaturanTugasTab): Promise<boolean> {
    const [access, row] = await Promise.all([
      this.accessService.resolveUserAccess(req.user),
      this.prisma.site_settings.findUnique({
        where: { key: PENGATURAN_TUGAS_ACCESS_KEYS[tab] },
        select: { value: true },
      }),
    ]);
    return aksesDiizinkan(
      { ...req.user, roles: access.roles },
      parseKonfigurasiAkses(row?.value),
    );
  }

  /**
   * Batas baris yang boleh dibaca pemanggil pada daftar penempatan kelas.
   *
   * `null` berarti tanpa batas — itulah perilaku untuk pegawai, yang memang
   * butuh daftar borongan (wali kelas, guru asuh, ketidakhadiran, Pengaturan
   * Data). Untuk akun siswa dan orang tua dikembalikan daftar NISN yang boleh
   * mereka lihat: NISN sendiri, atau NISN anak-anaknya. Larik kosong berarti
   * tidak ada baris yang cocok.
   *
   * `req.user` kosong pada pemanggilan antar-service lewat `x-internal-key`
   * (JwtAuthGuard meloloskannya tanpa mengisi user), dan itu memang tanpa batas.
   */
  private async resolveNisnScope(req: any): Promise<string[] | null> {
    if (!req?.user) return null;

    const access = await this.accessService.resolveUserAccess(req.user);
    const roles = access.roles.map((r) => r.toUpperCase());
    const isSiswa = roles.some((r) => ROLE_SISWA.includes(r));
    const pegawai = !isSiswa && roles.some((r) => !BUKAN_PEGAWAI.includes(r));
    if (pegawai) return null;

    return this.settingsService.getNisnMilikSendiri(req.user);
  }

  // ==========================================
  // JADWAL PIKET
  // ==========================================
  @Get('jadwal-piket')
  async getJadwalPiket(
    @Query('kelas') kelas: string,
    @Query('hari') hari: string,
    @Query('guru') guru: string,
    @Query('valid_date') validDate: string,
    @Query('as_of') asOf: string,
    @Query('distinct_dates') distinctDates: string,
    @Query('q') q: string
  ) {
    return this.settingsService.getJadwalPiket({
      kelas,
      hari,
      guru,
      validDate,
      asOf,
      distinctDates: distinctDates === 'true',
      q
    });
  }

  @Post('jadwal-piket')
  @FeatureAccess(JADWAL_GENERATE_KEY)
  async createJadwalPiket(@Body() data: any) {
    return this.settingsService.createJadwalPiket(data);
  }

  @Put('jadwal-piket')
  @FeatureAccess(JADWAL_GENERATE_KEY)
  async updateJadwalPiket(
    @Query('old_date') oldDate: string,
    @Query('new_date') newDate: string,
    @Body() data: any
  ) {
    if (oldDate && newDate) {
      return this.settingsService.updateJadwalPiketDates(oldDate, newDate);
    }
    return this.settingsService.updateJadwalPiket(data);
  }

  @Delete('jadwal-piket')
  @FeatureAccess(JADWAL_GENERATE_KEY)
  async deleteJadwalPiket(
    @Query('id') id: string,
    @Query('delete_all') deleteAll: string,
    @Query('dates') dates: string
  ) {
    return this.settingsService.deleteJadwalPiket({
      id: id ? parseInt(id, 10) : undefined,
      deleteAll: deleteAll === 'true',
      dates
    });
  }

  // ==========================================
  // JADWAL GURU
  // ==========================================
  @Get('jadwal-guru')
  async getJadwalGuru(
    @Request() req: any,
    @Query('kelas') kelas: string,
    @Query('hari') hari: string,
    @Query('guru') guru: string,
    @Query('valid_date') validDate: string,
    @Query('distinct_dates') distinctDates: string,
    @Query('q') q: string
  ) {
    // `req.user` diteruskan hanya agar `nip` bisa diredaksi untuk akun siswa dan
    // orang tua; barisnya sendiri tetap seluruh madrasah — itulah gunanya
    // "Jadwal Lengkap".
    return this.settingsService.getJadwalGuru({
      kelas,
      hari,
      guru,
      validDate,
      distinctDates: distinctDates === 'true',
      q
    }, req.user);
  }

  @Post('jadwal-guru')
  @FeatureAccess(JADWAL_GENERATE_KEY)
  async createJadwalGuru(@Body() data: any) {
    return this.settingsService.createJadwalGuru(data);
  }

  @Put('jadwal-guru')
  @FeatureAccess(JADWAL_GENERATE_KEY)
  async updateJadwalGuru(@Body() data: any) {
    return this.settingsService.updateJadwalGuru(data);
  }

  @Delete('jadwal-guru')
  @FeatureAccess(JADWAL_GENERATE_KEY)
  async deleteJadwalGuru(
    @Query('id') id: string,
    @Query('delete_all') deleteAll: string
  ) {
    return this.settingsService.deleteJadwalGuru({
      id: id ? parseInt(id, 10) : undefined,
      deleteAll: deleteAll === 'true'
    });
  }

  /**
   * Wewenang pemanggil per tab halaman Pengaturan Data.
   *
   * Satu permintaan, dihitung server — sama seperti `/master/my-access`. UI
   * memakainya untuk memutuskan tab mana yang ditampilkan, tanpa perlu membaca
   * enam baris konfigurasi lalu mengevaluasinya ulang di klien.
   */
  @Get('pengaturan-data/my-access')
  async getPengaturanDataAccess(@Request() req: any) {
    const [access, rows] = await Promise.all([
      this.accessService.resolveUserAccess(req.user),
      this.prisma.site_settings.findMany({
        where: { key: { in: Object.values(PENGATURAN_DATA_ACCESS_KEYS) } },
        select: { key: true, value: true },
      }),
    ]);

    const perKunci = new Map(rows.map((r) => [r.key, r.value]));
    const user = { ...req.user, roles: access.roles };
    const isAdmin = access.roles.some((r) => r === 'ADMIN' || r === 'ADMINISTRATOR');

    const tabs: Record<string, boolean> = {};
    for (const [tab, kunci] of Object.entries(PENGATURAN_DATA_ACCESS_KEYS)) {
      tabs[tab] = aksesDiizinkan(user, parseKonfigurasiAkses(perKunci.get(kunci)));
    }

    return { ok: true, isAdmin, tabs };
  }

  /**
   * Pasangan endpoint di atas untuk halaman Pengaturan Tugas.
   *
   * Tidak ada peran bawaan selain ADMIN — sama seperti Master Data dan Pengaturan
   * Data. Tab "Pembina Ekskul" sempat ikut meloloskan WKM_KESISWAAN di sini karena
   * `EkskulService.isManager` melakukannya; jalur itu sudah dicabut, jadi WKM
   * Kesiswaan perlu ditunjuk di layar Hak Akses Fitur seperti role lainnya.
   */
  @Get('pengaturan-tugas/my-access')
  async getPengaturanTugasAccess(@Request() req: any) {
    const [access, rows] = await Promise.all([
      this.accessService.resolveUserAccess(req.user),
      this.prisma.site_settings.findMany({
        where: { key: { in: Object.values(PENGATURAN_TUGAS_ACCESS_KEYS) } },
        select: { key: true, value: true },
      }),
    ]);

    const perKunci = new Map(rows.map((r) => [r.key, r.value]));
    const user = { ...req.user, roles: access.roles };
    const isAdmin = access.roles.some((r) => r === 'ADMIN' || r === 'ADMINISTRATOR');

    const tabs: Record<string, boolean> = {};
    for (const [tab, kunci] of Object.entries(PENGATURAN_TUGAS_ACCESS_KEYS)) {
      tabs[tab] = aksesDiizinkan(user, parseKonfigurasiAkses(perKunci.get(kunci)));
    }

    return { ok: true, isAdmin, tabs };
  }

  // ==========================================
  // SISWA KELAS
  // ==========================================
  /**
   * Daftar penempatan kelas. Dulu cukup "sudah login" tanpa pemeriksaan role
   * apa pun, tanpa batas jumlah baris, dan `?tahun_ajaran=Semua` melepas
   * penyaring tahun sepenuhnya — jadi satu akun siswa bisa memulangkan NISN +
   * nama + kelas seluruh siswa untuk semua tahun ajaran sekaligus. NISN adalah
   * username login siswa, jadi daftar itu setara daftar seluruh akun siswa.
   *
   * Sekarang pemanggil non-pegawai dibatasi pada barisnya sendiri (atau baris
   * anak-anaknya, untuk orang tua) lewat `nisnScope`.
   */
  @Get('siswa-kelas')
  async getSiswaKelas(
    @Request() req: any,
    @Query('q') q: string,
    @Query('tahun_ajaran') tahun_ajaran: string,
    @Query('semester') semester: string,
    @Query('kelas') kelas: string,
    @Query('related_kelas') related_kelas: string,
    @Query('homeroom_kelas') homeroom_kelas: string,
    @Query('limit') limit: string
  ) {
    const nisnScope = await this.resolveNisnScope(req);
    return this.settingsService.getSiswaKelas({
      q,
      tahun_ajaran,
      semester,
      kelas,
      related_kelas,
      homeroom_kelas,
      limit,
      nisnScope,
    });
  }

  @Post('siswa-kelas')
  async createSiswaKelas(@Request() req: any, @Body() data: any) {
    await this.assertTabAccess(req, 'siswa_kelas');
    return this.settingsService.createSiswaKelas(data);
  }

  @Put('siswa-kelas')
  async updateSiswaKelas(@Request() req: any, @Body() data: any) {
    await this.assertTabAccess(req, 'siswa_kelas');
    return this.settingsService.updateSiswaKelas(data);
  }

  @Delete('siswa-kelas')
  async deleteSiswaKelas(
    @Request() req: any,
    @Query('id') id: string,
    @Query('scope') scope: string,
    @Query('years') years: string,
    @Query('field') field: string,
    @Query('confirm') confirm: string
  ) {
    await this.assertTabAccess(req, 'siswa_kelas');
    return this.settingsService.deleteSiswaKelas({
      id: id ? parseInt(id, 10) : undefined,
      scope,
      years,
      confirm,
      field,
    });
  }

  // ==========================================
  // GURU MAPEL
  // ==========================================
  @Get('guru-mapel')
  async getGuruMapel(
    @Query('q') q: string,
    @Query('page') page: string,
    @Query('limit') limit: string
  ) {
    return this.settingsService.getGuruMapel({ q, page, limit });
  }

  @Post('guru-mapel')
  async createGuruMapel(@Request() req: any, @Body() data: any) {
    await this.assertTabAccess(req, 'guru_mapel');
    return this.settingsService.createGuruMapel(data);
  }

  @Put('guru-mapel')
  async updateGuruMapel(@Request() req: any, @Body() data: any) {
    await this.assertTabAccess(req, 'guru_mapel');
    return this.settingsService.updateGuruMapel(data);
  }

  @Delete('guru-mapel')
  async deleteGuruMapel(
    @Request() req: any,
    @Query('id') id: string,
    @Query('scope') scope: string,
    @Query('years') years: string,
    @Query('field') field: string,
    @Query('confirm') confirm: string
  ) {
    await this.assertTabAccess(req, 'guru_mapel');
    return this.settingsService.deleteGuruMapel({
      id: id ? parseInt(id, 10) : undefined,
      scope,
      years,
      confirm,
      field,
    });
  }

  // ==========================================
  // WALI KELAS
  // ==========================================
  @Get('wali-kelas')
  async getWaliKelas(
    @Query('q') q: string,
    @Query('nip') nip: string,
    @Query('tahun_ajaran') tahun_ajaran: string,
    @Query('semester') semester: string,
    @Query('page') page: string,
    @Query('limit') limit: string
  ) {
    return this.settingsService.getWaliKelas({ q, nip, tahun_ajaran, semester, page, limit });
  }

  @Post('wali-kelas')
  async createWaliKelas(@Request() req: any, @Body() data: any) {
    await this.assertTabTugas(req, 'wali_kelas');
    return this.settingsService.createWaliKelas(data);
  }

  @Put('wali-kelas')
  async updateWaliKelas(@Request() req: any, @Body() data: any) {
    await this.assertTabTugas(req, 'wali_kelas');
    return this.settingsService.updateWaliKelas(data);
  }

  @Delete('wali-kelas')
  async deleteWaliKelas(
    @Request() req: any,
    @Query('id') id: string,
    @Query('scope') scope: string,
    @Query('years') years: string,
    @Query('field') field: string
  ) {
    await this.assertTabTugas(req, 'wali_kelas');
    return this.settingsService.deleteWaliKelas({
      id: id ? id : undefined,
      scope,
      years,
      field,
    });
  }

  // ==========================================
  // GURU ASUH
  // ==========================================
  @Get('guru-asuh')
  async getGuruAsuh(
    @Query('q') q: string,
    @Query('nip') nip: string,
    @Query('tahun_ajaran') tahun_ajaran: string,
    @Query('page') page: string,
    @Query('limit') limit: string
  ) {
    return this.settingsService.getGuruAsuh({ q, nip, tahun_ajaran, page, limit });
  }

  /**
   * `bolehKelola` diteruskan ke service, menggantikan `apiUser.role === 'ADMIN'`
   * di dalamnya. Perbandingan itu memakai string role UTUH, sedangkan ketiga akun
   * admin di basis data ini berrole gabungan (`ADMIN,GURU`, dst) — jadi tidak
   * pernah ada yang lolos, dan cabang `if (!isAdmin) throw 'Akses ditolak.'`
   * menolak semua orang. Guru biasa tetap hanya boleh mengurus siswa asuhnya.
   */
  @UseGuards(JwtAuthGuard)
  @Post('guru-asuh')
  async createGuruAsuh(@Body() data: any, @Request() req: any) {
    const bolehKelola = await this.bolehKelolaTugas(req, 'guru_asuh');
    return this.settingsService.createGuruAsuh(data, req.user, bolehKelola);
  }

  @UseGuards(JwtAuthGuard)
  @Put('guru-asuh')
  async updateGuruAsuh(@Body() data: any, @Request() req: any) {
    const bolehKelola = await this.bolehKelolaTugas(req, 'guru_asuh');
    return this.settingsService.updateGuruAsuh(data, req.user, bolehKelola);
  }

  @UseGuards(JwtAuthGuard)
  @Delete('guru-asuh')
  async deleteGuruAsuh(
    @Query('id') id: string,
    @Query('scope') scope: string,
    @Query('years') years: string,
    @Query('field') field: string,
    @Query('confirm') confirm: string,
    @Request() req: any
  ) {
    const bolehKelola = await this.bolehKelolaTugas(req, 'guru_asuh');
    return this.settingsService.deleteGuruAsuh({
      id: id ? id : undefined,
      scope,
      years,
      field,
      confirm,
    }, req.user, bolehKelola);
  }

  @Get('guru-mapel/check')
  async checkGuruMapel(
    @Query('nip') nip: string,
    @Query('tahun_ajaran') tahunAjaran: string,
    @Query('semester') semester: string
  ) {
    return this.settingsService.checkGuruMapel(nip, tahunAjaran, semester);
  }

  @Post('jadwal-guru/import')
  @FeatureAccess(JADWAL_GENERATE_KEY)
  async importJadwalGuru(@Body() body: any[]) {
    return this.settingsService.importJadwalGuru(body);
  }

  @Post('jadwal-piket/import')
  @FeatureAccess(JADWAL_GENERATE_KEY)
  async importJadwalPiket(@Body() body: any[]) {
    return this.settingsService.importJadwalPiket(body);
  }

  @Get('um-lock/debug')
  async getUmLockDebug(@Query('tahun_ajaran') tahunAjaran: string) {
    return this.settingsService.getUmLockDebug(tahunAjaran);
  }

  @Post('um-lock/debug')
  @Roles('ADMIN', 'ADMINISTRATOR')
  async updateUmLockDebug(@Body() body: { tahun_ajaran: string; locked: boolean }) {
    return this.settingsService.updateUmLockDebug(body.tahun_ajaran, body.locked);
  }
}

