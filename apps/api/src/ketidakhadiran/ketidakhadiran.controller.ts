import {
  Controller,
  Get,
  Post,
  Patch,
  Put,
  Delete,
  Body,
  Param,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { KetidakhadiranService } from './ketidakhadiran.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PageAccessGuard, RequiresPage } from '../auth/page-access.guard';
import { PegawaiGuard } from '../auth/pegawai.guard';

/** Halaman yang isinya memang mengelola data ketidakhadiran. */
const PAGE_KELOLA = ['ketidakhadiran', 'ketidakhadiran-daftar'] as const;

/**
 * Halaman khusus DAFTAR surat ACCA.
 *
 * `PageAccessGuard` meloloskan pemanggil yang memegang SALAH SATU halaman yang
 * disebut. Karena `ketidakhadiran` juga dipegang role `TAMU` — akun tamu yang di
 * modul lain justru digolongkan `BUKAN_PEGAWAI`, dan salah satunya milik
 * madrasah luar — memakai `PAGE_KELOLA` untuk daftar surat berarti tamu ikut
 * membaca seluruh surat izin siswa. Isinya bukan cuma nama dan kelas: ada
 * `barcode`, dan barcode itulah kunci `GET /ketidakhadiran/pdf-preview`. Jadi
 * yang bocor bukan hanya daftarnya, tapi juga setiap PDF suratnya.
 *
 * Daftar karenanya digerbangi halaman daftarnya sendiri, yang dipegang ADMIN,
 * OP_IZIN, dan OP_UKS saja. Pencetakan di tab Input Data tidak terpengaruh:
 * pemegang `ketidakhadiran-daftar` adalah himpunan yang sama dengan pemakai tab
 * itu, dan hanya `TAMU` yang kehilangan akses.
 */
const PAGE_DAFTAR_SURAT = ['ketidakhadiran-daftar'] as const;

@Controller('ketidakhadiran')
@UseGuards(JwtAuthGuard, PageAccessGuard)
export class KetidakhadiranController {
  constructor(private readonly ketidakhadiranService: KetidakhadiranService) {}

  private getApiUser(reqUser: any) {
    // `roles` hasil JwtStrategy sudah termasuk duty role (wali kelas, guru asuh,
    // dsb). Versi lama hanya mengurai kolom mentah `role`, sehingga hak yang
    // melekat dari penugasan tidak pernah terbaca di modul ini.
    const roles: string[] = Array.isArray(reqUser?.roles)
      ? reqUser.roles.map((r: string) => String(r).toUpperCase().replace(/\s+/g, '_'))
      : reqUser?.role
        ? reqUser.role.split(/[,|]/).map((r: string) => r.trim().toUpperCase().replace(/\s+/g, '_')).filter(Boolean)
        : [];
    const isAdmin = roles.includes('ADMIN') || roles.includes('ADMINISTRATOR');
    const nip = reqUser?.nip || '';
    const username = reqUser?.username || '';
    const authId = reqUser?.auth_id;
    const nama_lengkap = reqUser?.nama_lengkap || reqUser?.nama || '';
    const nama = reqUser?.nama || '';

    return { nip, username, roles, isAdmin, authId, id: reqUser?.id, nama_lengkap, nama };
  }

  /**
   * NIP yang boleh dilihat pemanggil.
   *
   * `?nip=` hanya dihormati untuk Admin dan operator izin/UKS; selain itu
   * identitas diambil dari sesi. Sebelumnya `query.nip || apiUser.nip` membuat
   * siapa pun bisa membaca rekap ketidakhadiran milik guru lain hanya dengan
   * menebak NIP di query string.
   */
  private resolveNip(apiUser: any, queryNip?: string): string {
    const boleh =
      apiUser.isAdmin ||
      apiUser.roles.includes('OP_IZIN') ||
      apiUser.roles.includes('OP_UKS');
    return boleh && queryNip ? queryNip : apiUser.nip;
  }

  // --- LOG ROUTES ---
  @Get('log')
  async getLog(@Req() req: any, @Query() query: any) {
    const apiUser = this.getApiUser(req.user);
    return this.ketidakhadiranService.getLog(query, apiUser);
  }

  @Get('log/guru-asuh')
  async getLogGuruAsuh(@Req() req: any, @Query() query: any) {
    const apiUser = this.getApiUser(req.user);
    return this.ketidakhadiranService.getLogGuruAsuh(
      this.resolveNip(apiUser, query.nip),
      query.tahun_ajaran,
    );
  }

  @Get('log/wali-kelas')
  async getLogWaliKelas(@Req() req: any, @Query() query: any) {
    const apiUser = this.getApiUser(req.user);
    // `query.isAdmin` TIDAK lagi ikut menentukan. Sebelumnya cukup menambahkan
    // `?isAdmin=true` di URL untuk dilayani sebagai admin — status istimewa
    // datang dari string yang diketik pemanggil sendiri.
    return this.ketidakhadiranService.getLogWaliKelas(
      this.resolveNip(apiUser, query.nip),
      query.tahun_ajaran,
      apiUser.isAdmin,
      query.kelas,
    );
  }

  @Get('log/siswa/:nisn')
  async getLogSiswa(
    @Req() req: any,
    @Param('nisn') nisn: string,
    @Query('tahun_ajaran') tahunAjaran?: string,
  ) {
    const apiUser = this.getApiUser(req.user);
    return this.ketidakhadiranService.getLogSiswa(nisn, tahunAjaran, apiUser);
  }

  // --- ABSENSI & REKAP ---
  @Get('absensi')
  @UseGuards(PegawaiGuard)
  @RequiresPage(...PAGE_KELOLA, 'absensi')
  async getAbsensi(@Query() query: any) {
    const { kelas, tanggal, jam_ke } = query;
    return this.ketidakhadiranService.getAbsensi(
      kelas,
      tanggal,
      jam_ke ? parseInt(jam_ke) : undefined,
    );
  }

  @Get('rekap')
  @UseGuards(PegawaiGuard)
  @RequiresPage(...PAGE_KELOLA)
  async getRekap(@Query() query: any) {
    return this.ketidakhadiranService.getRekap(query);
  }

  /* --- REKAM MEDIS SISWA (UKS) ---
     Isinya data kesehatan: riwayat penyakit, riwayat alergi obat, keluhan,
     tindakan — plus tanggal lahir dan alamat siswa. Digerbangi ke
     halaman `rekam-medis` dan PegawaiGuard agar hanya staf sekolah yang berhak. */
  @Get('rekam-medis-siswa')
  @UseGuards(PegawaiGuard)
  @RequiresPage('rekam-medis')
  async getRekamMedisSiswa(@Query() query: any) {
    return this.ketidakhadiranService.getRekamMedisSiswa(query);
  }

  @Post('rekam-medis-siswa')
  @UseGuards(PegawaiGuard)
  @RequiresPage('rekam-medis')
  async createRekamMedisSiswa(
    @Req() req: any,
    @Body() body: any,
    @Query('action') action?: string,
  ) {
    const apiUser = this.getApiUser(req.user);
    if (action === 'save_presets' || body?.action === 'save_presets') {
      return this.ketidakhadiranService.savePresets(body.presets || body, apiUser);
    }
    if (action === 'sync_ketidakhadiran' || body?.action === 'sync_ketidakhadiran') {
      return this.ketidakhadiranService.syncKetidakhadiran(body.id, body.mappedStatus, apiUser);
    }
    return this.ketidakhadiranService.createRekamMedisSiswa(body, apiUser);
  }

  @Put('rekam-medis-siswa/:id')
  @UseGuards(PegawaiGuard)
  @RequiresPage('rekam-medis')
  async updateRekamMedisSiswa(
    @Req() req: any,
    @Param('id') id: string,
    @Body() body: any,
  ) {
    const apiUser = this.getApiUser(req.user);
    return this.ketidakhadiranService.updateRekamMedisSiswa(id, body, apiUser);
  }

  @Put('rekam-medis-siswa')
  @UseGuards(PegawaiGuard)
  @RequiresPage('rekam-medis')
  async updateRekamMedisSiswaByBody(
    @Req() req: any,
    @Body() body: any,
    @Query('id') queryId?: string,
  ) {
    const apiUser = this.getApiUser(req.user);
    const id = body?.id || queryId;
    return this.ketidakhadiranService.updateRekamMedisSiswa(id, body, apiUser);
  }

  @Delete('rekam-medis-siswa/:id')
  @UseGuards(PegawaiGuard)
  @RequiresPage('rekam-medis')
  async deleteRekamMedisSiswa(@Req() req: any, @Param('id') id: string) {
    const apiUser = this.getApiUser(req.user);
    return this.ketidakhadiranService.deleteRekamMedisSiswa(id, apiUser);
  }

  @Delete('rekam-medis-siswa')
  @UseGuards(PegawaiGuard)
  @RequiresPage('rekam-medis')
  async deleteRekamMedisSiswaByQuery(@Req() req: any, @Query('id') id: string) {
    const apiUser = this.getApiUser(req.user);
    return this.ketidakhadiranService.deleteRekamMedisSiswa(id, apiUser);
  }

  // --- ACCA LETTER ROUTES (harus sebelum wildcard :id) ---
  @Get('acca-letter/verify')
  async verifyAccaLetter(@Query('barcode') barcode: string) {
    return this.ketidakhadiranService.verifyAccaLetter(barcode);
  }

  @Get('acca-letter')
  @UseGuards(PegawaiGuard)
  @RequiresPage(...PAGE_DAFTAR_SURAT)
  async getAccaLetters(@Query() query: any) {
    return this.ketidakhadiranService.getAccaLetters(query);
  }

  @Post('acca-letter')
  @UseGuards(PegawaiGuard)
  @RequiresPage(...PAGE_KELOLA)
  async createAccaLetter(@Req() req: any, @Body() body: any) {
    const origin = req.headers.origin || 'https://acca.icgowa.sch.id';
    return this.ketidakhadiranService.createAccaLetter(body, origin);
  }

  @Delete('acca-letter/:id')
  @UseGuards(PegawaiGuard)
  @RequiresPage(...PAGE_KELOLA)
  async deleteAccaLetter(@Req() req: any, @Param('id') id: string) {
    const apiUser = this.getApiUser(req.user);
    return this.ketidakhadiranService.deleteAccaLetter(id, apiUser);
  }

  @Post('save-letter')
  @UseGuards(PegawaiGuard)
  @RequiresPage(...PAGE_KELOLA)
  async saveAccaLetter(@Body() body: any) {
    return this.ketidakhadiranService.saveAccaLetter(body);
  }

  // --- STANDARD CRUD ---
  @Get()
  @UseGuards(PegawaiGuard)
  @RequiresPage(...PAGE_KELOLA, 'absensi')
  async list(@Req() req: any, @Query() query: any) {
    const apiUser = this.getApiUser(req.user);
    const filter = {
      kelas: query.kelas,
      jenis: query.jenis,
      status: query.status,
      from: query.from,
      to: query.to,
      q: query.q,
      months: query.months,
      page: query.page ? parseInt(query.page) : undefined,
      limit: query.limit ? parseInt(query.limit) : undefined,
      asramaQueue: query.asramaQueue === '1' || query.asramaQueue === 'true',
    };
    const result = await this.ketidakhadiranService.findAll(apiUser, filter);
    return { ok: true, ...result };
  }

  @Post('bulk')
  @UseGuards(PegawaiGuard)
  @RequiresPage(...PAGE_KELOLA)
  async createBulk(@Req() req: any, @Body() body: any) {
    const apiUser = this.getApiUser(req.user);
    return this.ketidakhadiranService.createBulk(apiUser, body);
  }

  @Get(':id')
  @UseGuards(PegawaiGuard)
  @RequiresPage(...PAGE_KELOLA)
  async getOne(@Param('id') id: string) {
    const data = await this.ketidakhadiranService.findById(id);
    return { ok: true, data };
  }

  @Patch(':id')
  @UseGuards(PegawaiGuard)
  @RequiresPage(...PAGE_KELOLA)
  async update(@Req() req: any, @Param('id') id: string, @Body() body: any) {
    const apiUser = this.getApiUser(req.user);
    return this.ketidakhadiranService.update(id, body, apiUser);
  }

  @Delete(':id')
  @UseGuards(PegawaiGuard)
  @RequiresPage(...PAGE_KELOLA)
  async remove(
    @Req() req: any,
    @Param('id') id: string,
    @Query('scope') scope?: string,
  ) {
    const apiUser = this.getApiUser(req.user);
    return this.ketidakhadiranService.remove(id, apiUser, scope);
  }
}


