import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  BadRequestException,
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
import { UsersService, type CreateUserInput, type UpdateUserInput } from './users.service';

@ApiTags('User Management')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('users')
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly accessService: AccessService,
  ) {}

  /**
   * Gerbang pengelolaan user: role ADMIN / ADMINISTRATOR saja.
   *
   * Sebelumnya `isAdmin || access.pageIds.includes('pengaturan-users')`, yaitu
   * tabel `role_pages` — yang mengatur NAVIGASI, bukan wewenang. Pola yang sama
   * sudah dicabut dari Master Data, Pengaturan Data, dan Pengaturan Tugas, tetapi
   * di sini taruhannya paling tinggi: `PUT /users/:id` menerima `role` di antara
   * kolom yang boleh ditulis, jadi memberikan menu "Pengaturan Users" kepada
   * sebuah role di tab "Akses per Role" sama dengan memberi role itu kuasa untuk
   * menjadikan dirinya sendiri ADMIN. Dan tab "Akses per Role" ada di halaman yang
   * sama, tampak seperti pengaturan menu belaka.
   *
   * Halaman ini SENGAJA tidak diberi mekanisme "Hak Akses Fitur" per tab seperti
   * ketiga halaman itu. Alasannya: layar inilah yang mengatur Hak Akses Fitur,
   * role, dan akun. Siapa pun yang dititipi salah satu tabnya otomatis setara
   * admin — jadi "mendelegasikan" di sini bukan mempersempit wewenang, hanya
   * memindahkannya tanpa terlihat.
   */
  private async assertCanManageUsers(req: any) {
    const access = await this.accessService.resolveUserAccess(req.user);
    if (!access.roles.some((r) => r === 'ADMIN' || r === 'ADMINISTRATOR')) {
      throw new ForbiddenException('Hanya Admin yang dapat mengelola pengguna');
    }
  }

  /** Role pemanggil, dipakai pemeriksaan anti-eskalasi di service. */
  private async rolesPemanggil(req: any): Promise<string[]> {
    return (await this.accessService.resolveUserAccess(req.user)).roles;
  }

  @Get()
  @ApiOperation({ summary: 'Daftar pengguna beserta akses efektifnya' })
  async list(
    @Request() req: any,
    @Query('aktif') aktif?: string,
    @Query('role') role?: string,
    @Query('search') search?: string,
  ) {
    await this.assertCanManageUsers(req);

    const users = await this.usersService.list({ aktif, role, search });
    const accessMap = await this.accessService.resolveManyUserAccess(users);

    return {
      ok: true,
      data: users.map((u) => ({
        user: { ...u, id: u.id.toString() },
        access: accessMap.get(u.id.toString()) ?? null,
      })),
      count: users.length,
    };
  }

  @Post()
  @ApiOperation({ summary: 'Buat pengguna baru beserta kredensialnya di VPS' })
  async create(@Request() req: any, @Body() body: CreateUserInput) {
    await this.assertCanManageUsers(req);
    return { ok: true, data: await this.usersService.create(body) };
  }

  @Post('bulk')
  @ApiOperation({ summary: 'Impor massal pengguna (upsert berdasarkan username)' })
  async bulk(@Request() req: any, @Body() body: { users?: CreateUserInput[] }) {
    await this.assertCanManageUsers(req);
    return { ok: true, hasil: await this.usersService.bulkUpsert(body.users || []) };
  }

  @Put('me')
  @ApiOperation({ summary: 'Perbarui profil sendiri (termasuk ganti password)' })
  async updateMe(
    @Request() req: any,
    @Body() body: UpdateUserInput & { oldPassword?: string },
  ) {
    const { password, oldPassword, role, aktif, nip, ...profil } = body;

    const data = await this.usersService.update(req.user.id, profil);

    if (password) {
      await this.usersService.changeOwnPassword(req.user, password, oldPassword);
    }

    return { ok: true, data };
  }

  @Get('pinned-pages')
  async getPinnedPages(@Request() req: any) {
    return this.usersService.getPinnedPages(req.user);
  }

  @Put('pinned-pages')
  async updatePinnedPages(@Request() req: any, @Body() body: { pinned: string[] }) {
    return this.usersService.updatePinnedPages(req.user, body?.pinned || []);
  }

  @Get('profile-guru')
  async getProfileGuru(@Request() req: any) {
    const nip = req.user.nip || '';
    return this.usersService.getProfileGuru(nip);
  }

  @Get('profile-siswa')
  async getProfileSiswa(@Request() req: any) {
    return this.usersService.getProfileSiswa(req.user);
  }

  /**
   * Menyimpan tab "Data Diri" di halaman Profil.
   *
   * Barisnya ditentukan dari NIP/NISN pada token, bukan dari body — jadi tidak
   * ada jalan menyunting data orang lain. Kolom yang hanya boleh diubah admin
   * (Nama Lengkap & NIP untuk pegawai; Nama Lengkap, NISN, Nama Ayah & Nama Ibu
   * untuk siswa) tidak ada di daftar-izin pada UsersService, jadi ikut terbuang
   * walau dikirimkan.
   */
  @Put('profile-guru')
  @ApiOperation({ summary: 'Simpan data diri pegawai sendiri ke master_guru' })
  async updateProfileGuru(@Request() req: any, @Body() body: any) {
    return this.usersService.updateProfileGuru(req.user, body);
  }

  @Put('profile-siswa')
  @ApiOperation({ summary: 'Simpan data diri siswa sendiri ke master_siswa' })
  async updateProfileSiswa(@Request() req: any, @Body() body: any) {
    return this.usersService.updateProfileSiswa(req.user, body);
  }

  @Post('heartbeat')
  async heartbeat(@Request() req: any, @Body() body: { location?: string }) {
    return this.usersService.heartbeat(req.user, body?.location);
  }

  @Post('bulk-replace')
  @ApiOperation({ summary: 'Bulk replace data across database' })
  async bulkReplace(@Request() req: any, @Body() body: any) {
    await this.assertCanManageUsers(req);
    const result = await this.usersService.bulkReplace(body);
    return { ok: true, ...result };
  }

  @Post('link-auth')
  @ApiOperation({ summary: 'Link current auth session to a user in users table' })
  async linkAuth(@Request() req: any, @Body() body: { username?: string; nip?: string }) {
    const data = await this.usersService.linkAuth(req.user, body);
    return { ok: true, ...data };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Satu pengguna beserta akses efektifnya' })
  async findOne(@Request() req: any, @Param('id') id: string) {
    await this.assertCanManageUsers(req);

    const user = await this.usersService.findById(id);
    return {
      ok: true,
      data: {
        user: { ...user, id: user.id.toString() },
        access: await this.accessService.resolveUserAccess(user),
      },
    };
  }

  @Put(':id')
  @ApiOperation({ summary: 'Perbarui pengguna (admin)' })
  async update(@Request() req: any, @Param('id') id: string, @Body() body: UpdateUserInput) {
    await this.assertCanManageUsers(req);
    return { ok: true, data: await this.usersService.update(id, body) };
  }

  @Put(':id/status')
  @ApiOperation({ summary: 'Ubah status aktif pengguna' })
  async updateStatus(
    @Request() req: any,
    @Param('id') id: string,
    @Body() body: { aktif: boolean },
  ) {
    await this.assertCanManageUsers(req);

    if (typeof body.aktif !== 'boolean') {
      throw new BadRequestException('aktif must be a boolean');
    }

    const data = await this.usersService.updateStatus(id, body.aktif, req.user);

    return {
      ok: true,
      data,
      message: `User ${body.aktif ? 'activated' : 'deactivated'} successfully`,
    };
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Hapus pengguna beserta kredensialnya' })
  async remove(@Request() req: any, @Param('id') id: string) {
    await this.assertCanManageUsers(req);
    const removed = await this.usersService.remove(id, req.user.auth_id || null);
    return { ok: true, message: `User "${removed.username}" berhasil dihapus`, ...removed };
  }
}
