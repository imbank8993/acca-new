import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Headers,
  NotFoundException,
  Param,
  Put,
  Post,
  Delete,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PrismaService } from '../prisma/prisma.service';
import { AccessService, parseRoles, RoleThemeMap } from './access.service';

function serializeUser(u: any) {
  return {
    id: u.id.toString(),
    auth_id: u.auth_id,
    username: u.username,
    email: u.email,
    nip: u.nip,
    nama: u.nama,
    nama_lengkap: u.nama_lengkap,
    role: u.role,
    divisi: u.divisi,
    aktif: u.aktif,
    foto_profil: u.foto_profil,
    page_overrides: u.page_overrides,
    must_change_password: u.must_change_password === true,
  };
}

function assertAdmin(req: any) {
  const roles = parseRoles(req.user?.role || '');
  if (!roles.includes('ADMIN') && !roles.includes('ADMINISTRATOR')) {
    throw new ForbiddenException('Hanya ADMIN yang boleh mengubah pengaturan akses');
  }
}

/**
 * Dipakai server Next.js untuk me-resolve akses user MANA PUN (fungsi
 * `getUserByAuthId()` di frontend tidak menerima token pemanggil). Dijaga
 * shared secret antar-service, BUKAN JWT user — karena itu controller ini
 * sengaja dipisah dari AccessController yang ber-JwtAuthGuard.
 */
@ApiTags('Access Control')
@Controller('access/internal')
export class AccessInternalController {
  constructor(
    private readonly accessService: AccessService,
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  private assertInternalKey(key?: string) {
    const expected = this.config.get<string>('INTERNAL_API_KEY');
    if (!expected || key !== expected) {
      throw new ForbiddenException('Internal key tidak valid');
    }
  }

  @Get('user/:authId')
  @ApiOperation({ summary: 'Identitas + akses berdasarkan auth_id (service-to-service)' })
  async userByAuthId(
    @Headers('x-internal-key') internalKey: string,
    @Param('authId') authId: string,
  ) {
    this.assertInternalKey(internalKey);

    const user = await this.prisma.public_users.findFirst({ where: { auth_id: authId } });
    if (!user) throw new NotFoundException('User tidak ditemukan');

    return { user: serializeUser(user), access: await this.accessService.resolveUserAccess(user) };
  }

  @Get('username/:username')
  @ApiOperation({ summary: 'Identitas + akses berdasarkan username (service-to-service)' })
  async userByUsername(
    @Headers('x-internal-key') internalKey: string,
    @Param('username') username: string,
  ) {
    this.assertInternalKey(internalKey);

    const user = await this.prisma.public_users.findFirst({
      where: { username: { equals: username, mode: 'insensitive' } },
    });
    if (!user) throw new NotFoundException('User tidak ditemukan');

    return { user: serializeUser(user), access: await this.accessService.resolveUserAccess(user) };
  }
}

@ApiTags('Access Control')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('access')
export class AccessController {
  constructor(private readonly accessService: AccessService) {}

  @Get('me')
  @ApiOperation({ summary: 'Identitas + role, halaman, capabilities, dan tema user yang login' })
  async me(@Request() req: any) {
    return {
      user: serializeUser(req.user),
      access: req.user.must_change_password ? {
        roles: [], pageIds: ['update-password'], flatGroupKeys: [], caps: [],
        theme: { can_use_dark_mode: false, forced_theme: 'light' },
      } : await this.accessService.resolveUserAccess(req.user),
    };
  }

  @Get('role-pages')
  @ApiOperation({ summary: 'Peta role → page_id (untuk UI Akses per Role)' })
  async rolePages() {
    const [pages, flatGroups] = await Promise.all([
      this.accessService.getRolePagesMap(true),
      this.accessService.getRoleFlatGroupsMap(true),
    ]);
    return { pages, flatGroups };
  }

  @Put('role-pages/:role')
  @ApiOperation({ summary: 'Ganti seluruh halaman sebuah role' })
  async setRolePages(
    @Request() req: any,
    @Param('role') role: string,
    @Body() body: { pageIds?: string[] },
  ) {
    assertAdmin(req);
    await this.accessService.setRolePages(role, body.pageIds || []);
    return { ok: true };
  }

  @Put('role-flat-groups/:role')
  @ApiOperation({ summary: 'Ganti group yang dirender flat untuk sebuah role' })
  async setRoleFlatGroups(
    @Request() req: any,
    @Param('role') role: string,
    @Body() body: { groupKeys?: string[] },
  ) {
    assertAdmin(req);
    await this.accessService.setRoleFlatGroups(role, body.groupKeys || []);
    return { ok: true };
  }

  @Get('role-capabilities')
  @ApiOperation({ summary: 'Peta role → capability_key' })
  async roleCapabilities() {
    return { map: await this.accessService.getRoleCapabilitiesMap() };
  }

  @Put('role-capabilities/:role')
  @ApiOperation({ summary: 'Ganti seluruh kapabilitas sebuah role' })
  async setRoleCapabilities(
    @Request() req: any,
    @Param('role') role: string,
    @Body() body: { capabilityKeys?: string[] },
  ) {
    assertAdmin(req);
    await this.accessService.setRoleCapabilities(role, body.capabilityKeys || []);
    return { ok: true };
  }

  @Get('user-capabilities/:userId')
  @ApiOperation({ summary: 'Grant/revoke kapabilitas milik satu user' })
  async userCapabilities(@Param('userId') userId: string) {
    return this.accessService.getUserCapabilityOverrides(userId);
  }

  @Put('user-capabilities/:userId')
  @ApiOperation({ summary: 'Ganti seluruh pengecualian kapabilitas milik satu user' })
  async setUserCapabilities(
    @Request() req: any,
    @Param('userId') userId: string,
    @Body()
    body: {
      entries?: Array<{ capability_key: string; mode: 'grant' | 'revoke'; catatan?: string }>;
    },
  ) {
    assertAdmin(req);
    await this.accessService.setUserCapabilities(userId, body.entries || []);
    return { ok: true };
  }

  @Get('capability-holders')
  @ApiOperation({ summary: 'Siapa saja pemegang satu kapabilitas' })
  async capabilityHolders(@Query('key') key: string) {
    return this.accessService.getCapabilityHolders(key);
  }

  @Put('capability-holders/:key')
  @ApiOperation({ summary: 'Ganti daftar orang untuk satu kapabilitas' })
  async setCapabilityHolders(
    @Request() req: any,
    @Param('key') key: string,
    @Body() body: { userIds?: Array<number | string>; mode?: 'grant' | 'revoke'; roles?: string[]; revokedUserIds?: Array<number | string> },
  ) {
    assertAdmin(req);
    if (body.roles !== undefined) {
      await this.accessService.setCapabilityConfiguration(key, { roles: body.roles, userIds: body.userIds, revokedUserIds: body.revokedUserIds ?? [] });
    } else {
      await this.accessService.setCapabilityHolders(key, body.userIds || [], body.mode || 'grant');
    }
    return { ok: true };
  }

  @Get('theme-roles')
  @ApiOperation({ summary: 'Peta role → mode tema (ALL/LIGHT/DARK)' })
  async themeRoles() {
    return { map: await this.accessService.getRoleThemeMap(true) };
  }

  @Put('theme-roles')
  @ApiOperation({ summary: 'Simpan peta mode tema per role' })
  async setThemeRoles(@Request() req: any, @Body() body: { map?: RoleThemeMap }) {
    assertAdmin(req);
    const saved = await this.accessService.setRoleThemeMap(
      body.map || {},
      req.user?.username || undefined,
    );
    return { ok: true, map: saved };
  }

  // ── Roles CRUD ──────────────────────────────────────────────────────────

  @Get('roles')
  @ApiOperation({ summary: 'Daftar semua role' })
  async getRoles(@Request() req: any) {
    assertAdmin(req);
    const roles = await this.accessService.getRoles();
    return { ok: true, data: roles };
  }

  @Post('roles')
  @ApiOperation({ summary: 'Buat role baru' })
  async createRole(@Request() req: any, @Body() body: { name: string; description?: string }) {
    assertAdmin(req);
    if (!body.name) {
      return { ok: false, error: 'Role name is required' };
    }
    try {
      const data = await this.accessService.createRole(body.name, body.description);
      return { ok: true, data };
    } catch (e: any) {
      return { ok: false, error: e.message };
    }
  }

  @Get('roles/:id')
  @ApiOperation({ summary: 'Get role details (placeholder)' })
  async getRoleById(@Request() req: any, @Param('id') id: string) {
    assertAdmin(req);
    return { ok: true };
  }

  @Put('roles/:id')
  @ApiOperation({ summary: 'Update sebuah role' })
  async updateRole(@Request() req: any, @Param('id') id: string, @Body() body: { name: string; description?: string }) {
    assertAdmin(req);
    const numericId = parseInt(id, 10);
    if (isNaN(numericId)) {
      return { ok: false, error: 'Role ID must be numeric' };
    }
    if (!body.name) {
      return { ok: false, error: 'Role name is required' };
    }
    try {
      const data = await this.accessService.updateRole(numericId, body.name, body.description);
      return { ok: true, data };
    } catch (e: any) {
      return { ok: false, error: e.message };
    }
  }

  @Delete('roles/:id')
  @ApiOperation({ summary: 'Hapus sebuah role' })
  async deleteRole(@Request() req: any, @Param('id') id: string) {
    assertAdmin(req);
    const numericId = parseInt(id, 10);
    if (isNaN(numericId)) {
      return { ok: false, error: 'Role ID must be numeric' };
    }
    try {
      await this.accessService.deleteRole(numericId);
      return { ok: true };
    } catch (e: any) {
      return { ok: false, message: e.message }; // Match original error structure
    }
  }

  // ── User Roles ──────────────────────────────────────────────────────────

  @Get('users/:id/roles')
  @ApiOperation({ summary: 'Lihat role milik seorang user' })
  async getUserRoles(@Request() req: any, @Param('id') id: string) {
    assertAdmin(req);
    try {
      const data = await this.accessService.getUserRoles(id);
      return { ok: true, data };
    } catch (e: any) {
      return { ok: false, error: e.message };
    }
  }

  @Post('users/:id/roles')
  @ApiOperation({ summary: 'Ubah role milik seorang user' })
  async updateUserRoles(
    @Request() req: any,
    @Param('id') id: string,
    @Body() body: { role: string; action?: string },
  ) {
    assertAdmin(req);
    if (typeof body.role !== 'string') {
      return { ok: false, error: 'role must be a string' };
    }
    try {
      const updatedUser = await this.accessService.updateUserRoles(id, body.role, body.action);
      return { ok: true, data: serializeUser(updatedUser), message: 'User roles updated successfully' };
    } catch (e: any) {
      return { ok: false, error: e.message };
    }
  }

  @Post('role-pages')
  @ApiOperation({ summary: 'Simpan halaman dan flat groups untuk sebuah role' })
  async saveRolePages(
    @Request() req: any,
    @Body() body: { role: string; pageIds?: string[]; flatGroups?: string[]; themeMode?: 'ALL' | 'LIGHT' | 'DARK' },
  ) {
    assertAdmin(req);
    if (!body.role || !Array.isArray(body.pageIds)) {
      return { ok: false, error: 'role dan pageIds wajib diisi' };
    }
    try {
      await this.accessService.saveRoleAccess(body.role, body.pageIds, body.flatGroups, body.themeMode);
      return { ok: true };
    } catch (e: any) {
      return { ok: false, error: e.message };
    }
  }
}

