/**
 * PAGE ROLE REQUIREMENTS — SATU-SATUNYA sumber kebenaran.
 *
 * Dulu tabel ini punya dua salinan (lib/page-requirements.ts dan
 * lib/permissions-client.ts) yang isinya sudah menyimpang satu sama lain.
 * Sekarang permissions-client.ts hanya me-re-export dari sini.
 *
 * Peran file ini setelah adanya kapabilitas (lib/capabilities.ts): gerbang
 * KASAR "role ini boleh buka halaman ini?" + level view/edit/manage. Izin
 * per-FUNGSI yang halus dipegang kapabilitas, bukan file ini.
 *
 * Penulisan kunci: cukup satu bentuk (mis. `master:siswa`). Varian `.`/`-`/`_`
 * dibuat otomatis oleh indeks di bawah, jadi JANGAN menulis entri kembar lagi.
 *
 * Actions: 'view' < 'edit' < 'manage' (hirarki)
 */

export interface PageRequirement {
    allowedRoles: string[];
    defaultAction?: string;
    roleActions?: Record<string, string>;
    description?: string;
}

export const PAGE_ROLE_REQUIREMENTS: Record<string, PageRequirement> = {
    // === DASHBOARD & INFO ===
    'dashboard': { allowedRoles: ['ADMIN', 'GURU', 'WALI_KELAS', 'SISWA'], defaultAction: 'view', description: 'Dashboard utama' },
    'informasi': { allowedRoles: ['ADMIN', 'GURU', 'WALI_KELAS', 'SISWA'], defaultAction: 'view', description: 'Informasi' },
    'jadwal': { allowedRoles: ['ADMIN', 'GURU', 'WALI_KELAS', 'SISWA'], defaultAction: 'view', description: 'Jadwal' },
    'pengumuman': { allowedRoles: ['ADMIN', 'GURU', 'WALI_KELAS', 'SISWA'], defaultAction: 'view', description: 'Pengumuman' },

    // === AKADEMIK ===
    'jurnal': { allowedRoles: ['ADMIN', 'GURU'], defaultAction: 'edit', roleActions: { 'ADMIN': 'manage' }, description: 'Jurnal Guru' },
    'absensi': { allowedRoles: ['ADMIN', 'GURU', 'WALI_KELAS'], defaultAction: 'edit', roleActions: { 'ADMIN': 'manage', 'WALI_KELAS': 'view' }, description: 'Absensi Siswa' },
    'nilai': { allowedRoles: ['ADMIN', 'GURU', 'WALI_KELAS'], defaultAction: 'edit', roleActions: { 'ADMIN': 'manage', 'WALI_KELAS': 'view' }, description: 'Nilai' },
    'piket': { allowedRoles: ['ADMIN', 'GURU'], defaultAction: 'view', roleActions: { 'ADMIN': 'manage' }, description: 'Laporan Piket' },

    // === LCKH ===
    'lckh': { allowedRoles: ['ADMIN', 'GURU'], defaultAction: 'edit', roleActions: { 'ADMIN': 'manage' }, description: 'LCKH Submission' },
    'lckh-approval': { allowedRoles: ['ADMIN'], defaultAction: 'manage', description: 'LCKH Approval' },
    'pembayaran': { allowedRoles: ['ADMIN', 'BENDAHARA_KOMITE'], defaultAction: 'manage', description: 'Pembayaran Honor Guru Asuh' },

    // === E-SUPERVISI ===
    'e-supervisi': {
        allowedRoles: ['ADMIN', 'GURU', 'SUPERVISOR', 'KAMAD', 'PENGAWAS_MADRASAH'],
        defaultAction: 'view',
        roleActions: { 'ADMIN': 'manage', 'SUPERVISOR': 'edit', 'KAMAD': 'edit', 'PENGAWAS_MADRASAH': 'edit' },
        description: 'E-Supervisi Akademik'
    },
    'e-supervisi:pengaturan': { allowedRoles: ['ADMIN'], defaultAction: 'manage', description: 'Tab Pengaturan Supervisi' },
    'e-supervisi:unggah': { allowedRoles: ['ADMIN', 'GURU'], defaultAction: 'edit', description: 'Tab Unggah Dokumen' },
    'e-supervisi:supervisi': { allowedRoles: ['ADMIN', 'SUPERVISOR', 'KAMAD', 'PENGAWAS_MADRASAH'], defaultAction: 'edit', description: 'Tab Supervisi' },
    'e-supervisi:hasil': { allowedRoles: ['ADMIN', 'GURU', 'SUPERVISOR', 'KAMAD', 'PENGAWAS_MADRASAH'], defaultAction: 'view', description: 'Tab Hasil Supervisi' },

    // === ADMINISTRASI ===
    'master': { allowedRoles: ['ADMIN'], defaultAction: 'manage', description: 'Master Data' },
    'master:tahun_ajaran': { allowedRoles: ['ADMIN'], defaultAction: 'manage', description: 'Tab Tahun Ajaran' },
    'master:siswa': { allowedRoles: ['ADMIN'], defaultAction: 'manage', description: 'Tab Siswa' },
    'master:guru': { allowedRoles: ['ADMIN'], defaultAction: 'manage', description: 'Tab Guru' },
    'master:mapel': { allowedRoles: ['ADMIN'], defaultAction: 'manage', description: 'Tab Mata Pelajaran' },
    'master:kelas': { allowedRoles: ['ADMIN'], defaultAction: 'manage', description: 'Tab Kelas' },
    'master:kode_guru': { allowedRoles: ['ADMIN'], defaultAction: 'manage', description: 'Tab Kode Guru' },
    'master:waktu': { allowedRoles: ['ADMIN'], defaultAction: 'manage', description: 'Tab Waktu' },
    'master:informasi': { allowedRoles: ['ADMIN', 'GURU', 'WALI_KELAS'], defaultAction: 'edit', roleActions: { 'ADMIN': 'manage' }, description: 'Tab Informasi' },

    // === PENGATURAN DATA ===
    'pengaturan-data': { allowedRoles: ['ADMIN', 'GURU', 'WALI_KELAS', 'OP_KELAS'], defaultAction: 'view', roleActions: { 'ADMIN': 'manage', 'OP_KELAS': 'view' }, description: 'Pengaturan Data' },
    'pengaturan_data:siswa_kelas': { allowedRoles: ['ADMIN', 'GURU', 'WALI_KELAS', 'OP_KELAS'], defaultAction: 'view', roleActions: { 'ADMIN': 'manage', 'OP_KELAS': 'manage' }, description: 'Tab Siswa-Kelas' },
    'pengaturan_data:wali_kelas': { allowedRoles: ['ADMIN', 'GURU', 'WALI_KELAS', 'OP_KELAS'], defaultAction: 'view', roleActions: { 'ADMIN': 'manage' }, description: 'Tab Wali Kelas' },
    'pengaturan_data:guru_asuh': { allowedRoles: ['ADMIN', 'GURU', 'WALI_KELAS', 'OP_KELAS'], defaultAction: 'view', roleActions: { 'ADMIN': 'manage' }, description: 'Tab Guru Asuh' },
    'pengaturan_data:mapel_kelas': { allowedRoles: ['ADMIN', 'GURU', 'OP_KELAS'], defaultAction: 'view', roleActions: { 'ADMIN': 'manage' }, description: 'Tab Mapel Kelas' },
    'pengaturan_data:dropdown': { allowedRoles: ['ADMIN', 'GURU', 'WALI_KELAS', 'OP_KELAS'], defaultAction: 'view', roleActions: { 'ADMIN': 'manage' }, description: 'Tab Master Dropdown' },
    'pengaturan_data:libur': { allowedRoles: ['ADMIN', 'GURU', 'WALI_KELAS', 'OP_KELAS'], defaultAction: 'view', roleActions: { 'ADMIN': 'manage' }, description: 'Tab Data Libur' },
    'pengaturan_data:generate_jurnal': { allowedRoles: ['ADMIN', 'GURU', 'WALI_KELAS', 'OP_KELAS'], defaultAction: 'view', roleActions: { 'ADMIN': 'manage' }, description: 'Tab Generate Jurnal' },
    'pengaturan_data:relasi_ortu': { allowedRoles: ['ADMIN', 'GURU', 'WALI_KELAS', 'OP_KELAS'], defaultAction: 'view', roleActions: { 'ADMIN': 'manage' }, description: 'Tab Relasi Orang Tua' },

    // === PENGATURAN USERS ===
    'pengaturan-users': { allowedRoles: ['ADMIN'], defaultAction: 'manage', description: 'Pengaturan Users' },
    'pengaturan_users:user_data': { allowedRoles: ['ADMIN'], defaultAction: 'manage', description: 'Tab Data & Status User' },
    'pengaturan_users:bulk_replace': { allowedRoles: ['ADMIN'], defaultAction: 'manage', description: 'Tab Ganti Data Massal' },
    'pengaturan_users:role_management': { allowedRoles: ['ADMIN'], defaultAction: 'manage', description: 'Tab Daftar Role' },
    'pengaturan_users:role_pages': { allowedRoles: ['ADMIN'], defaultAction: 'manage', description: 'Tab Akses Halaman per Role' },
    'pengaturan_users:menu_layout': { allowedRoles: ['ADMIN'], defaultAction: 'manage', description: 'Tab Susun Menu' },
    'pengaturan_users:page_access': { allowedRoles: ['ADMIN'], defaultAction: 'manage', description: 'Tab Akses Halaman' },

    // === PENGATURAN TUGAS ===
    'pengaturan-tugas': { allowedRoles: ['ADMIN'], defaultAction: 'manage', description: 'Pengaturan Tugas' },
    'pengaturan_tugas:guru_mapel': { allowedRoles: ['ADMIN'], defaultAction: 'manage', description: 'Tab Guru Mapel' },
    'pengaturan_tugas:jadwal_guru': { allowedRoles: ['ADMIN'], defaultAction: 'manage', description: 'Tab Jadwal PBM' },
    'pengaturan_tugas:jadwal_piket': { allowedRoles: ['ADMIN'], defaultAction: 'manage', description: 'Tab Jadwal Piket' },
    'pengaturan_tugas:tugas_tambahan': { allowedRoles: ['ADMIN'], defaultAction: 'manage', description: 'Tab Plotting Tugas Tambahan' },

    // === LAIN-LAIN ===
    'monitoring': { allowedRoles: ['ADMIN'], defaultAction: 'manage', description: 'Monitoring' },
    'tugas-tambahan': { allowedRoles: ['ADMIN'], defaultAction: 'manage', description: 'Tugas Tambahan' },

    // === PELAJARAN & KELAS ===
    'ketidakhadiran': {
        allowedRoles: ['ADMIN', 'GURU', 'WALI_KELAS', 'OP_IZIN', 'OP_UKS', 'SISWA'],
        defaultAction: 'view',
        roleActions: { 'ADMIN': 'manage', 'GURU': 'edit', 'WALI_KELAS': 'view', 'OP_IZIN': 'edit', 'OP_UKS': 'edit' },
        description: 'Ketidakhadiran'
    },
    'rekam-medis': {
        allowedRoles: ['ADMIN', 'OP_UKS', 'GURU', 'WALI_KELAS', 'SISWA'],
        defaultAction: 'view',
        roleActions: { 'ADMIN': 'manage', 'OP_UKS': 'manage', 'GURU': 'view', 'WALI_KELAS': 'view' },
        description: 'Rekam Medis Siswa'
    },
    'rekap-jurnal': { allowedRoles: ['ADMIN'], defaultAction: 'view', description: 'Rekap Jurnal' },
    'kinerja-guru': { allowedRoles: ['ADMIN'], defaultAction: 'view', description: 'Kinerja Guru' },
    'laporan': { allowedRoles: ['ADMIN'], defaultAction: 'view', description: 'Laporan' },
    'laporan:pengembangan_diri': { allowedRoles: ['ADMIN'], defaultAction: 'view', description: 'Laporan Pengembangan Diri' },

    // === KHUSUS SISWA ===
    'nilai-siswa': { allowedRoles: ['SISWA'], defaultAction: 'view', description: 'Nilai Siswa (portal)' },
    'tugas-siswa': { allowedRoles: ['SISWA'], defaultAction: 'view', description: 'Tugas Siswa' },

    // === LAINNYA ===
    'guru-asuh': { allowedRoles: ['ADMIN', 'GURU', 'WKM_KEASRAMAAN'], defaultAction: 'view', roleActions: { 'ADMIN': 'manage' }, description: 'Guru Asuh' },
    'wali-kelas': { allowedRoles: ['ADMIN', 'WALI_KELAS'], defaultAction: 'view', roleActions: { 'ADMIN': 'manage' }, description: 'Wali Kelas' },
    'bimbingan-konseling': { allowedRoles: ['ADMIN', 'BK'], defaultAction: 'manage', roleActions: { 'ADMIN': 'manage', 'BK': 'manage' }, description: 'Bimbingan Konseling' },
    'ekstrakurikuler': {
        // Hanya Siswa, Pembina Ekskul (tugas tambahan), dan pengelola (ADMIN/WKM Kesiswaan).
        // GURU polos TIDAK diberi akses; guru yang membina otomatis punya role PEMBINA_EKSKUL.
        allowedRoles: ['ADMIN', 'WKM_KESISWAAN', 'PEMBINA_EKSKUL', 'SISWA'],
        defaultAction: 'edit',
        roleActions: { 'ADMIN': 'manage', 'WKM_KESISWAAN': 'manage', 'PEMBINA_EKSKUL': 'edit', 'SISWA': 'edit' },
        description: 'Ekstrakurikuler'
    },
    'agenda-madrasah': { allowedRoles: ['ADMIN', 'GURU'], defaultAction: 'view', roleActions: { 'ADMIN': 'manage' }, description: 'Agenda Akademik' },
    'dokumen': { allowedRoles: ['ADMIN', 'GURU', 'WALI_KELAS', 'SISWA'], defaultAction: 'edit', roleActions: { 'ADMIN': 'manage' }, description: 'Pusat Dokumen' },
    'catatan-keuangan': { allowedRoles: ['ADMIN', 'BENDAHARA_KOMITE', 'GURU'], defaultAction: 'view', roleActions: { 'ADMIN': 'manage', 'BENDAHARA_KOMITE': 'manage', 'GURU': 'edit' }, description: 'Catatan Keuangan' },
    'klinik': {
        // Halaman Klinik hanya mengenal tiga role. Fungsi khusus (bentuk sesi,
        // approve, rekap) tidak lagi menempel pada role mana pun — ditunjuk
        // admin per orang di tab Pengaturan halaman Klinik.
        allowedRoles: ['ADMIN', 'GURU', 'SISWA'],
        defaultAction: 'view',
        roleActions: { 'ADMIN': 'manage', 'GURU': 'edit' },
        description: 'Klinik'
    },
    'layanan-ptsp': { allowedRoles: ['ADMIN'], defaultAction: 'manage', description: 'Layanan PTSP' },
    'um-kelulusan': { allowedRoles: ['ADMIN'], defaultAction: 'manage', description: 'UM & Kelulusan' },
    'ujian-madrasah': { allowedRoles: ['ADMIN', 'GURU'], defaultAction: 'view', roleActions: { 'ADMIN': 'manage' }, description: 'Ujian Madrasah' },
    'izin-guru': { allowedRoles: ['ADMIN', 'OP_IZINGURU', 'GURU'], defaultAction: 'edit', roleActions: { 'ADMIN': 'manage', 'OP_IZINGURU': 'manage' }, description: 'Izin Guru' },
    'surat': { allowedRoles: ['ADMIN', 'GURU'], defaultAction: 'edit', roleActions: { 'ADMIN': 'manage' }, description: 'Generate Surat' },
    'permintaan-surat': { allowedRoles: ['ADMIN', 'GURU', 'WALI_KELAS', 'SISWA'], defaultAction: 'view', roleActions: { 'ADMIN': 'manage', 'OP_LAYANAN': 'manage' }, description: 'Permintaan Surat' },
};

/**
 * Semua ejaan yang harus menunjuk ke entri yang sama.
 * Halaman ditulis campur di seluruh app: `pengaturan-data` / `pengaturan_data`,
 * `master:siswa` / `master.siswa`. Indeks ini menormalkan semuanya sekali di
 * awal, menggantikan percobaan varian yang dulu dilakukan tiap pemanggilan.
 */
function keyVariants(key: string): string[] {
    const base = key.replace(/\./g, ':');
    const out = new Set<string>();
    for (const sep of [':', '.']) {
        const k = base.replace(/:/g, sep);
        out.add(k);
        out.add(k.replace(/-/g, '_'));
        out.add(k.replace(/_/g, '-'));
    }
    return [...out];
}

const REQUIREMENT_INDEX: Record<string, PageRequirement> = (() => {
    const idx: Record<string, PageRequirement> = {};
    for (const [key, req] of Object.entries(PAGE_ROLE_REQUIREMENTS)) {
        // Ejaan asli menang atas varian turunan bila terjadi tabrakan.
        for (const k of keyVariants(key)) if (!idx[k]) idx[k] = req;
        idx[key] = req;
    }
    return idx;
})();

/** Cari requirement untuk sebuah resource, toleran terhadap ejaan `:` `.` `-` `_`. */
export function getRequirement(resource: string): PageRequirement | null {
    return REQUIREMENT_INDEX[resource] || null;
}

const ACTION_HIERARCHY: Record<string, number> = { 'view': 1, 'edit': 2, 'manage': 3 };

/** Apakah salah satu role user boleh membuka halaman ini? */
export function canAccessPage(userRoles: string[], pageId: string): boolean {
    const req = getRequirement(pageId);
    if (!req) return true; // Halaman tak terdaftar → izinkan (default lama)

    const allowed = req.allowedRoles.map(r => r.toUpperCase());
    return userRoles.some(role => allowed.includes(role.toUpperCase()));
}

/** Page ID dari sebuah path URL. */
export function getPageIdFromPath(path: string): string {
    const segments = path.split('/').filter(Boolean);
    return segments[0] || 'dashboard';
}

/** Cek akses berdasarkan path (dipakai middleware). */
export function canAccessPath(userRoles: string[], path: string): boolean {
    const pageId = getPageIdFromPath(path);
    if (pageId === 'dashboard' || pageId === 'login' || pageId === '') return true;
    return canAccessPage(userRoles, pageId);
}

/**
 * Level aksi tertinggi yang dimiliki user pada sebuah resource.
 * `null` = resource terdaftar tapi user tidak punya role yang diizinkan.
 */
export function getActionLevel(userRoles: string[], resource: string): string | null {
    const req = getRequirement(resource);
    if (!req) return null; // Resource tak terdaftar

    // Ambil level TERTINGGI dari semua role yang cocok — user multi-role tidak
    // boleh terkunci ke level rendah hanya karena urutan role di array.
    let best: string | null = null;
    let bestRank = 0;
    const consider = (level: string | undefined) => {
        if (!level) return;
        const rank = ACTION_HIERARCHY[level] || 0;
        if (rank > bestRank) { best = level; bestRank = rank; }
    };

    const allowed = req.allowedRoles.map(r => r.toUpperCase());
    for (const role of userRoles) {
        const upper = role.toUpperCase();
        if (req.roleActions?.[upper]) consider(req.roleActions[upper]);
        else if (allowed.includes(upper)) consider(req.defaultAction || 'view');
    }

    return best;
}

/** Apakah user boleh melakukan aksi tertentu pada resource? */
export function hasActionPermission(
    userRoles: string[],
    resource: string,
    requiredAction: string
): boolean {
    if (userRoles.includes('ADMIN') || userRoles.includes('ADMINISTRATOR')) return true;

    const actionLevel = getActionLevel(userRoles, resource);
    if (actionLevel === null) return !getRequirement(resource); // tak terdaftar → izinkan

    const requiredLevel = ACTION_HIERARCHY[requiredAction] || 0;
    const allowedLevel = ACTION_HIERARCHY[actionLevel] || 0;
    return requiredLevel <= allowedLevel;
}
