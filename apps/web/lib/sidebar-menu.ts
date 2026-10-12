/**
 * SIDEBAR MENU TAXONOMY
 * Built-in grouping for the sidebar. Pages are organized into a handful of
 * functional groups. This taxonomy only decides ORDER & GROUPING — WHICH pages
 * a user sees is decided purely by role access (role_pages → pagesArray). A page
 * never shows unless the user actually has access to it. There is no per-mode
 * (Guru/Admin) filtering: a user with multiple roles simply sees the union of
 * their roles' pages (e.g. ADMIN+GURU → admin superset; GURU+OP → both combined).
 */

export interface MenuGroupDef {
  key: string
  label: string
  icon: string // FontAwesome solid name, e.g. 'fa-house'
  pages: string[] // ordered page ids
}

export interface BuiltGroup {
  key: string
  label: string
  icon: string
  children: { id: string; label: string }[]
  flat?: boolean // render children as top-level items (no group header)
}

// Pages never shown as their own sidebar item (diakses lewat halaman induk /
// tombol, bukan menu). Tetap terdaftar di grup agar bisa di-grant di "Akses per
// Role", tapi tidak dirender sebagai item menu maupun masuk grup "Lainnya".
// - 'cbt-app'         → dibuka via tombol CBT khusus di sidebar
// - 'pengumuman'      → dikelola di tab Kelola Pengumuman di halaman Informasi (/informasi/kelola)
const EXCLUDED_PAGES = new Set(['cbt-app', 'tools-app', 'jurnal-banding', 'pengumuman', 'surat-daftar'])

export const MENU_GROUPS: MenuGroupDef[] = [
  {
    key: 'beranda',
    label: 'Beranda',
    icon: 'fa-house',
    pages: ['dashboard', 'jadwal', 'informasi', 'agenda-madrasah', 'notulensi-rapat', 'dokumen'],
  },
  {
    key: 'akademik',
    label: 'Akademik / KBM',
    icon: 'fa-graduation-cap',
    pages: [
      'jurnal', 'jurnal-banding',
      'absensi', 'nilai',
      'piket', 'jadwal',
      'agenda-madrasah', 'notulensi-rapat', 'izin-guru', 'lckh', 'sanggar-kurikulum'
    ],
  },
  {
    key: 'kesiswaan',
    label: 'Kesiswaan',
    icon: 'fa-users',
    pages: [
      'ketidakhadiran', 'rekam-medis',
      'guru-asuh', 'wali-kelas', 'ekstrakurikuler',
      'klinik', 'prestasi', 'bimbingan-konseling',
    ],
  },
  {
    key: 'layanan',
    label: 'Layanan & Surat',
    icon: 'fa-envelope',
    pages: ['permintaan-surat', 'surat', 'layanan-ptsp'],
  },
  {
    key: 'portal-siswa',
    label: 'Portal Siswa',
    icon: 'fa-id-card',
    pages: ['nilai-siswa', 'ketidakhadiran', 'tugas-siswa', 'kokurikuler', 'ekstrakurikuler'],
  },
  {
    key: 'laporan',
    label: 'Laporan & Monitoring',
    icon: 'fa-chart-line',
    pages: [
      'kinerja-guru', 'monitoring',
      'e-supervisi', 'observasi-kelas', 'lckh-approval', 'pembayaran', 'um-kelulusan', 'catatan-keuangan', 'keuangan'
    ],
  },
  {
    key: 'administrasi',
    label: 'Administrasi Data',
    icon: 'fa-database',
    pages: ['master', 'form', 'pengaturan-data', 'bank-data', 'tugas-tambahan'],
  },
  {
    key: 'pengaturan',
    label: 'Pengaturan Sistem',
    icon: 'fa-gear',
    pages: ['pengaturan-umum', 'pengaturan-tugas', 'pengaturan-users', 'audit-log'],
  },
  {
    key: 'external-apps',
    label: 'Aplikasi Eksternal',
    icon: 'fa-arrow-up-right-from-square',
    pages: ['cbt-app', 'tools-app'],
  },
]

/**
 * Display labels for every page id used in the taxonomy. Shared by the role
 * access UI and the server-side effective-pages resolver so labels stay
 * consistent regardless of where pages are rendered.
 */
export const PAGE_LABELS: Record<string, string> = {
  'dashboard': 'Dashboard',
  'informasi': 'Informasi',
  'pengumuman': 'Pengumuman',
  'dokumen': 'Pusat Dokumen',
  'jurnal': 'Jurnal Guru',
  'jurnal-banding': 'Banding Jurnal',
  'absensi': 'Absensi Siswa',
  'nilai': 'Nilai',
  'piket': 'Laporan Piket',
  'jadwal': 'Jadwal',
  'agenda-madrasah': 'Agenda Madrasah',
  'notulensi-rapat': 'Notulensi Rapat',
  'izin-guru': 'Izin Guru',
  'lckh': 'LCKH',
  'lckh-approval': 'LCKH Approval',
  'pembayaran': 'Pembayaran',
  'ketidakhadiran': 'Ketidakhadiran',
  'rekam-medis': 'Rekam Medis Siswa',
  'guru-asuh': 'Guru Asuh',
  'wali-kelas': 'Wali Kelas',
  'ekstrakurikuler': 'Ekstrakurikuler',
  'klinik': 'Klinik Pembelajaran',
  'prestasi': 'Prestasi Lomba',
  'bimbingan-konseling': 'Bimbingan Konseling',
  'permintaan-surat': 'Permintaan Surat',
  'surat': 'Generate Surat',
  'surat-daftar': 'Daftar Surat',
  'layanan-ptsp': 'Layanan PTSP',
  'kokurikuler': 'Kokurikuler',
  'nilai-siswa': 'Nilai Siswa',
  'tugas-siswa': 'Tugas Siswa',
  'kinerja-guru': 'Kinerja Guru',
  'monitoring': 'Monitoring',
  'e-supervisi': 'E-Supervisi',
  'um-kelulusan': 'UM & Kelulusan',
  'catatan-keuangan': 'Catatan Keuangan',
  'keuangan': 'Keuangan Madrasah',
  'master': 'Master Data',
  'form': 'Formulir Dinamis',
  'pengaturan-data': 'Pengaturan Data',
  'bank-data': 'Bank Data',
  'tugas-tambahan': 'Tugas Tambahan',
  'pengaturan-umum': 'Pengaturan Umum',
  'pengaturan-tugas': 'Pengaturan Tugas',
  'pengaturan-users': 'Pengaturan Users',
  'audit-log': 'Log Audit Sistem',
  'cbt-app': 'Aplikasi CBT',
  'tools-app': 'ACCA Tools',
  'sanggar-kurikulum': 'Registrasi Sanggar',
  'observasi-kelas': 'Observasi Kelas',
}

function humanize(id: string): string {
  return id
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase())
}

/**
 * Nama tampilan sebuah halaman, dengan urutan prioritas yang SAMA dengan
 * `labelOf` di Sidebar. Dipakai bersama supaya judul di header mobile tidak
 * pernah berbeda dari label yang sama di sidebar — termasuk saat admin
 * mengganti nama menu lewat "Susun Menu".
 */
export function resolvePageLabel(
  id: string,
  opts: {
    /** Label kustom dari menu_layout (prioritas tertinggi). */
    menuLabels?: Record<string, string>
    /** Judul dari pagesTree milik user. */
    treeTitles?: Record<string, string>
  } = {}
): string {
  return opts.menuLabels?.[id] || opts.treeTitles?.[id] || PAGE_LABELS[id] || humanize(id)
}

/**
 * Resolve which roles drive a user's menu.
 *
 * - Multi-role (non-admin) → all roles combined (union of their pages).
 * - Has ADMIN among them   → show ONLY the admin menu. ADMIN is a superset, so
 *   the other roles would just add noise / duplicate items.
 *
 * Returns UPPERCASE role names (matching the keys in role_pages maps).
 */
export function effectiveMenuRoles(roles: string[]): string[] {
  const upper = (roles || []).map(r => r.toUpperCase())
  if (upper.includes('ADMIN') || upper.includes('ADMINISTRATOR')) {
    return upper.filter(r => r === 'ADMIN' || r === 'ADMINISTRATOR')
  }
  return upper
}

/**
 * Build the ordered, access-filtered list of sidebar groups.
 *
 * @param accessibleIds  set of page ids the user may access
 * @param labelOf        resolver for a page's display label (respects custom labels)
 * @param flatGroupKeys  group keys to render flat (children as top-level items, no header)
 */
export function buildSidebarGroups(
  groupsDef: MenuGroupDef[],
  accessibleIds: Set<string>,
  labelOf: (id: string) => string,
  flatGroupKeys: Set<string> = new Set()
): BuiltGroup[] {
  const groups: BuiltGroup[] = []

  for (const def of groupsDef) {
    const children = def.pages
      .filter(id => accessibleIds.has(id) && !EXCLUDED_PAGES.has(id))
      .map(id => ({ id, label: labelOf(id) }))
    if (children.length > 0) {
      groups.push({ key: def.key, label: def.label, icon: def.icon, children, flat: flatGroupKeys.has(def.key) })
    }
  }

  return groups
}

export { humanize }
