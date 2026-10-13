/**
 * BANK DATA — katalog data yang boleh diekspor.
 *
 * Halaman ini punya TIGA subjek dan hanya tiga: Siswa, Guru, Tendik. Masing-
 * masing menghasilkan SATU BARIS PER ORANG. Data yang tersebar di tabel lain
 * (kelas, ekskul, wali kelas, mapel yang diampu, tugas tambahan) tidak lagi
 * jadi file terpisah melainkan KOLOM PENDUKUNG di baris orangnya — lihat
 * `PendukungDef`. Admin memilih kolom mana yang boleh keluar, kolom induk
 * maupun pendukung, lewat tab Pengaturan.
 *
 * File ini adalah KONTRAK: tabel sumber, kolom yang benar-benar ada, dan filter
 * yang didukung. Keputusan admin (dataset mana yang menyala, kolom mana yang
 * boleh ikut, siapa yang berhak) disimpan di DB — lihat
 * supabase/migrations/20260907_bank_data_init.sql.
 *
 * Pembagiannya sengaja sama dengan lib/capabilities.ts: kode mendeklarasikan
 * apa yang MUNGKIN, DB menyimpan apa yang DIIZINKAN. Nama tabel/kolom tidak
 * boleh datang dari request — route bank-data memakai service role dan
 * menembus RLS, jadi nama tabel yang bisa diketik bebas sama artinya dengan
 * membuka seluruh database.
 *
 * Kolom di bawah ini diambil dari skema DB yang BENAR-BENAR jalan
 * (scripts/bank-data-inspect-schema.js, dijalankan ulang 2026-09-08), bukan
 * dari isi file migrasi — keduanya beberapa kali berbeda di repo ini.
 *
 * Yang SENGAJA tidak pernah masuk katalog (bukan sekadar ditandai sensitif):
 *   users.password_hash, users.auth_id, users.cbt_auth_id, users.page_overrides
 * Kolom yang tidak terdaftar di sini tidak punya jalan keluar sama sekali.
 */

export type TipeKolom = 'teks' | 'angka' | 'tanggal' | 'boolean';

/**
 * Kolom yang nilainya TIDAK ada di tabel induk, melainkan dirangkum dari tabel
 * lain: semua baris yang cocok digabung jadi satu sel, dipisah koma.
 *
 * Dibuat deklaratif (bukan query per kolom) supaya aturan "nama tabel tidak
 * boleh datang dari request" tetap berlaku untuk data pendukung juga.
 */
export interface PendukungDef {
    /** Tabel tempat baris pendukung diambil. */
    table: string;
    /** Kolom di baris INDUK yang jadi kunci pencocokan. */
    kunciInduk?: string;
    /**
     * ATAU: kunci diambil dari hasil kolom pendukung lain yang sudah lebih dulu
     * diresolusi (mis. Wali Kelas dicari dari nilai kolom Kelas). Kolom yang
     * dirujuk WAJIB berada lebih dulu di dalam array `kolom`.
     */
    kunciDari?: string;
    /** Kolom di `table` yang dicocokkan dengan kunci di atas. */
    kunciPendukung: string;
    /** Kolom di `table` yang isinya masuk ke sel. */
    kolomNilai: string;
    /**
     * Satu lompatan pencarian lagi, untuk tabel relasi yang hanya menyimpan id.
     * Contoh: ekskul_siswa.ekskul_id → ekskul.nama_ekskul.
     */
    lewat?: { table: string; kunci: string; kolomNilai: string };
    kolomTahunAjaran?: string;
    kolomSemester?: string;
    /** Lihat catatan tipe semester di bawah. */
    tipeSemester?: 'teks' | 'angka';
    /** Bila diisi, hanya baris dengan kolom ini bernilai true yang ikut. */
    kolomAktif?: string;
}

export interface KolomDef {
    /**
     * Unik dalam satu dataset — kunci ini yang disimpan admin di
     * `bank_data_dataset_config.kolom_diizinkan`. Untuk kolom induk nilainya
     * sama dengan nama kolom DB; untuk kolom pendukung ia nama bebas yang tidak
     * boleh bentrok dengan kolom induk mana pun di dataset yang sama.
     */
    key: string;
    label: string;
    tipe: TipeKolom;
    /**
     * Data pribadi yang bukan konsumsi umum (NIK, kontak, alamat, rekening).
     * Hanya ikut bila pengekspor memegang `bank_data.export_sensitif` DAN
     * admin menyalakannya di pengaturan dataset. Dua-duanya harus terpenuhi.
     */
    sensitif?: boolean;
    /** Ada = kolom pendukung; tidak ada = kolom di tabel induk. */
    pendukung?: PendukungDef;
}

export type FilterKey = 'tahun_ajaran' | 'semester' | 'kelas';

/**
 * Penyempit daftar orang lewat tabel lain, dijalankan SEBELUM baris induk
 * diambil.
 *
 * Perlu karena master_siswa tidak punya kolom kelas maupun tahun ajaran:
 * "siswa kelas X-1 pada TA 2025/2026" hanya bisa dijawab lewat siswa_kelas.
 * Tanpa ini, filter kelas cuma bisa dipasang setelah baris terlanjur diambil —
 * dan batas baris akan terpakai oleh siswa yang justru dibuang.
 */
export interface PrasaringDef {
    table: string;
    /** Kolom yang dikumpulkan dari `table`. */
    kolomKunci: string;
    /** Kolom di tabel induk yang dicocokkan dengan nilai di atas. */
    kunciInduk: string;
    kolomKelas?: string;
    kolomTahunAjaran?: string;
    kolomSemester?: string;
    tipeSemester?: 'teks' | 'angka';
    kolomAktif?: string;
}

export interface DatasetDef {
    id: string;
    label: string;
    /** Ikon Bootstrap untuk kartu di halaman. */
    ikon: string;
    deskripsi: string;
    /** Tabel sumber baris induk — konstanta, tidak pernah dari input. */
    table: string;
    kolom: KolomDef[];
    filter: FilterKey[];
    /**
     * Saringan yang SELALU ikut, tidak bisa dimatikan admin maupun pengekspor.
     * Dipakai memisah Guru dan Tendik yang tinggal di satu tabel master_guru.
     */
    baseFilter?: { kolom: string; op: 'eq' | 'ilike'; nilai: string | number | boolean }[];
    prasaring?: PrasaringDef;
    urut?: { kolom: string; naik?: boolean };
    /** Batas keras baris; pengaturan admin hanya boleh memperkecil, tidak memperbesar. */
    batasBaris: number;
}

/**
 * Kolom `semester` campur tipe antar tabel dan itu TIDAK bisa diseragamkan dari
 * sini: TEXT 'Ganjil'/'Genap' di siswa_kelas & wali_kelas, INTEGER 1/2 di
 * ekskul_siswa & tugas_tambahan. Mengirim bentuk yang salah menghasilkan nol
 * baris tanpa pesan error, jadi tiap sumber menyatakan tipenya sendiri lewat
 * `tipeSemester` dan nilainya dinormalkan di query.ts.
 */
export const DATASETS = {
    siswa: {
        id: 'siswa',
        label: 'Data Siswa',
        ikon: 'bi-mortarboard',
        deskripsi:
            'Satu baris per siswa: identitas dari master_siswa, ditambah kelas, ekstrakurikuler, dan wali kelas pada tahun ajaran yang dipilih.',
        table: 'master_siswa',
        kolom: [
            { key: 'nisn', label: 'NISN', tipe: 'teks' },
            { key: 'nama_lengkap', label: 'Nama Lengkap', tipe: 'teks' },
            { key: 'gender', label: 'Jenis Kelamin', tipe: 'teks' },
            { key: 'tempat_lahir', label: 'Tempat Lahir', tipe: 'teks' },
            { key: 'tanggal_lahir', label: 'Tanggal Lahir', tipe: 'tanggal' },
            { key: 'asal_sekolah', label: 'Asal Sekolah', tipe: 'teks' },
            { key: 'aktif', label: 'Aktif', tipe: 'boolean' },

            // ── Pendukung ───────────────────────────────────────────────────
            {
                key: 'kelas', label: 'Kelas', tipe: 'teks',
                pendukung: {
                    table: 'siswa_kelas',
                    kunciInduk: 'nisn',
                    kunciPendukung: 'nisn',
                    kolomNilai: 'kelas',
                    kolomTahunAjaran: 'tahun_ajaran',
                    kolomSemester: 'semester',
                    tipeSemester: 'teks',
                    kolomAktif: 'aktif',
                },
            },
            {
                key: 'ekskul', label: 'Ekstrakurikuler', tipe: 'teks',
                pendukung: {
                    // ekskul_siswa.siswa_id merujuk master_siswa.id (bukan NISN),
                    // dan hanya menyimpan id ekskul — namanya diambil sekali lagi
                    // dari tabel `ekskul`.
                    table: 'ekskul_siswa',
                    kunciInduk: 'id',
                    kunciPendukung: 'siswa_id',
                    kolomNilai: 'ekskul_id',
                    lewat: { table: 'ekskul', kunci: 'id', kolomNilai: 'nama_ekskul' },
                    kolomTahunAjaran: 'tahun_ajaran',
                    kolomSemester: 'semester',
                    tipeSemester: 'angka',
                    kolomAktif: 'aktif',
                },
            },
            {
                key: 'wali_kelas', label: 'Wali Kelas', tipe: 'teks',
                pendukung: {
                    // Dicari dari nilai kolom Kelas di atas, bukan dari baris
                    // siswa: wali kelas melekat pada KELAS, dan seorang siswa
                    // bisa punya lebih dari satu rombel (peminatan).
                    table: 'wali_kelas',
                    kunciDari: 'kelas',
                    kunciPendukung: 'nama_kelas',
                    kolomNilai: 'nama_guru',
                    kolomTahunAjaran: 'tahun_ajaran',
                    kolomSemester: 'semester',
                    tipeSemester: 'teks',
                    kolomAktif: 'aktif',
                },
            },

            {
                key: 'email', label: 'Email', tipe: 'teks', sensitif: true,
                pendukung: {
                    table: 'public_users',
                    kunciInduk: 'nisn',
                    kunciPendukung: 'nip',
                    kolomNilai: 'email',
                },
            },

            // ── Sensitif ────────────────────────────────────────────────────
            { key: 'nik', label: 'NIK', tipe: 'teks', sensitif: true },
            { key: 'nama_ayah', label: 'Nama Ayah', tipe: 'teks', sensitif: true },
            { key: 'nama_ibu', label: 'Nama Ibu', tipe: 'teks', sensitif: true },
            { key: 'nomor_hp_ayah', label: 'No. HP Ayah', tipe: 'teks', sensitif: true },
            { key: 'nomor_hp_ibu', label: 'No. HP Ibu', tipe: 'teks', sensitif: true },
            { key: 'alamat', label: 'Alamat', tipe: 'teks', sensitif: true },
        ],
        filter: ['tahun_ajaran', 'semester', 'kelas'],
        // Untuk SISWA, filter tahun ajaran ikut mempersempit DAFTAR ORANGNYA:
        // "siswa TA 2024/2025" berarti yang terdaftar di TA itu, bukan seluruh
        // isi master_siswa dengan kolom pendukung kosong. Berbeda dari Guru &
        // Tendik di bawah — lihat catatan di sana.
        prasaring: {
            table: 'siswa_kelas',
            kolomKunci: 'nisn',
            kunciInduk: 'nisn',
            kolomKelas: 'kelas',
            kolomTahunAjaran: 'tahun_ajaran',
            kolomSemester: 'semester',
            tipeSemester: 'teks',
            kolomAktif: 'aktif',
        },
        urut: { kolom: 'nama_lengkap', naik: true },
        batasBaris: 5000,
    },

    guru: {
        id: 'guru',
        label: 'Data Guru',
        ikon: 'bi-person-video3',
        deskripsi:
            'Satu baris per guru dari master_guru, ditambah mata pelajaran yang diampu dan tugas tambahan pada tahun ajaran yang dipilih.',
        table: 'master_guru',
        kolom: [
            { key: 'nip', label: 'NIP / ID Guru', tipe: 'teks' },
            { key: 'nama_lengkap', label: 'Nama Lengkap', tipe: 'teks' },
            { key: 'tempat_lahir', label: 'Tempat Lahir', tipe: 'teks' },
            { key: 'tanggal_lahir', label: 'Tanggal Lahir', tipe: 'tanggal' },
            { key: 'golongan', label: 'Golongan', tipe: 'teks' },
            { key: 'pangkat', label: 'Pangkat', tipe: 'teks' },
            { key: 'tmt_tugas', label: 'TMT Tugas', tipe: 'tanggal' },
            { key: 'aktif', label: 'Aktif', tipe: 'boolean' },

            // ── Pendukung ───────────────────────────────────────────────────
            {
                key: 'mapel', label: 'Mapel Diampu', tipe: 'teks',
                pendukung: {
                    // guru_mapel adalah KOMPETENSI (melekat pada orangnya),
                    // bukan penugasan per tahun ajaran — karena itu tidak
                    // disaring TA/semester walau kolomnya ada di tabel.
                    table: 'guru_mapel',
                    kunciInduk: 'nip',
                    kunciPendukung: 'nip',
                    kolomNilai: 'nama_mapel',
                    kolomAktif: 'aktif',
                },
            },
            {
                key: 'tugas_tambahan', label: 'Tugas Tambahan', tipe: 'teks',
                pendukung: {
                    table: 'tugas_tambahan',
                    kunciInduk: 'nip',
                    kunciPendukung: 'nip',
                    kolomNilai: 'jabatan',
                    kolomTahunAjaran: 'tahun_ajaran',
                    kolomSemester: 'semester',
                    tipeSemester: 'angka',
                },
            },
            {
                key: 'email', label: 'Email', tipe: 'teks', sensitif: true,
                pendukung: {
                    table: 'public_users',
                    kunciInduk: 'nip',
                    kunciPendukung: 'nip',
                    kolomNilai: 'email',
                },
            },

            // ── Sensitif ────────────────────────────────────────────────────
            { key: 'alamat', label: 'Alamat', tipe: 'teks', sensitif: true },
            { key: 'no_hp', label: 'Nomor WA', tipe: 'teks', sensitif: true },
            { key: 'rekening_1_nama_bank', label: 'Bank', tipe: 'teks', sensitif: true },
            { key: 'rekening_1_nomor', label: 'No. Rekening', tipe: 'teks', sensitif: true },
            { key: 'rekening_1_atas_nama', label: 'Rekening a.n.', tipe: 'teks', sensitif: true },
        ],
        // Tanpa `prasaring`: pegawai tanpa tugas tambahan di TA terpilih TETAP
        // muncul (kolom pendukungnya saja yang kosong). Daftar kepegawaian tidak
        // boleh menyusut hanya karena seseorang belum diberi jabatan tahun ini.
        filter: ['tahun_ajaran', 'semester'],
        baseFilter: [{ kolom: 'jenis_pegawai', op: 'eq', nilai: 'GURU' }],
        urut: { kolom: 'nama_lengkap', naik: true },
        batasBaris: 2000,
    },

    tendik: {
        id: 'tendik',
        label: 'Data Tendik',
        ikon: 'bi-person-badge',
        deskripsi:
            'Satu baris per tenaga kependidikan dari master_guru, ditambah tugas tambahan pada tahun ajaran yang dipilih.',
        table: 'master_guru',
        kolom: [
            { key: 'nip', label: 'NIP / ID Pegawai', tipe: 'teks' },
            { key: 'nama_lengkap', label: 'Nama Lengkap', tipe: 'teks' },
            { key: 'tempat_lahir', label: 'Tempat Lahir', tipe: 'teks' },
            { key: 'tanggal_lahir', label: 'Tanggal Lahir', tipe: 'tanggal' },
            { key: 'golongan', label: 'Golongan', tipe: 'teks' },
            { key: 'pangkat', label: 'Pangkat', tipe: 'teks' },
            { key: 'tmt_tugas', label: 'TMT Tugas', tipe: 'tanggal' },
            { key: 'aktif', label: 'Aktif', tipe: 'boolean' },

            {
                key: 'tugas_tambahan', label: 'Tugas Tambahan', tipe: 'teks',
                pendukung: {
                    table: 'tugas_tambahan',
                    kunciInduk: 'nip',
                    kunciPendukung: 'nip',
                    kolomNilai: 'jabatan',
                    kolomTahunAjaran: 'tahun_ajaran',
                    kolomSemester: 'semester',
                    tipeSemester: 'angka',
                },
            },
            {
                key: 'email', label: 'Email', tipe: 'teks', sensitif: true,
                pendukung: {
                    table: 'public_users',
                    kunciInduk: 'nip',
                    kunciPendukung: 'nip',
                    kolomNilai: 'email',
                },
            },

            { key: 'alamat', label: 'Alamat', tipe: 'teks', sensitif: true },
            { key: 'no_hp', label: 'Nomor WA', tipe: 'teks', sensitif: true },
            { key: 'rekening_1_nama_bank', label: 'Bank', tipe: 'teks', sensitif: true },
            { key: 'rekening_1_nomor', label: 'No. Rekening', tipe: 'teks', sensitif: true },
            { key: 'rekening_1_atas_nama', label: 'Rekening a.n.', tipe: 'teks', sensitif: true },
        ],
        filter: ['tahun_ajaran', 'semester'],
        baseFilter: [{ kolom: 'jenis_pegawai', op: 'eq', nilai: 'TENDIK' }],
        urut: { kolom: 'nama_lengkap', naik: true },
        batasBaris: 2000,
    },
} as const satisfies Record<string, DatasetDef>;

export type DatasetId = keyof typeof DATASETS;

export const DATASET_IDS = Object.keys(DATASETS) as DatasetId[];

export function isKnownDataset(id: string): id is DatasetId {
    return Object.prototype.hasOwnProperty.call(DATASETS, id);
}

/** Definisi dataset, atau null bila id tidak dikenal. Selalu lewat sini. */
export function getDataset(id: string): DatasetDef | null {
    return isKnownDataset(id) ? (DATASETS[id] as unknown as DatasetDef) : null;
}

/**
 * Saring kolom yang diminta menjadi kolom yang benar-benar boleh keluar.
 *
 * Tiga gerbang berlapis, semuanya harus lolos:
 *   1. kolom ada di katalog (kode)
 *   2. kolom dinyalakan admin (kolom_diizinkan di DB)
 *   3. kolom sensitif hanya untuk pemegang `bank_data.export_sensitif`
 *
 * Urutan hasil mengikuti KATALOG, bukan urutan kiriman klien, supaya susunan
 * kolom di file Excel konsisten antar ekspor — dan supaya kolom pendukung yang
 * memakai `kunciDari` selalu diproses sesudah kolom yang dirujuknya.
 */
export function kolomEfektif(
    def: DatasetDef,
    diminta: string[] | null,
    diizinkanAdmin: string[],
    bolehSensitif: boolean,
): KolomDef[] {
    const setAdmin = new Set(diizinkanAdmin);
    const setMinta = diminta && diminta.length > 0 ? new Set(diminta) : null;
    return def.kolom.filter(k =>
        setAdmin.has(k.key)
        && (!k.sensitif || bolehSensitif)
        && (!setMinta || setMinta.has(k.key))
    );
}
