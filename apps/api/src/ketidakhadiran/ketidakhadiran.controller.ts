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
  ParseUUIDPipe,
  BadRequestException,
} from '@nestjs/common';
import { KetidakhadiranService } from './ketidakhadiran.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PageAccessGuard, RequiresPage } from '../auth/page-access.guard';
import { AccessService } from '../access/access.service';
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
  constructor(
    private readonly ketidakhadiranService: KetidakhadiranService,
    private readonly accessService: AccessService,
  ) {}

  private async getPageReader(reqUser: any) {
    const access = await this.accessService.resolveUserAccess(reqUser);
    return { ...this.getApiUser(reqUser), canReadPage: access.pageIds.includes('ketidakhadiran') };
  }

  @Get('siswa')
  @RequiresPage('ketidakhadiran')
  async getStudents() {
    return this.ketidakhadiranService.getPageStudents();
  }

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

  private validId(id: unknown): string {
    if (typeof id !== 'string' || !/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(id)) throw new BadRequestException('ID data tidak valid');
    return id;
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
    return boleh && queryNip ? queryNip : (apiUser.nip || apiUser.username || '');
  }

  // --- LOG ROUTES ---
  @Get('log')
  async getLog(@Req() req: any, @Query() query: any) {
    return this.ketidakhadiranService.getLog(query, await this.getPageReader(req.user));
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
    return this.ketidakhadiranService.getLogSiswa(nisn, tahunAjaran, await this.getPageReader(req.user));
  }

  // --- ABSENSI & REKAP ---
  @Get('absensi')
  @UseGuards(PegawaiGuard)
  @RequiresPage(...PAGE_KELOLA, 'absensi')
  async getAbsensi(@Req() req: any, @Query() query: any) {
    const { kelas, tanggal, jam_ke } = query;
    return this.ketidakhadiranService.getAbsensi(
      kelas,
      tanggal,
      jam_ke ? Number(jam_ke) : undefined, this.getApiUser(req.user),
    );
  }

  @Get('rekap')
  @RequiresPage(...PAGE_KELOLA)
  async getRekap(@Req() req: any, @Query() query: any) {
    return this.ketidakhadiranService.getRekap(query, await this.getPageReader(req.user));
  }

  /* --- REKAM MEDIS SISWA (UKS) ---
     Isinya data kesehatan: riwayat penyakit, riwayat alergi obat, keluhan,
     tindakan — plus tanggal lahir dan alamat siswa. Digerbangi ke
     halaman `rekam-medis` dan PegawaiGuard agar hanya staf sekolah yang berhak. */
  @Get('rekam-medis-siswa')
  @UseGuards(PegawaiGuard)
  @RequiresPage('rekam-medis')
  async getRekamMedisSiswa(@Req() req: any, @Query() query: any) {
    return this.ketidakhadiranService.getRekamMedisSiswa(query, this.getApiUser(req.user));
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
      return this.ketidakhadiranService.syncKetidakhadiran(this.validId(body.id), body.mappedStatus, apiUser);
    }
    return this.ketidakhadiranService.createRekamMedisSiswa(body, apiUser);
  }

  @Put('rekam-medis-siswa/:id')
  @UseGuards(PegawaiGuard)
  @RequiresPage('rekam-medis')
  async updateRekamMedisSiswa(
    @Req() req: any,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: any,
  ) {
    const apiUser = this.getApiUser(req.user);
    return this.ketidakhadiranService.updateRekamMedisSiswa(this.validId(id), body, apiUser);
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
    return this.ketidakhadiranService.updateRekamMedisSiswa(this.validId(id), body, apiUser);
  }

  @Delete('rekam-medis-siswa/:id')
  @UseGuards(PegawaiGuard)
  @RequiresPage('rekam-medis')
  async deleteRekamMedisSiswa(@Req() req: any, @Param('id', new ParseUUIDPipe()) id: string) {
    const apiUser = this.getApiUser(req.user);
    return this.ketidakhadiranService.deleteRekamMedisSiswa(this.validId(id), apiUser);
  }

  @Delete('rekam-medis-siswa')
  @UseGuards(PegawaiGuard)
  @RequiresPage('rekam-medis')
  async deleteRekamMedisSiswaByQuery(@Req() req: any, @Query('id') id: string) {
    const apiUser = this.getApiUser(req.user);
    return this.ketidakhadiranService.deleteRekamMedisSiswa(this.validId(id), apiUser);
  }

  // --- ACCA LETTER ROUTES (harus sebelum wildcard :id) ---
  @Get('acca-letter/verify')
  async verifyAccaLetter(@Query('barcode') barcode: string) {
    return this.ketidakhadiranService.verifyAccaLetter(barcode);
  }

  @Get('acca-letter')
  @UseGuards(PegawaiGuard)
  @RequiresPage(...PAGE_DAFTAR_SURAT)
  async getAccaLetters(@Req() req: any, @Query() query: any) {
    return this.ketidakhadiranService.getAccaLetters(query, this.getApiUser(req.user));
  }

  @Post('acca-letter')
  @UseGuards(PegawaiGuard)
  @RequiresPage(...PAGE_KELOLA)
  async createAccaLetter(@Req() req: any, @Body() body: any) {
    const origin = req.headers.origin || 'https://acca.icgowa.sch.id';
    return this.ketidakhadiranService.createAccaLetter(body, origin, this.getApiUser(req.user));
  }

  @Delete('acca-letter/:id')
  @UseGuards(PegawaiGuard)
  @RequiresPage(...PAGE_KELOLA)
  async deleteAccaLetter(@Req() req: any, @Param('id', new ParseUUIDPipe()) id: string) {
    const apiUser = this.getApiUser(req.user);
    return this.ketidakhadiranService.deleteAccaLetter(id, apiUser);
  }

  @Post('save-letter')
  @UseGuards(PegawaiGuard)
  @RequiresPage(...PAGE_KELOLA)
  async saveAccaLetter(@Req() req: any, @Body() body: any) {
    return this.ketidakhadiranService.saveAccaLetter({ ...body, id: this.validId(body.id) }, this.getApiUser(req.user));
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
      page: query.page ? Number(query.page) : undefined,
      limit: query.limit ? Number(query.limit) : undefined,
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
  async getOne(@Req() req: any, @Param('id', new ParseUUIDPipe()) id: string) {
    const data = await this.ketidakhadiranService.findById(id, this.getApiUser(req.user));
    return { ok: true, data };
  }

  @Patch(':id')
  @UseGuards(PegawaiGuard)
  @RequiresPage(...PAGE_KELOLA)
  async update(@Req() req: any, @Param('id', new ParseUUIDPipe()) id: string, @Body() body: any) {
    const apiUser = this.getApiUser(req.user);
    return this.ketidakhadiranService.update(id, body, apiUser);
  }

  @Delete(':id')
  @UseGuards(PegawaiGuard)
  @RequiresPage(...PAGE_KELOLA)
  async remove(
    @Req() req: any,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Query('scope') scope?: string,
  ) {
    const apiUser = this.getApiUser(req.user);
    return this.ketidakhadiranService.remove(id, apiUser, scope);
  }
}


