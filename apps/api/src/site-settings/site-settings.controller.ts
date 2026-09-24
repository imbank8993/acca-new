import { Controller, Get, Put, Post, Delete, Body, Req, UseGuards, Query, ForbiddenException, BadRequestException, Param } from '@nestjs/common';
import { SiteSettingsService } from './site-settings.service';
import { MenuLayoutService } from './menu-layout.service';
import { PagesService } from './pages.service';
import { OptionalJwtAuthGuard } from '../auth/optional-jwt-auth.guard';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AccessService } from '../access/access.service';
import {
  aksesDiizinkan,
  parseKonfigurasiAkses,
  rolesUser,
  ROLE_ADMIN,
  PENGATURAN_DATA_ACCESS_KEYS,
} from '../auth/feature-access.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

/**
 * Kunci `system_config` yang boleh dibaca TANPA sesi lewat `GET /config`.
 *
 * Daftar putih, bukan daftar hitam: apa pun yang tidak disebut di sini tidak
 * terbaca publik. Semuanya keterangan tampilan yang memang dibutuhkan halaman
 * publik sebelum ada login.
 */
const KUNCI_CONFIG_PUBLIK = ['app_name', 'app_version', 'verify_base_url', 'qr_domain'];

@Controller()
export class SiteSettingsController {
  constructor(
    private readonly siteSettingsService: SiteSettingsService,
    private readonly menuLayoutService: MenuLayoutService,
    private readonly pagesService: PagesService,
    private readonly accessService: AccessService,
  ) {}

  /**
   * Apakah pemanggil benar-benar ber-role ADMIN / ADMINISTRATOR?
   *
   * Menggantikan `req.user.role?.toLowerCase().includes('admin')` yang tersebar di
   * selusin handler di berkas ini. Pemeriksaan itu mencocokkan SUBSTRING pada
   * string role mentah, sehingga role apa pun yang kebetulan memuat kata "admin" —
   * `ADMINISTRASI`, `OP_ADMIN`, `ADMIN_KELAS` — ikut lolos tanpa pernah diniatkan.
   *
   * Yang membuatnya berbahaya adalah apa yang dijaganya: `PUT /site-settings`
   * menulis baris yang SAMA dengan tempat seluruh konfigurasi "Hak Akses Fitur"
   * disimpan. Satu role bernama demikian karena itu cukup untuk memberi dirinya
   * sendiri wewenang penuh atas Master Data, Pengaturan Data, dan Pengaturan
   * Tugas — membatalkan seluruh model wewenang per tab.
   *
   * `rolesUser` memecah daftar role (`"GURU,ADMIN"`) dan mencocokkan tepat.
   */
  private assertAdmin(req: any) {
    if (!this.isAdmin(req)) {
      throw new ForbiddenException('Admin access required');
    }
  }

  private isAdmin(req: any): boolean {
    return rolesUser(req?.user).some((r) => ROLE_ADMIN.includes(r));
  }

  /**
   * Gerbang tab "Dropdown" di halaman Pengaturan Data.
   *
   * Menggantikan `req.user.role?.toLowerCase().includes('admin')` yang ditulis
   * inline di tiap handler. Selain tidak bisa diatur tanpa deploy, pemeriksaan itu
   * memakai pencocokan SUBSTRING pada string role — jadi role apa pun yang
   * kebetulan memuat kata "admin" ikut lolos.
   *
   * Sekarang: role ADMIN (melekat di kode), atau ditunjuk di Hak Akses Fitur.
   */
  private async assertDropdownAccess(req: any) {
    const [access, row] = await Promise.all([
      this.accessService.resolveUserAccess(req.user),
      this.siteSettingsService.getRawSetting(PENGATURAN_DATA_ACCESS_KEYS.dropdown),
    ]);
    if (!aksesDiizinkan({ ...req.user, roles: access.roles }, parseKonfigurasiAkses(row))) {
      throw new ForbiddenException(
        'Anda tidak berwenang mengubah data dropdown. Minta Admin menunjuk akun/role Anda di Hak Akses Fitur.',
      );
    }
  }

  @UseGuards(OptionalJwtAuthGuard)
  @Get('site-settings')
  async getSiteSettings(@Req() req: any, @Query('key') key?: string) {
    const isAdmin = this.isAdmin(req);
    const isInternal = !!process.env.INTERNAL_API_KEY && req.headers['x-internal-key'] === process.env.INTERNAL_API_KEY;
    const isPublic = !(isAdmin || isInternal);
    if (key) {
      const data = await this.siteSettingsService.getSetting(key, isPublic, !!req.user);
      return { ok: true, data };
    }
    const data = await this.siteSettingsService.getAllSettings(isPublic);
    return { ok: true, data };
  }

  @UseGuards(JwtAuthGuard)
  @Get('site-settings/api-logs')
  async getApiLogs(@Req() req: any) {
    this.assertAdmin(req);
    const data = await this.siteSettingsService.getApiLogs();
    return { ok: true, data };
  }

  @UseGuards(JwtAuthGuard)
  @Put('site-settings')
  async updateSiteSettings(@Req() req: any, @Body() body: any) {
    this.assertAdmin(req);
    if (!body.key) {
      throw new BadRequestException('key is required');
    }
    
    const data = await this.siteSettingsService.updateSetting(body.key, body);
    return { ok: true, data, message: 'Setting updated' };
  }

  /**
   * Memindai direktori `web/app` dan mengembalikan seluruh rute yang ditemukan.
   *
   * Sebelumnya tanpa guard sama sekali, jadi struktur halaman aplikasi — termasuk
   * rute-rute pengelola — terbaca tanpa login. Satu-satunya pemakainya adalah tab
   * "Mode Maintenance" di Pengaturan Users, yang memang hanya untuk Admin.
   */
  @UseGuards(JwtAuthGuard)
  @Get('pages')
  getPages(@Req() req: any) {
    this.assertAdmin(req);
    const data = this.pagesService.getPages();
    return { ok: true, data, count: data.length };
  }

  @UseGuards(OptionalJwtAuthGuard)
  @Get('menu-layout')
  async getMenuLayout(@Req() req: any) {
    const layout = await this.menuLayoutService.getMenuLayout();
    const roleFlat = await this.accessService.getRoleFlatGroupsMap();

    return {
      ok: true,
      layout: layout.groups,
      labels: layout.labels,
      roleFlat,
    };
  }

  @UseGuards(JwtAuthGuard)
  @Put('menu-layout')
  async updateMenuLayout(@Req() req: any, @Body() body: any) {
    this.assertAdmin(req);
    
    await this.menuLayoutService.setMenuLayout(body.layout, body.labels || {});
    return { ok: true };
  }

  // --- Profil Sekolah ---
  @Get('profil-sekolah')
  async getProfilSekolah(@Query('id') id?: string) {
    const data = await this.siteSettingsService.getProfilSekolah(id);
    return { ok: true, data };
  }

  @UseGuards(JwtAuthGuard)
  @Post('profil-sekolah')
  async createProfilSekolah(@Req() req: any, @Body() body: any) {
    this.assertAdmin(req);
    const data = await this.siteSettingsService.createProfilSekolah(body);
    return { ok: true, data };
  }

  @UseGuards(JwtAuthGuard)
  @Put('profil-sekolah')
  async updateProfilSekolah(@Req() req: any, @Body() body: any) {
    this.assertAdmin(req);
    const { id, ...updateData } = body;
    if (!id) throw new BadRequestException('ID is required');
    const data = await this.siteSettingsService.updateProfilSekolah(id, updateData);
    return { ok: true, data };
  }

  // --- Fitur Akademik ---
  @Get('fitur-akademik')
  async getFiturAkademik() {
    const data = await this.siteSettingsService.getFiturAkademik();
    return { ok: true, data };
  }

  @UseGuards(JwtAuthGuard)
  @Post('fitur-akademik')
  async createFiturAkademik(@Req() req: any, @Body() body: any) {
    this.assertAdmin(req);
    const data = await this.siteSettingsService.createFiturAkademik(body);
    return { ok: true, data };
  }

  @UseGuards(JwtAuthGuard)
  @Put('fitur-akademik')
  async updateFiturAkademik(@Req() req: any, @Body() body: any) {
    this.assertAdmin(req);
    const { id, ...updateData } = body;
    if (!id) throw new BadRequestException('ID is required');
    const data = await this.siteSettingsService.updateFiturAkademik(id, updateData);
    return { ok: true, data };
  }

  @UseGuards(JwtAuthGuard)
  @Delete('fitur-akademik')
  async deleteFiturAkademik(@Req() req: any, @Query('id') id: string) {
    this.assertAdmin(req);
    if (!id) throw new BadRequestException('ID is required');
    await this.siteSettingsService.deleteFiturAkademik(id);
    return { ok: true };
  }

  // --- Master Dropdown ---
  // Bergerbang sesi: sebelumnya route ini satu-satunya di grup master-dropdown
  // tanpa guard, dan route Next-nya juga tidak memeriksa token — jadi seluruh
  // tabel referensi (golongan, pangkat, jenis surat) terbaca tanpa login.
  @UseGuards(JwtAuthGuard)
  @Get('master-dropdown')
  async getMasterDropdown(@Query('columnKey') columnKey?: string, @Query('checkEmptySlot') checkEmptySlot?: string) {
    if (checkEmptySlot === 'true' && columnKey) {
      const data = await this.siteSettingsService.getMasterDropdownByColumnNull(columnKey);
      // matching the frontend expectation for `is(col.key, null)`
      return { ok: true, data: data ? [data] : [] }; 
    }
    const data = await this.siteSettingsService.getMasterDropdown();
    return { ok: true, data };
  }

  @UseGuards(JwtAuthGuard)
  @Post('master-dropdown')
  async createMasterDropdown(@Req() req: any, @Body() body: any) {
    await this.assertDropdownAccess(req);
    const data = await this.siteSettingsService.createMasterDropdown(body);
    return { ok: true, data };
  }

  @UseGuards(JwtAuthGuard)
  @Put('master-dropdown')
  async updateMasterDropdown(@Req() req: any, @Body() body: any) {
    await this.assertDropdownAccess(req);
    const { id, ...updateData } = body;
    if (!id) throw new BadRequestException('ID is required');
    const data = await this.siteSettingsService.updateMasterDropdown(id, updateData);
    return { ok: true, data };
  }

  @UseGuards(JwtAuthGuard)
  @Delete('master-dropdown')
  async deleteMasterDropdown(@Req() req: any, @Query('id') id: string) {
    await this.assertDropdownAccess(req);
    if (!id) throw new BadRequestException('ID is required');
    await this.siteSettingsService.deleteMasterDropdown(id);
    return { ok: true };
  }

  /**
   * Kolom `master_dropdown` adalah kolom tabel sungguhan, jadi menambah atau
   * menghapusnya berarti menjalankan DDL dari permintaan HTTP — sesuatu yang
   * sengaja tidak disediakan di sini.
   *
   * Dua route di bawah dulu hanya berpura-pura: POST memantulkan kembali
   * `columnKey` dengan `ok: true` dan DELETE mengembalikan `ok: true` tanpa
   * menyentuh apa pun, sementara UI menyimpan kolom barunya di localStorage dan
   * melaporkan "Berhasil". Kolomnya tidak pernah ada di database, dan setiap
   * nilai yang dicoba disimpan ke sana ditolak Prisma sebagai kolom tak dikenal.
   * Sekarang keduanya menyatakan penolakannya, supaya UI berhenti berbohong.
   */
  @UseGuards(JwtAuthGuard)
  @Post('master-dropdown/column')
  async addMasterDropdownColumn(@Body() body: { columnKey: string; label: string }) {
    throw new BadRequestException(
      'Menambah kolom dropdown baru harus lewat migrasi database, bukan dari halaman ini.',
    );
  }

  @UseGuards(JwtAuthGuard)
  @Delete('master-dropdown/column')
  async dropMasterDropdownColumn(@Body() body: { columnKey: string }) {
    throw new BadRequestException(
      'Menghapus kolom dropdown harus lewat migrasi database, bukan dari halaman ini.',
    );
  }


  @UseGuards(OptionalJwtAuthGuard)
  @Get('site-settings/file-storage-config')
  async getFileStorageConfig(@Req() req: any, @Query('all') all?: string) {
    const isAdmin = this.isAdmin(req);
    const isInternal = !!process.env.INTERNAL_API_KEY && req.headers['x-internal-key'] === process.env.INTERNAL_API_KEY;
    const isFullAccess = isInternal;

    const data = await this.siteSettingsService.getFileStorageConfig(isFullAccess, all === 'true');
    return { ok: true, data };
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Post('site-settings/file-storage-config/switch')
  @Roles('ADMIN', 'ADMINISTRATOR')
  async switchFileStorageConfig(@Body('id') id: string) {
    const data = await this.siteSettingsService.switchFileStorageConfig(id);
    return { ok: true, data };
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Put('site-settings/file-storage-config/:id')
  @Roles('ADMIN', 'ADMINISTRATOR')
  async updateFileStorageConfig(@Param('id') id: string, @Body() body: any) {
    const data = await this.siteSettingsService.updateFileStorageConfig(id, body);
    return { ok: true, data };
  }

  /**
   * Baca satu pengaturan sistem yang memang dimaksudkan untuk publik.
   *
   * Endpoint ini sengaja tanpa guard: halaman redirect kartu siswa
   * (`/redirect/[cardId]`) memanggilnya sebelum ada sesi, untuk `verify_base_url`
   * dan `app_name`.
   *
   * Yang dihilangkan adalah `?all=true`, yang dulu menumpahkan SELURUH tabel
   * `system_config` ke pemanggil anonim. Hari ini isinya kebetulan jinak — nama
   * aplikasi dan pengaturan tema — jadi ini bukan kebocoran rahasia, dan tidak ada
   * satu pun pemanggil di frontend yang memakainya. Masalahnya bentuknya:
   * `system_config` adalah penyimpanan kunci-nilai bebas, dan satu-satunya yang
   * menjaganya tetap tidak sensitif adalah kebetulan. Begitu ada yang menyimpan
   * token atau kunci API di sana, ia langsung terbit ke internet tanpa satu pun
   * perubahan kode yang tampak mencurigakan.
   *
   * Karena itu dibalik menjadi gagal-tertutup: hanya kunci yang disebut eksplisit
   * di `KUNCI_CONFIG_PUBLIK` yang boleh dibaca tanpa sesi. Kunci baru tidak ikut
   * publik kecuali seseorang sengaja menambahkannya ke daftar ini — dan saat
   * menambahkannya, ia sedang melihat komentar ini.
   */
  @Get('config')
  async getSystemConfig(@Query('key') key?: string) {
    if (!key || !KUNCI_CONFIG_PUBLIK.includes(key)) {
      throw new BadRequestException('Kunci pengaturan tidak tersedia untuk publik');
    }
    return this.siteSettingsService.getSystemConfig(key);
  }

  @Put('config')
  @UseGuards(JwtAuthGuard)
  async updateSystemConfig(@Req() req: any, @Body() body: { key: string; value: string }) {
    this.assertAdmin(req);
    return this.siteSettingsService.updateSystemConfig(body?.key, body?.value);
  }

  @Get('testimonials')
  async getTestimonials() {
    return this.siteSettingsService.getTestimonials();
  }

  @UseGuards(JwtAuthGuard)
  @Post('testimonials')
  async createTestimonial(@Body() body: { name?: string; quote?: string }) {
    return this.siteSettingsService.createTestimonial(body?.name, body?.quote);
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Get('storage-usage')
  @Roles('ADMIN', 'ADMINISTRATOR')
  async getStorageUsage() {
    return this.siteSettingsService.getStorageUsage();
  }

  @UseGuards(OptionalJwtAuthGuard)
  @Post('site-settings/file-registry/register')
  async registerUpload(@Req() req: any, @Body() body: any) {
    if (!process.env.INTERNAL_API_KEY || req.headers['x-internal-key'] !== process.env.INTERNAL_API_KEY) {
      throw new ForbiddenException('Internal or user access required');
    }
    await this.siteSettingsService.registerUpload(body);
    return { ok: true };
  }

  @UseGuards(JwtAuthGuard)
  @Get('site-settings/file-registry/can-delete')
  async canDeleteFile(@Req() req: any, @Query('url') url: string) {
    return { ok: true, allowed: await this.siteSettingsService.canDeleteFile(url, req.user) };
  }

  @UseGuards(OptionalJwtAuthGuard)
  @Post('site-settings/file-registry/unregister')
  async unregisterUpload(@Req() req: any, @Body() body: { fileUrl?: string }) {
    if (!process.env.INTERNAL_API_KEY || req.headers['x-internal-key'] !== process.env.INTERNAL_API_KEY) {
      throw new ForbiddenException('Internal or user access required');
    }
    await this.siteSettingsService.unregisterUpload(body.fileUrl);
    return { ok: true };
  }
}


