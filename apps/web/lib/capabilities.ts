/**
 * KAPABILITAS — unit izin per-FUNGSI (bukan per-role, bukan per-halaman).
 *
 * Masalah yang dipecahkan: dulu tiap kebutuhan baru ("si A boleh approve
 * laporan klinik tapi tidak boleh membentuk sesi") tidak punya tempat, jadi
 * dibuat role baru. Akibatnya role membengkak dan tiap perubahan izin butuh
 * edit kode + deploy.
 *
 * Pembagian tugas sekarang:
 *   - lib/role-pages.ts (tabel role_pages) → menu apa yang TAMPIL
 *   - lib/page-requirements.ts             → role apa yang boleh BUKA halaman
 *   - file ini + tabel di DB               → FUNGSI apa yang boleh dijalankan
 *
 * File ini hanya mendeklarasikan KONTRAK (daftar kapabilitas). Siapa benar-benar
 * memilikinya disimpan di DB:
 *   user_capabilities  — per orang; diisi admin lewat tab Pengaturan di halaman
 *                        yang bersangkutan (mis. Klinik → Pengaturan)
 *   role_capabilities  — paket per role; belum ada UI-nya, disediakan untuk
 *                        halaman yang nanti butuh "semua pemegang role X boleh"
 *
 * Yang BUKAN urusan kapabilitas: batas data (wali kelas hanya kelasnya, guru
 * hanya sesi yang ia ampu). Itu kepemilikan data — tetap dicek terpisah di
 * server. Kapabilitas menjawab "tombol apa", scope menjawab "data siapa".
 */

export interface CapabilityDef {
    /** Halaman tempat kapabilitas ini dipakai — untuk mengelompokkan di UI admin. */
    page: string;
    /** Label bahasa manusia yang tampil di checkbox admin. */
    label: string;
    /**
     * Jaring pengaman: role yang memegang kapabilitas ini SELAMA tabelnya
     * belum ada (deploy mendahului migrasi). Begitu tabel ada, daftar ini
     * tidak lagi berpengaruh — yang berlaku isi DB. Isinya sengaja minimal
     * (umumnya ADMIN saja) supaya jendela itu tidak membocorkan izin.
     */
    defaultRoles: string[];
    /** Catatan opsional untuk admin. */
    description?: string;
}

// Bawaan sengaja HANYA admin. `OP_KLINIK` sudah dihapus dari aplikasi, dan
// `WKM_AKADEMIK` — jabatan yang masih dipakai modul lain — tidak lagi punya
// keistimewaan di klinik. Siapa yang boleh, ditunjuk admin per orang lewat
// tab Pengaturan di halaman Klinik.
const BAWAAN_KLINIK = ['ADMIN'];

export const CAPABILITIES = {
    // === ABSENSI ===
    'absensi.admin': {
        page: 'absensi',
        label: 'Akses Tab Kelola & Rekap Absensi (Admin)',
        defaultRoles: ['ADMIN', 'ADMINISTRATOR', 'OP_JURNAL'],
        description: 'Melihat seluruh sesi absensi madrasah, mengedit/menghapus sesi massal, mengekspor rekap absensi, dan mengelola hak akses tab admin',
    },
    // === KLINIK ===
    'klinik.kelola_sesi': {
        page: 'klinik',
        label: 'Bentuk & kelola sesi klinik',
        defaultRoles: BAWAAN_KLINIK,
        description: 'Membentuk sesi untuk guru lain, mengubah/menghapus sesi siapa pun, menelusuri daftar kelas & kandidat siswa',
    },
    'klinik.approve_slot': {
        page: 'klinik',
        label: 'Setujui / tolak pengajuan sesi',
        defaultRoles: BAWAAN_KLINIK,
    },
    'klinik.approve_laporan': {
        page: 'klinik',
        label: 'Setujui / minta revisi laporan',
        defaultRoles: BAWAAN_KLINIK,
    },
    'klinik.rekap': {
        page: 'klinik',
        label: 'Cetak rekap & laporan klinik',
        defaultRoles: BAWAAN_KLINIK,
        description: 'Rekap memuat nama peserta dan foto dokumentasi seluruh sesi',
    },
    // Mengajukan jadwal SENGAJA bukan kapabilitas: setiap guru memang boleh
    // membuka jadwal dan setiap siswa memang boleh mengajukan. Itu identitas,
    // bukan izin. Menjadikannya centang hanya menambah pengaturan yang tak
    // pernah diubah siapa pun — cek role di route sudah tepat untuk keduanya.

    // Menandai honor terbayar SENGAJA bukan kapabilitas: Bendahara Komite
    // adalah jabatan sungguhan, bukan nama izin yang dikarang untuk sebuah
    // tombol. Tidak ada yang perlu menunjuk orangnya satu per satu.

    // === BANK DATA ===
    // MENGUNDUH sengaja BUKAN kapabilitas: siapa yang boleh mengekspor sama
    // dengan siapa yang diberi akses halaman lewat Akses per Role (role_pages).
    // Dulu ada `bank_data.export` plus penunjukan petugas per dataset; keduanya
    // dihapus 2026-09-08 karena menjadi lapisan "siapa orangnya" yang kedua di
    // atas keputusan yang sudah diambil di Akses per Role.
    //
    // Konsekuensinya route WAJIB memanggil `requirePage(user, 'bank-data')`
    // sendiri — halaman ini tidak terdaftar di lib/page-requirements.ts, dan
    // middleware hanya menjaga navigasi, bukan /api/*.
    'bank_data.export_sensitif': {
        page: 'bank-data',
        label: 'Sertakan kolom sensitif',
        defaultRoles: ['ADMIN'],
        description: 'NIK, kontak orang tua, alamat, dan nomor rekening pegawai. Tanpa ini, kolom bertanda mata-dicoret tidak pernah ikut walau admin menyalakannya',
    },
    'bank_data.kelola': {
        page: 'bank-data',
        label: 'Atur data & lihat riwayat ekspor',
        defaultRoles: ['ADMIN'],
        description: 'Menyalakan subjek, memilih kolom yang boleh keluar, dan membaca jejak unduhan',
    },
    // CATATAN: wewenang halaman Master Data TIDAK dikelola di sini.
    //
    // Sempat ditambahkan `master.kelola` di berkas ini, lalu dibatalkan: tabel
    // `role_capabilities`/`user_capabilities` masih kosong dan belum punya UI,
    // sementara aplikasi ini sudah punya mekanisme setara yang DIPAKAI dan punya
    // layarnya sendiri — "Hak Akses Fitur" (`site_settings` + FeatureAccessGuard).
    // Master Data memakai itu, lewat kunci `master_access_config`. Menambah sistem
    // izin kedua untuk satu halaman hanya akan memecah sumber kebenaran.
} as const satisfies Record<string, CapabilityDef>;

export type CapabilityKey = keyof typeof CAPABILITIES;

/** Semua kunci kapabilitas yang terdaftar. */
export const CAPABILITY_KEYS = Object.keys(CAPABILITIES) as CapabilityKey[];

/** Kapabilitas dikelompokkan per halaman — dipakai UI admin. */
export function capabilitiesByPage(): Record<string, Array<{ key: CapabilityKey } & CapabilityDef>> {
    const out: Record<string, Array<{ key: CapabilityKey } & CapabilityDef>> = {};
    for (const key of CAPABILITY_KEYS) {
        const def = CAPABILITIES[key] as CapabilityDef;
        (out[def.page] ||= []).push({ key, ...def });
    }
    return out;
}

export function isKnownCapability(key: string): key is CapabilityKey {
    return Object.prototype.hasOwnProperty.call(CAPABILITIES, key);
}

/** Bentuk minimal user yang dibutuhkan `can()` — cocok untuk User maupun ApiUser. */
export interface CapabilityHolder {
    roles?: string[];
    caps?: string[];
    isAdmin?: boolean;
}

/**
 * Apakah user boleh menjalankan fungsi ini?
 *
 * ADMIN selalu lolos — sengaja dipertahankan supaya tidak ada yang terkunci di
 * luar saat konfigurasi kapabilitas belum lengkap.
 *
 * Bila `caps` belum ada sama sekali (sesi lama, atau tabel kapabilitas belum
 * dibuat), jatuh kembali ke `defaultRoles` dari registry.
 */
export function can(user: CapabilityHolder | null | undefined, key: CapabilityKey): boolean {
    if (!user) return false;

    const roles = (user.roles || []).map(r => String(r).toUpperCase());
    if (user.isAdmin || roles.includes('ADMIN') || roles.includes('ADMINISTRATOR')) return true;

    if (Array.isArray(user.caps)) return user.caps.includes(key);

    const def = CAPABILITIES[key] as CapabilityDef | undefined;
    if (!def) return false;
    return def.defaultRoles.some(r => roles.includes(r.toUpperCase()));
}

/** Versi `can` untuk beberapa kapabilitas sekaligus (salah satu cukup). */
export function canAny(user: CapabilityHolder | null | undefined, keys: CapabilityKey[]): boolean {
    return keys.some(k => can(user, k));
}

/**
 * Hitung kapabilitas efektif seorang user. Murni (tanpa I/O) supaya bisa diuji.
 *
 *   union(kapabilitas semua role) + grant per-user − revoke per-user
 *
 * Revoke menang atas grant: pengecualian "semua wali kelas boleh, KECUALI si B"
 * harus bisa dinyatakan tanpa memecah role.
 */
export function resolveCapabilities(
    roles: string[],
    roleCaps: Record<string, string[]>,
    userGrants: string[] = [],
    userRevokes: string[] = []
): string[] {
    const set = new Set<string>();
    for (const role of roles) {
        for (const cap of roleCaps[String(role).toUpperCase()] || []) set.add(cap);
    }
    for (const cap of userGrants) set.add(cap);
    for (const cap of userRevokes) set.delete(cap);
    // Buang kapabilitas yang sudah dihapus dari kode tapi masih tertinggal di DB.
    return [...set].filter(isKnownCapability);
}

/** Paket bawaan role → kapabilitas; hanya dipakai sebagai jaring pengaman. */
export function defaultRoleCapabilities(): Record<string, string[]> {
    const map: Record<string, string[]> = {};
    for (const key of CAPABILITY_KEYS) {
        for (const role of (CAPABILITIES[key] as CapabilityDef).defaultRoles) {
            (map[role.toUpperCase()] ||= []).push(key);
        }
    }
    return map;
}
