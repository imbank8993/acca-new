import { lockAccountWrites, countUsableAdmins } from '../auth/session-security';
import { BadRequestException, Injectable, Logger, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export type RolePagesMap = Record<string, string[]>;
export type RoleFlatGroupsMap = Record<string, string[]>;
export type RoleCapabilitiesMap = Record<string, string[]>;
export type ThemeMode = 'ALL' | 'LIGHT' | 'DARK';
export type RoleThemeMap = Record<string, ThemeMode>;

export interface PageOverrides {
  add: string[];
  remove: string[];
}

export interface UserAccess {
  roles: string[];
  pageIds: string[];
  flatGroupKeys: string[];
  /** `null` = tabel role_capabilities tak terbaca; pemanggil pakai paket bawaan registry. */
  caps: string[] | null;
  /** Explicit denials must also constrain compatibility readers of older settings. */
  revokedCaps?: string[];
  theme: { can_use_dark_mode: boolean; forced_theme: 'light' | 'dark' | null };
}

const TTL_MS = 30_000;
const ALWAYS_ALLOWED_THEME_ROLES = ['ADMIN', 'ADMINISTRATOR'];

/** Presedensi admin: user admin hanya memakai menu admin, bukan union semua role. */
function effectiveMenuRoles(roles: string[]): string[] {
  const upper = (roles || []).map((r) => r.toUpperCase());
  if (upper.includes('ADMIN') || upper.includes('ADMINISTRATOR')) {
    return upper.filter((r) => r === 'ADMIN' || r === 'ADMINISTRATOR');
  }
  return upper;
}

export function parseRoles(raw: string): string[] {
  if (!raw) return [];
  return [
    ...new Set(
      raw
        .split(/[,|]/)
        .map((r) => r.trim().toUpperCase().replace(/\s+/g, '_'))
        .filter(Boolean),
    ),
  ];
}

export function parseOverrides(raw: any): PageOverrides {
  try {
    const o = typeof raw === 'string' ? JSON.parse(raw) : raw;
    return {
      add: Array.isArray(o?.add) ? o.add.filter(Boolean) : [],
      remove: Array.isArray(o?.remove) ? o.remove.filter(Boolean) : [],
    };
  } catch {
    return { add: [], remove: [] };
  }
}

/**
 * Apakah user boleh menjalankan sebuah fungsi bernama?
 *
 * Sepadan dengan `can()` di apps/web/lib/capabilities.ts supaya gerbang UI dan
 * gerbang API tidak pernah berbeda pendapat. `user` di sini adalah `req.user`
 * hasil JwtStrategy, yang sudah membawa `caps` (union kapabilitas role +
 * grant per-user − revoke per-user).
 *
 * ADMIN selalu lolos, sama seperti di web: kalau tidak, satu tabel kapabilitas
 * yang belum di-seed bisa mengunci semua orang di luar.
 *
 * Bedanya dengan versi web: kalau `caps` belum terhitung (tabel tak terbaca),
 * jawabannya `false`, BUKAN jatuh ke `defaultRoles` registry. Registry itu
 * hidup di frontend, dan di sisi server menolak lebih aman daripada menebak.
 */
export function can(user: any, key: string): boolean {
  if (!user) return false;
  const roles = (user.roles || []).map((r: any) => String(r).toUpperCase());
  if (user.isAdmin || roles.includes('ADMIN') || roles.includes('ADMINISTRATOR')) return true;
  return Array.isArray(user.caps) && user.caps.includes(key);
}

@Injectable()
export class AccessService {
  private readonly logger = new Logger(AccessService.name);

  private rolePagesCache: { at: number; map: RolePagesMap } | null = null;
  private flatGroupsCache: { at: number; map: RoleFlatGroupsMap } | null = null;
  private roleCapsCache: { at: number; map: RoleCapabilitiesMap } | null = null;
  private themeCache: { at: number; map: RoleThemeMap } | null = null;
  private activeYearsCache: { at: number; list: string[] } | null = null;

  constructor(private prisma: PrismaService) {}

  private fresh<T>(entry: { at: number } | null): entry is { at: number } & T {
    return !!entry && Date.now() - entry.at < TTL_MS;
  }

  async getRolePagesMap(fresh = false): Promise<RolePagesMap> {
    if (!fresh && this.fresh(this.rolePagesCache)) return this.rolePagesCache!.map;
    try {
      const rows = await this.prisma.role_pages.findMany({
        select: { role: true, page_id: true },
      });
      const map: RolePagesMap = {};
      rows.forEach((row) => {
        const role = String(row.role || '').toUpperCase();
        if (!role || !row.page_id) return;
        (map[role] ||= []).push(row.page_id);
      });
      this.rolePagesCache = { at: Date.now(), map };
      return map;
    } catch (e) {
      this.logger.error(`getRolePagesMap: ${(e as Error).message}`);
      throw new ServiceUnavailableException('Akses halaman gagal dibaca. Silakan coba lagi.');
    }
  }

  async getRoleFlatGroupsMap(fresh = false): Promise<RoleFlatGroupsMap> {
    if (!fresh && this.fresh(this.flatGroupsCache)) return this.flatGroupsCache!.map;
    try {
      const rows = await this.prisma.role_group_flat.findMany({
        select: { role: true, group_key: true },
      });
      const map: RoleFlatGroupsMap = {};
      rows.forEach((row) => {
        const role = String(row.role || '').toUpperCase();
        if (!role || !row.group_key) return;
        (map[role] ||= []).push(row.group_key);
      });
      this.flatGroupsCache = { at: Date.now(), map };
      return map;
    } catch (e) {
      this.logger.error(`getRoleFlatGroupsMap: ${(e as Error).message}`);
      throw new ServiceUnavailableException('Tampilan grup akses gagal dibaca. Silakan coba lagi.');
    }
  }

  /** Empty is a valid policy; read failures must propagate instead of enabling fallback grants. */
  async getRoleCapabilitiesMap(fresh = false): Promise<RoleCapabilitiesMap | null> {
    if (!fresh && this.fresh(this.roleCapsCache)) return this.roleCapsCache!.map;
    try {
      const rows = await this.prisma.role_capabilities.findMany({
        select: { role: true, capability_key: true },
      });
      const map: RoleCapabilitiesMap = {};
      rows.forEach((row) => {
        const role = String(row.role || '').toUpperCase();
        if (!role || !row.capability_key) return;
        (map[role] ||= []).push(row.capability_key);
      });
      this.roleCapsCache = { at: Date.now(), map };
      return map;
    } catch (e) {
      this.logger.error(`getRoleCapabilitiesMap: ${(e as Error).message}`);
      throw new ServiceUnavailableException('Kapabilitas gagal dibaca. Silakan coba lagi.');
    }
  }

  async getUserCapabilityOverrides(
    userId: bigint | number | string,
  ): Promise<{ grants: string[]; revokes: string[] }> {
    if (!userId) return { grants: [], revokes: [] };
    try {
      const rows = await this.prisma.user_capabilities.findMany({
        where: { user_id: BigInt(userId) },
        select: { capability_key: true, mode: true },
      });
      const grants: string[] = [];
      const revokes: string[] = [];
      rows.forEach((row) => {
        if (!row.capability_key) return;
        if (row.mode === 'revoke') revokes.push(row.capability_key);
        else grants.push(row.capability_key);
      });
      return { grants, revokes };
    } catch (e) {
      this.logger.error(`getUserCapabilityOverrides: ${(e as Error).message}`);
      throw new ServiceUnavailableException('Pengecualian izin gagal dibaca. Silakan coba lagi.');
    }
  }

  /**
   * Kapabilitas efektif seorang user, versi ringan dari `resolveUserAccess`
   * (tanpa halaman & tema) untuk dipasang ke `req.user.caps` pada setiap
   * request. Peta role→kapabilitas sudah di-cache 30 detik, jadi biaya
   * tambahannya hanya satu query override per-user.
   *
   * `null` berarti tabel role_capabilities tak terbaca — `can()` menutup
   * gerbang, bukan membukanya.
   */
  async resolveCapabilities(
    userId: bigint | number | string,
    roles: string[],
  ): Promise<string[] | null> {
    const [roleCaps, overrides] = await Promise.all([
      this.getRoleCapabilitiesMap(true),
      this.getUserCapabilityOverrides(userId),
    ]);
    if (!roleCaps) return null;

    const set = new Set<string>();
    (roles || []).forEach((r) => (roleCaps[String(r).toUpperCase()] || []).forEach((c) => set.add(c)));
    overrides.grants.forEach((c) => set.add(c));
    // Revoke menang atas grant — lihat catatan di hitungKapabilitas (web).
    overrides.revokes.forEach((c) => set.delete(c));
    return [...set];
  }

  private async getActiveYears(): Promise<string[]> {
    if (this.fresh(this.activeYearsCache)) return this.activeYearsCache!.list;
    const rows = await this.prisma.master_tahun_ajaran.findMany({
      where: { is_active: true },
      select: { tahun_ajaran: true },
    });
    const list = [...new Set(rows.map((r) => r.tahun_ajaran).filter(Boolean))];
    this.activeYearsCache = { at: Date.now(), list };
    return list;
  }

  /**
   * Role fungsional dari penugasan aktif — WALI_KELAS / PEMBINA_EKSKUL dst tidak
   * diketik manual di users.role, melainkan mengikuti tugas_tambahan.granted_role
   * pada tahun ajaran aktif, plus PENGURUS_KELAS dari siswa_kelas.is_pengurus.
   */
  async getDutyRoles(nip: string): Promise<string[]> {
    if (!nip) return [];
    try {
      const years = await this.getActiveYears();
      const yearFilter = years.length > 0 ? { tahun_ajaran: { in: years } } : {};

      const [tugas, pengurus] = await Promise.all([
        this.prisma.tugas_tambahan.findMany({
          where: { nip, NOT: { granted_role: null }, ...yearFilter },
          select: { granted_role: true },
        }),
        this.prisma.siswa_kelas.findMany({
          where: { nisn: nip, is_pengurus: true, aktif: true, ...yearFilter },
          select: { id: true },
          take: 1,
        }),
      ]);

      const roles = new Set<string>();
      tugas.forEach((r) => {
        const role = String(r.granted_role || '').toUpperCase();
        if (role) roles.add(role);
      });
      if (pengurus.length > 0) roles.add('PENGURUS_KELAS');

      return [...roles];
    } catch (e) {
      this.logger.error(`getDutyRoles: ${(e as Error).message}`);
      return [];
    }
  }

  async getRoleThemeMap(fresh = false): Promise<RoleThemeMap> {
    if (!fresh && this.fresh(this.themeCache)) return this.themeCache!.map;
    const map: RoleThemeMap = {};
    try {
      const rows = await this.prisma.system_config.findMany({
        where: { key: { in: ['role_theme_modes', 'dark_mode_roles'] } },
        select: { key: true, value: true },
      });

      const modeRow = rows.find((r) => r.key === 'role_theme_modes');
      const legacyRow = rows.find((r) => r.key === 'dark_mode_roles');

      if (modeRow?.value) {
        const parsed = JSON.parse(modeRow.value);
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
          Object.keys(parsed).forEach((role) => {
            const val = String(parsed[role]).toUpperCase();
            if (val === 'ALL' || val === 'LIGHT' || val === 'DARK') {
              map[role.trim().toUpperCase()] = val as ThemeMode;
            }
          });
        }
      } else if (legacyRow?.value) {
        // Format lama: hanya daftar role yang boleh dark mode.
        const raw = JSON.parse(legacyRow.value);
        if (Array.isArray(raw)) {
          raw.forEach((r: unknown) => {
            const role = String(r || '').trim().toUpperCase();
            if (role) map[role] = 'ALL';
          });
        }
      }
    } catch (e) {
      this.logger.error(`getRoleThemeMap: ${(e as Error).message}`);
      throw new ServiceUnavailableException('Preferensi tema gagal dibaca. Silakan coba lagi.');
    }

    ALWAYS_ALLOWED_THEME_ROLES.forEach((adm) => (map[adm] = 'ALL'));
    this.themeCache = { at: Date.now(), map };
    return map;
  }

  async getUserThemeSetting(roles: string[]): Promise<UserAccess['theme']> {
    const upper = (roles || []).map((r) => r.toUpperCase());
    if (upper.some((r) => ALWAYS_ALLOWED_THEME_ROLES.includes(r))) {
      return { can_use_dark_mode: true, forced_theme: null };
    }

    const map = await this.getRoleThemeMap();
    if (upper.some((r) => map[r] === 'ALL')) {
      return { can_use_dark_mode: true, forced_theme: null };
    }
    if (upper.some((r) => map[r] === 'DARK')) {
      return { can_use_dark_mode: false, forced_theme: 'dark' };
    }
    return { can_use_dark_mode: false, forced_theme: 'light' };
  }

  /**
   * Otorisasi lengkap seorang user: role efektif, halaman, capabilities, tema.
   *
   * `caps` sengaja TIDAK disaring terhadap registry capability — registry-nya
   * hidup di frontend, jadi penyaringan kunci usang dilakukan di sana.
   */
  async resolveUserAccess(user: {
    id: bigint;
    role: string | null;
    nip: string | null;
    username: string | null;
    page_overrides: any;
  }): Promise<UserAccess> {
    const identityRoles = parseRoles(user.role || '');
    const isAdmin = identityRoles.includes('ADMIN');

    const nip = user.nip || user.username || '';
    const dutyRoles = isAdmin ? [] : await this.getDutyRoles(nip);
    const roles = [...new Set([...identityRoles, ...dutyRoles])];

    const [rolePages, flatGroups, roleCaps, overrides] = await Promise.all([
      this.getRolePagesMap(true),
      this.getRoleFlatGroupsMap(),
      this.getRoleCapabilitiesMap(true),
      this.getUserCapabilityOverrides(user.id),
    ]);

    const menuRoles = effectiveMenuRoles(roles);

    const pages = new Set<string>();
    menuRoles.forEach((r) => (rolePages[r] || []).forEach((p) => pages.add(p)));

    const pageOverrides = parseOverrides(user.page_overrides);
    pageOverrides.add.forEach((p) => pages.add(p));
    pageOverrides.remove.forEach((p) => pages.delete(p));
    // Catatan pribadi tersedia untuk setiap akun yang sudah terautentikasi.
    pages.add('catatan-saya');

    // Jaring pengaman untuk role khusus yang barisnya belum di-seed.
    if (roles.includes('OP_AGENDA')) pages.add('agenda-madrasah');
    if (roles.includes('OP_FORM')) pages.add('form');
    const upperRoles = roles.map((r) => r.toUpperCase());
    if (upperRoles.includes('ADMIN') || upperRoles.includes('ADMINISTRATOR')) {
      pages.add('audit-log');
      pages.add('e-sertifikat');
      pages.add('monitoring');
      pages.add('notulensi-rapat');
    }

    const flatGroupKeys = new Set<string>();
    menuRoles.forEach((r) => (flatGroups[r] || []).forEach((k) => flatGroupKeys.add(k)));

    let caps: string[] | null = null;
    if (roleCaps) {
      const set = new Set<string>();
      roles.forEach((r) => (roleCaps[r.toUpperCase()] || []).forEach((c) => set.add(c)));
      overrides.grants.forEach((c) => set.add(c));
      overrides.revokes.forEach((c) => set.delete(c));
      caps = [...set];
    }

    return {
      roles,
      pageIds: [...pages],
      flatGroupKeys: [...flatGroupKeys],
      caps,
      revokedCaps: overrides.revokes,
      theme: await this.getUserThemeSetting(roles),
    };
  }

  /**
   * Versi massal `resolveUserAccess` untuk daftar user (mis. halaman
   * Pengaturan Users). Duty role diambil sekali untuk semua NIP sekaligus —
   * kalau dipanggil satu per satu, 300+ user berarti 300+ query berulang.
   */
  async resolveManyUserAccess(users: any[]): Promise<Map<string, UserAccess>> {
    const hasil = new Map<string, UserAccess>();
    if (users.length === 0) return hasil;

    const nips = [
      ...new Set(
        users
          .filter((u) => !parseRoles(u.role || '').includes('ADMIN'))
          .map((u) => u.nip || u.username || '')
          .filter(Boolean),
      ),
    ];

    const years = await this.getActiveYears();
    const yearFilter = years.length > 0 ? { tahun_ajaran: { in: years } } : {};

    const [rolePages, flatGroups, roleCaps, themeMap, tugas, pengurus, capOverrides] =
      await Promise.all([
        this.getRolePagesMap(),
        this.getRoleFlatGroupsMap(),
        this.getRoleCapabilitiesMap(),
        this.getRoleThemeMap(),
        nips.length
          ? this.prisma.tugas_tambahan.findMany({
              where: { nip: { in: nips }, NOT: { granted_role: null }, ...yearFilter },
              select: { nip: true, granted_role: true },
            })
          : ([] as Array<{ nip: string | null; granted_role: string | null }>),
        nips.length
          ? this.prisma.siswa_kelas.findMany({
              where: { nisn: { in: nips }, is_pengurus: true, aktif: true, ...yearFilter },
              select: { nisn: true },
            })
          : ([] as Array<{ nisn: string | null }>),
        this.prisma.user_capabilities.findMany({
          where: { user_id: { in: users.map((u) => BigInt(u.id)) } },
          select: { user_id: true, capability_key: true, mode: true },
        }),
      ]);

    const dutyByNip = new Map<string, Set<string>>();
    tugas.forEach((t) => {
      if (!t.nip) return;
      const role = String(t.granted_role || '').toUpperCase();
      if (!role) return;
      if (!dutyByNip.has(t.nip)) dutyByNip.set(t.nip, new Set());
      dutyByNip.get(t.nip)?.add(role);
    });
    pengurus.forEach((p) => {
      if (!p.nisn) return;
      if (!dutyByNip.has(p.nisn)) dutyByNip.set(p.nisn, new Set());
      dutyByNip.get(p.nisn)?.add('PENGURUS_KELAS');
    });

    const capsByUser = new Map<string, { grants: string[]; revokes: string[] }>();
    capOverrides.forEach((row) => {
      const key = row.user_id.toString();
      if (!capsByUser.has(key)) capsByUser.set(key, { grants: [], revokes: [] });
      const entry = capsByUser.get(key)!;
      if (row.mode === 'revoke') entry.revokes.push(row.capability_key);
      else entry.grants.push(row.capability_key);
    });

    for (const user of users) {
      const identityRoles = parseRoles(user.role || '');
      const isAdmin = identityRoles.includes('ADMIN');
      const nip = user.nip || user.username || '';
      const duty = isAdmin ? [] : [...(dutyByNip.get(nip) || [])];
      const roles = [...new Set([...identityRoles, ...duty])];
      const menuRoles = effectiveMenuRoles(roles);

      const pages = new Set<string>();
      menuRoles.forEach((r) => (rolePages[r] || []).forEach((p) => pages.add(p)));

      const overrides = parseOverrides(user.page_overrides);
      overrides.add.forEach((p) => pages.add(p));
      overrides.remove.forEach((p) => pages.delete(p));
      pages.add('catatan-saya');
      if (roles.includes('OP_AGENDA')) pages.add('agenda-madrasah');
      if (roles.includes('OP_FORM')) pages.add('form');
      const upperUserRoles = roles.map((r) => r.toUpperCase());
      if (upperUserRoles.includes('ADMIN') || upperUserRoles.includes('ADMINISTRATOR')) {
        pages.add('audit-log');
        pages.add('monitoring');
        pages.add('notulensi-rapat');
      }

      const flatGroupKeys = new Set<string>();
      menuRoles.forEach((r) => (flatGroups[r] || []).forEach((k) => flatGroupKeys.add(k)));

      let caps: string[] | null = null;
      if (roleCaps) {
        const set = new Set<string>();
        roles.forEach((r) => (roleCaps[r] || []).forEach((c) => set.add(c)));
        const own = capsByUser.get(user.id.toString());
        own?.grants.forEach((c) => set.add(c));
        own?.revokes.forEach((c) => set.delete(c));
        caps = [...set];
      }

      const upper = roles.map((r) => r.toUpperCase());
      const theme = upper.some((r) => ALWAYS_ALLOWED_THEME_ROLES.includes(r) || themeMap[r] === 'ALL')
        ? { can_use_dark_mode: true, forced_theme: null as ('light' | 'dark' | null) }
        : upper.some((r) => themeMap[r] === 'DARK')
          ? { can_use_dark_mode: false, forced_theme: 'dark' as const }
          : { can_use_dark_mode: false, forced_theme: 'light' as const };

      hasil.set(user.id.toString(), {
        roles,
        pageIds: [...pages],
        flatGroupKeys: [...flatGroupKeys],
        caps,
        revokedCaps: capsByUser.get(user.id.toString())?.revokes || [],
        theme,
      });
    }

    return hasil;
  }

  // ── Jalur tulis (UI admin "Akses per Role") ────────────────────────────

  private stringList(value: unknown, field: string): string[] {
    if (!Array.isArray(value) || value.length > 1000 || value.some(v => typeof v !== 'string' || !v.trim() || v.length > 255)) {
      throw new BadRequestException(`${field} harus berupa daftar teks yang valid`);
    }
    return [...new Set(value.map(v => v.trim()))];
  }

  private capabilityUserIds(value: unknown): bigint[] {
    if (!Array.isArray(value) || value.length > 10000) throw new BadRequestException('Daftar pengguna tidak valid');
    return [...new Set(value.map(id => {
      if ((typeof id === 'number' && !Number.isSafeInteger(id)) || !/^[1-9]\d{0,18}$/.test(String(id))) {
        throw new BadRequestException('ID pengguna tidak valid');
      }
      const uid = BigInt(id);
      if (uid > 9223372036854775807n) throw new BadRequestException('ID pengguna tidak valid');
      return uid.toString();
    }))].map(id => BigInt(id));
  }

  /** One role's pages, grouping and optional theme commit together. */
  async saveRoleAccess(role: string, pageIds: unknown, flatGroups?: unknown, themeMode?: ThemeMode): Promise<void> {
    if (typeof role !== 'string' || !role.trim()) throw new BadRequestException('Role wajib diisi');
    const R = role.trim().toUpperCase();
    const pages = this.stringList(pageIds, 'pageIds');
    const groups = flatGroups === undefined ? undefined : this.stringList(flatGroups, 'flatGroups');
    if (themeMode !== undefined && !['ALL', 'LIGHT', 'DARK'].includes(themeMode)) throw new BadRequestException('Mode tema tidak valid');
    await this.prisma.$transaction(async tx => {
      await tx.$queryRawUnsafe('SELECT pg_advisory_xact_lock(hashtext($1))::text', `access:role:${R}`);
      const exists = await tx.roles.findFirst({ where: { name: R }, select: { id: true } });
      if (!exists) throw new BadRequestException('Role tidak ditemukan');
      await tx.role_pages.deleteMany({ where: { role: R } });
      if (pages.length) await tx.role_pages.createMany({ data: pages.map((page_id, sort_order) => ({ role: R, page_id, sort_order })) });
      if (groups) {
        await tx.role_group_flat.deleteMany({ where: { role: R } });
        if (groups.length) await tx.role_group_flat.createMany({ data: groups.map(group_key => ({ role: R, group_key })) });
      }
      if (themeMode !== undefined) {
        await tx.$queryRawUnsafe('SELECT pg_advisory_xact_lock(hashtext($1))::text', 'access:theme');
        const rows = await tx.system_config.findMany({ where: { key: { in: ['role_theme_modes', 'dark_mode_roles'] } } });
        const current = rows.find(r => r.key === 'role_theme_modes');
        const map: RoleThemeMap = current?.value ? JSON.parse(current.value) : {};
        if (!current) {
          const legacy = rows.find(r => r.key === 'dark_mode_roles');
          if (legacy?.value) for (const r of JSON.parse(legacy.value)) map[String(r).toUpperCase()] = 'ALL';
        }
        if (!map || typeof map !== 'object' || Array.isArray(map)) throw new BadRequestException('Konfigurasi tema tidak valid');
        map[R] = ALWAYS_ALLOWED_THEME_ROLES.includes(R) ? 'ALL' : themeMode;
        ALWAYS_ALLOWED_THEME_ROLES.forEach(r => map[r] = 'ALL');
        await this.writeThemeMap(tx, map);
      }
    });
    this.rolePagesCache = null;
    this.flatGroupsCache = null;
    this.themeCache = null;
  }

  /** Replace all holders for one capability, including explicit exceptions and its legacy mirror. */
  async setCapabilityConfiguration(key: string, body: { roles: unknown; userIds: unknown; revokedUserIds: unknown }): Promise<void> {
    const known = ['absensi.admin', 'klinik.kelola_sesi', 'klinik.approve_slot', 'klinik.approve_laporan', 'klinik.rekap', 'bank_data.kelola', 'bank_data.export_sensitif'];
    if (!known.includes(key)) throw new BadRequestException('Kapabilitas tidak dikenal');
    const roles = this.stringList(body.roles, 'roles').map(r => r.toUpperCase()).filter(r => !ALWAYS_ALLOWED_THEME_ROLES.includes(r));
    const grants = this.capabilityUserIds(body.userIds);
    const revokes = this.capabilityUserIds(body.revokedUserIds);
    if (grants.some(id => revokes.includes(id))) throw new BadRequestException('Pengguna tidak boleh sekaligus diberikan dan dikecualikan');
    await this.prisma.$transaction(async tx => {
      await tx.$queryRawUnsafe('SELECT pg_advisory_xact_lock(hashtext($1))::text', `access:capability:${key}`);
      const foundRoles = await tx.roles.findMany({ where: { name: { in: roles } }, select: { name: true } });
      if (roles.some(r => !foundRoles.some(found => found.name === r))) throw new BadRequestException('Ada role yang tidak ditemukan');
      const users = await tx.public_users.findMany({ where: { id: { in: [...grants, ...revokes] } }, select: { id: true, nama: true, nip: true } });
      if (users.length !== grants.length + revokes.length) throw new BadRequestException('Ada pengguna yang tidak ditemukan. Muat ulang daftar pengguna.');
      await tx.role_capabilities.deleteMany({ where: { capability_key: key } });
      if (roles.length) await tx.role_capabilities.createMany({ data: [...new Set(roles)].map(role => ({ role, capability_key: key })) });
      await tx.user_capabilities.deleteMany({ where: { capability_key: key } });
      const entries = [...grants.map(user_id => ({ user_id, capability_key: key, mode: 'grant' })), ...revokes.map(user_id => ({ user_id, capability_key: key, mode: 'revoke' }))];
      if (entries.length) await tx.user_capabilities.createMany({ data: entries });
      const value = JSON.stringify({ capabilityManaged: true, allowedRoles: [...ALWAYS_ALLOWED_THEME_ROLES, ...roles], allowedUsers: users.filter(u => grants.includes(u.id)).map(u => ({ id: u.id.toString(), nama: u.nama || `User #${u.id}`, nip: u.nip || '' })) });
      await tx.site_settings.upsert({ where: { key }, create: { key, value, label: `Hak Akses ${key}`, is_active: true }, update: { value } });
    });
    this.roleCapsCache = null;
  }

  async setRolePages(role: string, pageIds: string[]): Promise<void> {
    const R = role.toUpperCase();
    await this.prisma.$transaction([
      this.prisma.role_pages.deleteMany({ where: { role: R } }),
      this.prisma.role_pages.createMany({
        data: [...new Set(pageIds.filter(Boolean))].map((page_id, i) => ({
          role: R,
          page_id,
          sort_order: i,
        })),
        skipDuplicates: true,
      }),
    ]);
    this.rolePagesCache = null;
  }

  async setRoleFlatGroups(role: string, groupKeys: string[]): Promise<void> {
    const R = role.toUpperCase();
    await this.prisma.$transaction([
      this.prisma.role_group_flat.deleteMany({ where: { role: R } }),
      this.prisma.role_group_flat.createMany({
        data: [...new Set(groupKeys.filter(Boolean))].map((group_key) => ({
          role: R,
          group_key,
        })),
        skipDuplicates: true,
      }),
    ]);
    this.flatGroupsCache = null;
  }

  async setRoleCapabilities(role: string, capabilityKeys: string[]): Promise<void> {
    const R = role.toUpperCase();
    await this.prisma.$transaction([
      this.prisma.role_capabilities.deleteMany({ where: { role: R } }),
      this.prisma.role_capabilities.createMany({
        data: [...new Set(capabilityKeys.filter(Boolean))].map((capability_key) => ({
          role: R,
          capability_key,
        })),
        skipDuplicates: true,
      }),
    ]);
    this.roleCapsCache = null;
  }

  /** Ganti seluruh pengecualian milik SATU user. */
  async setUserCapabilities(
    userId: bigint | number | string,
    entries: Array<{ capability_key: string; mode: 'grant' | 'revoke'; catatan?: string }>,
  ): Promise<void> {
    const uid = BigInt(userId);
    await this.prisma.$transaction([
      this.prisma.user_capabilities.deleteMany({ where: { user_id: uid } }),
      this.prisma.user_capabilities.createMany({
        data: entries
          .filter((e) => e.capability_key)
          .map((e) => ({
            user_id: uid,
            capability_key: e.capability_key,
            mode: e.mode === 'revoke' ? 'revoke' : 'grant',
            catatan: e.catatan || null,
          })),
        skipDuplicates: true,
      }),
    ]);
  }

  /**
   * Ganti daftar orang untuk SATU kapabilitas — sengaja tidak lewat
   * setUserCapabilities, karena fungsi itu menghapus seluruh pengecualian milik
   * user pada kapabilitas lain.
   */
  async setCapabilityHolders(
    capabilityKey: string,
    userIds: Array<number | string>,
    mode: 'grant' | 'revoke' = 'grant',
  ): Promise<void> {
    const ids = this.capabilityUserIds(userIds);
    if (!['grant', 'revoke'].includes(mode)) throw new BadRequestException('Mode kapabilitas tidak valid');
    await this.prisma.$transaction(async tx => {
      await tx.$queryRawUnsafe('SELECT pg_advisory_xact_lock(hashtext($1))::text', `access:capability:${capabilityKey}`);
      await tx.user_capabilities.deleteMany({ where: { capability_key: capabilityKey, mode } });
      for (const id of ids) {
        await tx.user_capabilities.upsert({
          where: { user_id_capability_key: { user_id: id, capability_key: capabilityKey } },
          create: { user_id: id, capability_key: capabilityKey, mode },
          update: { mode },
        });
      }
    });
  }

  async getCapabilityHolders(capabilityKey: string) {
    const kosong = { roles: [] as string[], grants: [] as any[], revokes: [] as any[] };
    if (!capabilityKey) return kosong;

    try {
      const [roleRows, userRows] = await Promise.all([
        this.prisma.role_capabilities.findMany({
          where: { capability_key: capabilityKey },
          select: { role: true },
        }),
        this.prisma.user_capabilities.findMany({
          where: { capability_key: capabilityKey },
          select: {
            user_id: true,
            mode: true,
            users: { select: { nama: true, username: true, role: true } },
          },
        }),
      ]);

      const hasil = {
        roles: roleRows.map((r) => String(r.role || '').toUpperCase()).filter(Boolean),
        grants: [] as any[],
        revokes: [] as any[],
      };

      userRows.forEach((row) => {
        const entri = {
          user_id: row.user_id.toString(),
          nama: row.users?.nama || row.users?.username || `#${row.user_id}`,
          role: row.users?.role || '',
        };
        (row.mode === 'revoke' ? hasil.revokes : hasil.grants).push(entri);
      });

      return hasil;
    } catch (e) {
      this.logger.error(`getCapabilityHolders: ${(e as Error).message}`);
      throw new ServiceUnavailableException('Daftar pemegang izin gagal dibaca. Silakan coba lagi.');
    }
  }

  async setRoleThemeMap(map: RoleThemeMap, updatedBy?: string): Promise<RoleThemeMap> {
    const normalized: RoleThemeMap = {};
    Object.keys(map).forEach((r) => {
      const role = r.trim().toUpperCase();
      if (!role) return;
      const mode = String(map[r] || 'LIGHT').toUpperCase();
      normalized[role] = (mode === 'ALL' || mode === 'DARK' ? mode : 'LIGHT') as ThemeMode;
    });
    ALWAYS_ALLOWED_THEME_ROLES.forEach((adm) => (normalized[adm] = 'ALL'));

    await this.prisma.$transaction(async tx => {
      await tx.$queryRawUnsafe('SELECT pg_advisory_xact_lock(hashtext($1))::text', 'access:theme');
      await this.writeThemeMap(tx, normalized, updatedBy);
    });
    this.themeCache = null;
    return normalized;
  }

  private async writeThemeMap(tx: any, normalized: RoleThemeMap, updatedBy?: string): Promise<void> {
    await tx.system_config.upsert({
      where: { key: 'role_theme_modes' },
      create: {
        key: 'role_theme_modes',
        value: JSON.stringify(normalized),
        description: 'Konfigurasi mode tampilan per role (ALL, LIGHT, DARK)',
        ...(updatedBy ? { updated_by: updatedBy } : {}),
      },
      update: {
        value: JSON.stringify(normalized),
        ...(updatedBy ? { updated_by: updatedBy } : {}),
      },
    });

    // Sinkronkan format lama supaya pembaca yang belum pindah tetap konsisten.
    const allowedRoles = Object.keys(normalized).filter((r) => normalized[r] === 'ALL');
    await tx.system_config.upsert({
      where: { key: 'dark_mode_roles' },
      create: {
        key: 'dark_mode_roles',
        value: JSON.stringify(allowedRoles),
        description:
          'Daftar role yang diizinkan menggunakan tombol mode gelap & terang di header',
        ...(updatedBy ? { updated_by: updatedBy } : {}),
      },
      update: {
        value: JSON.stringify(allowedRoles),
        ...(updatedBy ? { updated_by: updatedBy } : {}),
      },
    });

  }

  // ── Roles CRUD ──────────────────────────────────────────────────────────

  async getRoles() {
    return this.prisma.roles.findMany({
      orderBy: { name: 'asc' },
    });
  }

  async createRole(name: string, description?: string) {
    const normalizedName = name.toUpperCase().replace(/\s+/g, '_');

    const existing = await this.prisma.roles.findUnique({
      where: { name: normalizedName },
    });

    if (existing) {
      throw new Error(`Role "${normalizedName}" sudah ada. Gunakan nama lain.`);
    }

    return this.prisma.roles.create({
      data: { name: normalizedName, description: description || '' },
    });
  }

  /**
   * Role yang tidak boleh dihapus karena perilaku aplikasi bergantung padanya.
   *
   * Daftar sebelumnya hanya `['ADMIN','GURU','WALI_KELAS']` — `ADMINISTRATOR`
   * (setara ADMIN di seluruh pemeriksaan wewenang), `SISWA`, `ORANG_TUA`, dan
   * `PEMBINA_EKSKUL` (diberikan otomatis dari tugas tambahan) tidak terlindungi.
   */
  private static readonly ROLE_SISTEM = [
    'ADMIN',
    'ADMINISTRATOR',
    'GURU',
    'SISWA',
    'ORANG_TUA',
    'WALI_KELAS',
    'PEMBINA_EKSKUL',
  ];

  /**
   * Hapus sebuah role dari daftar.
   *
   * Dua hal yang dulu tidak dijaga. Pertama, role yang masih dipegang akun tetap
   * bisa dihapus: akunnya lalu memegang role yang tidak ada di daftar mana pun —
   * tidak bisa dilihat, tidak bisa dicabut dari layar, tapi tetap menentukan akses.
   * Kedua, baris `role_pages` / `role_group_flat` / `role_capabilities` miliknya
   * ditinggalkan yatim, sehingga membuat ulang role bernama sama diam-diam
   * memulihkan hak akses lama.
   */
  async deleteRole(id: number) {
    const roleToDelete = await this.prisma.roles.findUnique({ where: { id } });
    if (!roleToDelete) throw new NotFoundException('Role tidak ditemukan');

    const nama = roleToDelete.name.toUpperCase();
    if (AccessService.ROLE_SISTEM.includes(nama)) {
      throw new BadRequestException('Tidak dapat menghapus role bawaan sistem');
    }

    const kandidat = await this.prisma.public_users.findMany({
      where: { role: { contains: nama, mode: 'insensitive' } },
      select: { role: true },
    });
    // `contains` hanya mempersempit; kecocokan ditentukan per elemen supaya
    // `OP_KELAS` tidak terhitung sebagai pemegang `KELAS`.
    const pemakai = kandidat.filter((u) => parseRoles(u.role || '').includes(nama)).length;
    if (pemakai > 0) {
      throw new BadRequestException(
        `Role "${nama}" masih dipegang ${pemakai} akun. Pindahkan akun-akun itu ke role lain ` +
          `lebih dulu, supaya tidak ada akun yang memegang role di luar daftar.`,
      );
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.role_pages.deleteMany({ where: { role: nama } });
      await tx.role_group_flat.deleteMany({ where: { role: nama } });
      await tx.role_capabilities.deleteMany({ where: { role: nama } });
      await tx.roles.delete({ where: { id } });
    });
  }

  /**
   * Ganti nama sebuah role — beserta SEMUA tempat namanya dipakai.
   *
   * Nama role bukan kunci asing di mana pun: ia disalin sebagai teks ke
   * `public_users.role` (bisa gabungan, `"GURU,ADMIN"`), `role_pages.role`,
   * `role_group_flat.role`, dan `role_capabilities.role`. Sebelumnya fungsi ini
   * hanya memperbarui baris `roles`, sehingga mengganti nama `KURIKULUM` menjadi
   * `WAKAKUR` membuat setiap pemegangnya kehilangan seluruh pemetaan halamannya
   * sekaligus memegang role yang tidak ada lagi di daftar — akses putus tanpa
   * jejak, dan tidak terlihat dari layar mana pun.
   *
   * Semuanya dijalankan dalam satu transaksi: nama role berubah utuh, atau tidak
   * berubah sama sekali.
   */
  async updateRole(id: number, name: string, description?: string) {
    const normalizedName = name.toUpperCase().replace(/\s+/g, '_');

    const sebelum = await this.prisma.roles.findUnique({ where: { id } });
    if (!sebelum) throw new NotFoundException('Role tidak ditemukan');

    const existing = await this.prisma.roles.findFirst({
      where: {
        name: normalizedName,
        id: { not: id }
      }
    });

    if (existing) {
      throw new BadRequestException(`Role "${normalizedName}" sudah ada. Gunakan nama lain.`);
    }

    const namaLama = sebelum.name;
    if (namaLama === normalizedName) {
      return this.prisma.roles.update({
        where: { id },
        data: { description: description || '' }
      });
    }

    return this.prisma.$transaction(async (tx) => {
      const diperbarui = await tx.roles.update({
        where: { id },
        data: { name: normalizedName, description: description || '' }
      });

      await tx.role_pages.updateMany({ where: { role: namaLama }, data: { role: normalizedName } });
      await tx.role_group_flat.updateMany({ where: { role: namaLama }, data: { role: normalizedName } });
      await tx.role_capabilities.updateMany({ where: { role: namaLama }, data: { role: normalizedName } });

      // `public_users.role` menyimpan DAFTAR ("GURU,ADMIN"), jadi tidak bisa
      // di-updateMany: tiap baris harus dipecah, elemennya diganti, lalu disusun
      // ulang — kalau tidak, `KURIKULUM` pada "GURU,KURIKULUM" akan luput.
      const pemegang = await tx.public_users.findMany({
        where: { role: { contains: namaLama, mode: 'insensitive' } },
        select: { id: true, role: true },
      });
      for (const u of pemegang) {
        const daftar = parseRoles(u.role || '');
        if (!daftar.includes(namaLama)) continue;
        const baru = [...new Set(daftar.map((r) => (r === namaLama ? normalizedName : r)))];
        await tx.public_users.update({ where: { id: u.id }, data: { role: baru.join(',') } });
      }

      this.logger.log(
        `Role "${namaLama}" diganti nama menjadi "${normalizedName}" (${pemegang.length} akun diperiksa)`,
      );
      return diperbarui;
    });
  }

  // ── User Roles ──────────────────────────────────────────────────────────

  async getUserRoles(userId: string | number) {
    const user = await this.prisma.public_users.findUnique({ where: { id: BigInt(userId) } });
    if (!user) {
      throw new Error('User not found');
    }
    return {
      id: user.id.toString(),
      role: user.role,
    };
  }

  /**
   * Jalur KEDUA untuk mengubah role, selain `PUT /users/:id`. Keduanya perlu
   * pengaman yang sama: begitu tidak ada Admin aktif yang tersisa, tidak ada lagi
   * yang bisa masuk untuk memperbaikinya — seluruh pengelolaan user, role, dan Hak
   * Akses Fitur hanya terbuka untuk Admin.
   */
  private punyaRoleAdmin(role?: string | null): boolean {
    return parseRoles(role || '').some((r) => r === 'ADMIN' || r === 'ADMINISTRATOR');
  }

  async updateUserRoles(userId: string | number, role: string, action?: string) {
    return this.prisma.$transaction(async tx => {
      await lockAccountWrites(tx);

      const idTeks = String(userId ?? '').trim();
      if (!/^\d+$/.test(idTeks)) {
        throw new BadRequestException('ID pengguna tidak valid');
      }
      if (typeof role !== 'string' || !role.trim()) throw new BadRequestException('Role wajib diisi');
      if (action !== undefined && !['add', 'remove', 'replace'].includes(action)) throw new BadRequestException('Aksi role tidak valid');
      const requested = parseRoles(role);
      if (!requested.length || ((action === 'add' || action === 'remove') && requested.length !== 1)) throw new BadRequestException('Role tidak valid');
      const catalog = await tx.roles.findMany({ select: { name: true } });
      const valid = new Set(catalog.map(item => item.name.trim().toUpperCase()));
      if (requested.some(item => !valid.has(item))) throw new BadRequestException('Role tidak terdaftar');
      const existingUser = await tx.public_users.findUnique({ where: { id: BigInt(idTeks) } });
      if (!existingUser) {
        throw new NotFoundException('User not found');
      }

      const currentRoles = parseRoles(existingUser.role || '');
      let finalRoles = [...currentRoles];
      const targetRole = requested[0];

      if (action === 'add') {
        if (!finalRoles.includes(targetRole)) {
          finalRoles.push(targetRole);
        }
      } else if (action === 'remove') {
        finalRoles = finalRoles.filter((r) => r !== targetRole);
      } else {
        finalRoles = parseRoles(role);
      }

      if (!finalRoles.length) throw new BadRequestException('Pengguna harus memiliki setidaknya satu role');
      const finalRoleString = finalRoles.join(',');

      const kehilanganAdmin =
        this.punyaRoleAdmin(existingUser.role) &&
        existingUser.aktif === true &&
        !this.punyaRoleAdmin(finalRoleString);
      if (kehilanganAdmin) {
        if (await countUsableAdmins(tx) <= 1) {
          throw new BadRequestException(
            'Ini satu-satunya akun Admin yang aktif. Tunjuk Admin lain lebih dulu sebelum ' +
              'mencabut role ADMIN dari akun ini.',
          );
        }
      }

      const updated = await tx.public_users.update({
        where: { id: BigInt(idTeks) },
        data: { role: finalRoleString },
      });

      return updated;

    }, { maxWait: 10000, timeout: 20000 });
  }
}
