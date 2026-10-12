'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import Swal from 'sweetalert2';
import { PageLoader } from '@/components/ui/Spinner';
import SearchableSelect, { type Option } from '@/components/ui/SearchableSelect';
import FilterToolbar, { FilterSearch, FilterSelect } from '@/components/ui/FilterToolbar';
import { formatRoleDisplay } from '@/lib/auth';

interface UserAccessItem {
    id: string;
    nama: string;
    role?: string;
    nip?: string;
    username?: string;
}

interface RoleApiItem {
    name?: string;
    role?: string;
    description?: string;
}

interface UserApiItem {
    id?: string | number;
    user_id?: string | number;
    nama?: string;
    name?: string;
    nama_lengkap?: string;
    role?: string;
    roles?: string[];
    nip?: string;
    nisn?: string;
    username?: string;
}

interface AccessConfig {
    allowedRoles: string[];
    allowedUsers: UserAccessItem[];
}

interface ModulItem {
    settingKey: string;
    judul: string;
    ikon: string;
    keterangan: string;
    peranBawaan?: string[];
    isCapability?: boolean;
    /** Grup halaman — harus cocok dengan label sidebar / susun menu. */
    grup: string;
}

/**
 * Modul yang hak pengelolanya diatur di tab ini. Tiap modul disimpan sebagai
 * satu baris `site_settings` berisi JSON `{ allowedRoles, allowedUsers }`, dan
 * dibaca backend lewat `FeatureAccessGuard`.
 *
 * Menambah modul baru cukup menambah satu entri di sini lalu memasang
 * `@FeatureAccess('<settingKey>')` pada endpoint terkait.
 */
const MODUL: ModulItem[] = [
    // ─── KLINIK PEMBELAJARAN ─────────────────────────────────────────────
    {
        settingKey: 'klinik.kelola_sesi',
        isCapability: true,
        judul: 'Bentuk & Kelola Sesi',
        ikon: 'bi-calendar2-plus-fill',
        keterangan: 'Membentuk sesi untuk guru lain, mengubah/menghapus sesi siapa pun, serta menelusuri daftar kelas & kandidat siswa.',
        grup: 'Klinik Pembelajaran',
    },
    {
        settingKey: 'klinik.approve_slot',
        isCapability: true,
        judul: 'Persetujuan Jadwal Sesi',
        ikon: 'bi-calendar-check-fill',
        keterangan: 'Menyetujui atau menolak pengajuan klinik kelompok dari siswa.',
        grup: 'Klinik Pembelajaran',
    },
    {
        settingKey: 'klinik.approve_laporan',
        isCapability: true,
        judul: 'Persetujuan Laporan',
        ikon: 'bi-file-earmark-check-fill',
        keterangan: 'Menyetujui atau meminta revisi laporan pelaksanaan klinik dari guru.',
        grup: 'Klinik Pembelajaran',
    },
    {
        settingKey: 'klinik.rekap',
        isCapability: true,
        judul: 'Rekap & Laporan Dokumen',
        ikon: 'bi-file-earmark-bar-graph-fill',
        keterangan: 'Mencetak rekap & laporan dokumen seluruh sesi klinik (memuat nama peserta dan foto dokumentasi).',
        grup: 'Klinik Pembelajaran',
    },
    // ─── PUSAT DOKUMEN ──────────────────────────────────────────────────
    {
        settingKey: 'dokumen_access_config',
        judul: 'Pengelola Dokumen',
        ikon: 'bi-folder-fill',
        keterangan: 'Daftar role dan pengguna yang diberikan akses pengelola dokumen.',
        grup: 'Pusat Dokumen',
    },
    // ─── GURU ASUH ────────────────────────────────────────────────────────
    {
        settingKey: 'guru_asuh_approval_access_config',
        judul: 'Approval Laporan Bulanan',
        ikon: 'bi-patch-check-fill',
        keterangan: 'Meninjau, menyetujui, meminta revisi, dan mengesahkan laporan bulanan guru asuh. Hanya role ADMIN yang melekat di kode; role lain atau pengguna tertentu ditunjuk di sini (bawaan: WKM_KEASRAMAAN).',
        peranBawaan: ['WKM_KEASRAMAAN'],
        grup: 'Guru Asuh',
    },
    // ─── JURNAL PEMBELAJARAN ─────────────────────────────────────────────
    {
        settingKey: 'jurnal_input_access_config',
        judul: 'Input Jurnal',
        ikon: 'bi-pencil-square',
        keterangan: 'Role dan pengguna yang berwenang mengisi formulir jurnal pembelajaran kelas/mata pelajaran (bawaan: PENGURUS_KELAS).',
        peranBawaan: ['PENGURUS_KELAS'],
        grup: 'Jurnal Pembelajaran',
    },
    {
        settingKey: 'jurnal_review_banding_access_config',
        judul: 'Review Banding',
        ikon: 'bi-shield-check',
        keterangan: 'Role dan pengguna yang berwenang meninjau, menyetujui, atau menolak permohonan banding jurnal dari guru (bawaan: ADMIN, OP_JURNAL).',
        peranBawaan: ['OP_JURNAL'],
        grup: 'Jurnal Pembelajaran',
    },
    {
        settingKey: 'jurnal_generate_access_config',
        judul: 'Generate & Kelola Massal',
        ikon: 'bi-magic',
        keterangan: 'Role dan pengguna yang berwenang mengatur jadwal generate harian otomatis, generate manual, import, dan hapus massal jurnal (bawaan: ADMIN, OP_JURNAL).',
        peranBawaan: ['OP_JURNAL'],
        grup: 'Jurnal Pembelajaran',
    },
    // ─── JADWAL ─────────────────────────────────────────────────────────
    {
        settingKey: 'jadwal_generate_access_config',
        judul: 'Generate PBM & Piket',
        ikon: 'bi-calendar-week-fill',
        keterangan: 'Role dan pengguna yang boleh membuat, mengimpor, mengubah, dan menghapus jadwal PBM & piket.',
        grup: 'Jadwal',
    },
    {
        settingKey: 'tukar_jadwal_review_access_config',
        judul: 'Tinjau Tukar Jadwal',
        ikon: 'bi-arrow-left-right',
        keterangan:
            'Menyetujui atau menolak pengajuan tukar jadwal PBM dan piket, membatalkan '
            + 'pengajuan orang lain, dan menelusuri pengajuan milik guru lain. Dipisahkan dari '
            + '"Kelola Jadwal": menyusun jadwal dan menyetujui pertukaran adalah dua wewenang '
            + 'berbeda. CATATAN: WKM Akademik dan Kurikulum dulu memegang ini secara melekat di '
            + 'kode; sekarang perlu ditunjuk di sini. Guru tetap bisa mengajukan dan menanggapi '
            + 'pertukaran yang melibatkan dirinya tanpa ditunjuk.',
        grup: 'Jadwal',
    },
    // ─── IZIN GURU ──────────────────────────────────────────────────────
    {
        settingKey: 'izin_guru_approval_access_config',
        judul: 'Setujui Izin & Sakit',
        ikon: 'bi-check2-square',
        keterangan:
            'Menyetujui atau menolak pengajuan Izin dan Sakit di halaman Izin Guru. CATATAN: '
            + 'role KAMAD dulu memegang ini secara melekat di kode; sekarang perlu ditunjuk di '
            + 'sini. Setiap pegawai tetap bisa mengajukan izin untuk dirinya sendiri tanpa '
            + 'ditunjuk.',
        grup: 'Izin Guru',
    },
    {
        settingKey: 'izin_guru_dinas_access_config',
        judul: 'Verifikasi Dinas Luar',
        ikon: 'bi-briefcase-fill',
        keterangan:
            'Memverifikasi pengajuan Dinas Luar. Dipisahkan dari persetujuan Izin & Sakit '
            + 'karena keduanya memang wewenang berbeda. CATATAN: dulu melekat pada OP_IZINGURU.',
        grup: 'Izin Guru',
    },
    {
        settingKey: 'izin_guru_kelola_access_config',
        judul: 'Kelola Semua Pengajuan',
        ikon: 'bi-folder-check',
        keterangan:
            'Melihat, menyunting, dan menghapus pengajuan izin milik siapa pun, termasuk yang '
            + 'sudah diproses. Pemegangnya otomatis juga boleh menyetujui Izin/Sakit dan '
            + 'memverifikasi Dinas Luar. CATATAN: dulu melekat pada OP_IZINGURU.',
        grup: 'Izin Guru',
    },
    // ─── ABSENSI ────────────────────────────────────────────────────────
    {
        settingKey: 'absensi_access_config',
        judul: 'Kelola Absensi (Tab Kelola)',
        ikon: 'bi-journal-check',
        keterangan: 'Daftar role dan pengguna yang diberikan akses ke Tab Kelola pada modul Absensi.',
        grup: 'Absensi',
    },
    // ─── SURVEI ─────────────────────────────────────────────────────────
    {
        settingKey: 'pengembangan_diri_access_config',
        judul: 'Kelola Survei Pengembangan Diri',
        ikon: 'bi-clipboard-data-fill',
        keterangan: 'Role dan pengguna yang boleh melihat rekap dan menghapus respon survei Pengembangan Diri. '
            + 'Hanya ADMIN yang melekat di kode -- tidak ada role operator bawaan, karena di basis data tidak ada '
            + 'role operator yang cocok untuk survei ini.',
        grup: 'Lainnya',
    },
    // ─── MASTER DATA, PER TAB ─────────────────────────────────────────────────
    {
        settingKey: 'master_tahun_ajaran_access_config',
        judul: 'Tahun Ajaran',
        ikon: 'bi-calendar-range-fill',
        keterangan: 'Menambah, mengubah, menghapus tahun ajaran & semester, serta menyalakan periode aktif.',
        grup: 'Master Data',
    },
    {
        settingKey: 'master_siswa_access_config',
        judul: 'Siswa',
        ikon: 'bi-people-fill',
        keterangan: 'Data induk siswa, termasuk kolom pribadi: NIK, tempat & tanggal lahir, nama dan nomor HP orang tua, alamat, asal sekolah.',
        grup: 'Master Data',
    },
    {
        settingKey: 'master_guru_access_config',
        judul: 'Guru & Tendik',
        ikon: 'bi-person-vcard-fill',
        keterangan: 'Data induk pegawai (kedua tab sekaligus — satu tabel, dibedakan jenis pegawai), termasuk kolom pribadi: alamat, nomor HP, tanggal lahir, riwayat pendidikan, dan nomor rekening.',
        grup: 'Master Data',
    },
    {
        settingKey: 'master_kode_guru_access_config',
        judul: 'Kode Guru',
        ikon: 'bi-person-badge-fill',
        keterangan: 'Kode singkat pegawai yang dipakai pada penyusunan jadwal.',
        grup: 'Master Data',
    },
    {
        settingKey: 'master_mapel_access_config',
        judul: 'Mata Pelajaran',
        ikon: 'bi-book-fill',
        keterangan: 'Daftar mata pelajaran & kelompoknya, termasuk pemetaan mapel ke kelas dan guru pengampu.',
        grup: 'Master Data',
    },
    {
        settingKey: 'master_kelas_access_config',
        judul: 'Kelas',
        ikon: 'bi-building-fill',
        keterangan: 'Rombongan belajar: nama kelas, tingkat, program, dan kode.',
        grup: 'Master Data',
    },
    {
        settingKey: 'master_ruangan_access_config',
        judul: 'Ruangan',
        ikon: 'bi-door-open-fill',
        keterangan: 'Daftar ruangan pelaksanaan kegiatan dan klinik: nama ruangan, kode, lokasi/gedung, kapasitas, dan keterangan.',
        grup: 'Master Data',
    },
    {
        settingKey: 'master_waktu_access_config',
        judul: 'Waktu (Jam Pelajaran)',
        ikon: 'bi-clock-fill',
        keterangan: 'Jam pelajaran per hari & program, termasuk penanda jam istirahat.',
        grup: 'Master Data',
    },
    {
        settingKey: 'master_jp_mapel_access_config',
        judul: 'JP Mapel',
        ikon: 'bi-hourglass-split',
        keterangan: 'Alokasi jam pelajaran per mapel & tingkat kelas (intra dan kokurikuler).',
        grup: 'Master Data',
    },
    {
        settingKey: 'master_ekskul_access_config',
        judul: 'Ekstrakurikuler',
        ikon: 'bi-volleyball',
        keterangan: 'Daftar ekstrakurikuler: menambah, mengubah, menghapus. CATATAN: WKM Kesiswaan dulu memegang ini secara melekat di kode; sekarang perlu ditunjuk di sini.',
        grup: 'Master Data',
    },
    // ─── PENGATURAN DATA, PER TAB ─────────────────────────────────────────────
    {
        settingKey: 'pengaturan_data_siswa_kelas_access_config',
        judul: 'Siswa Kelas',
        ikon: 'bi-people',
        keterangan: 'Menambah, mengubah, menghapus penempatan siswa ke kelas, termasuk impor massal per rombel.',
        grup: 'Pengaturan Data',
    },
    {
        settingKey: 'pengaturan_data_guru_mapel_access_config',
        judul: 'Guru Mapel',
        ikon: 'bi-book',
        keterangan: 'Menambah, mengubah, menghapus pemetaan guru ke mata pelajaran yang diampunya.',
        grup: 'Pengaturan Data',
    },
    {
        settingKey: 'pengaturan_data_ekskul_siswa_access_config',
        judul: 'Siswa Ekskul',
        ikon: 'bi-volleyball',
        keterangan: 'Mengelola keanggotaan siswa pada ekstrakurikuler dari sisi pengelola. WKM Kesiswaan dulu memegang ini secara melekat di kode; sekarang perlu ditunjuk di sini. Pendaftaran mandiri oleh siswa sendiri tidak dipengaruhi.',
        grup: 'Pengaturan Data',
    },
    {
        settingKey: 'pengaturan_data_relasi_ortu_access_config',
        judul: 'Relasi Orang Tua',
        ikon: 'bi-people-fill',
        keterangan: 'Melihat dan mengelola tautan akun orang tua ke siswa: menautkan, mengubah status keluarga, menghapus relasi, dan mencari siswa untuk form tambah.',
        grup: 'Pengaturan Data',
    },
    {
        settingKey: 'pengaturan_data_dropdown_access_config',
        judul: 'Dropdown',
        ikon: 'bi-list-columns',
        keterangan: 'Mengelola daftar pilihan yang dipakai dropdown di seluruh aplikasi: kategori kehadiran, golongan, pangkat, jenis surat, dan lainnya.',
        grup: 'Pengaturan Data',
    },
    {
        settingKey: 'pengaturan_data_ganti_massal_access_config',
        judul: 'Ganti Data Massal',
        ikon: 'bi-arrow-repeat',
        keterangan:
            'Mencari sebuah nilai di seluruh basis data lalu menggantinya berikut seluruh '
            + 'kolom lain yang menyimpannya — dipakai untuk membetulkan salah tulis nama, NIP, '
            + 'atau NISN. Berikan hanya kepada yang benar-benar perlu: daftar kolom yang boleh '
            + 'diganti mencakup role, username, dan email pada tabel users.',
        grup: 'Pengaturan Data',
    },
    // ── Halaman Pengaturan Tugas ────────────────────────────────────────────
    {
        settingKey: 'pengaturan_tugas_wali_kelas_access_config',
        judul: 'Wali Kelas',
        ikon: 'bi-person-workspace',
        keterangan: 'Menetapkan dan mencabut wali kelas per rombel. Menentukan role WALI_KELAS, yang membuka data absensi dan nilai kelas yang diampu.',
        grup: 'Pengaturan Tugas',
    },
    {
        settingKey: 'pengaturan_tugas_guru_asuh_access_config',
        judul: 'Guru Asuh',
        ikon: 'bi-heart-fill',
        keterangan: 'Mengelola siswa asuh untuk SEMUA guru, termasuk pengosongan massal. Tanpa ini, guru tetap bisa mengurus siswa asuhnya sendiri.',
        grup: 'Pengaturan Tugas',
    },
    {
        settingKey: 'pengaturan_tugas_ploting_access_config',
        judul: 'Tugas Tambahan',
        ikon: 'bi-person-vcard',
        keterangan:
            'Menetapkan dan mencabut tugas tambahan. Berikan hanya kepada yang benar-benar perlu: '
            + 'tabel ini menentukan role tugas (WALI_KELAS, PEMBINA_EKSKUL) yang ikut dihitung saat '
            + 'login, jadi menulis di sini berarti memberi atau mencabut hak akses. Penulisan jurnal '
            + 'harian oleh pemegang tugasnya sendiri tidak dipengaruhi pengaturan ini.',
        grup: 'Pengaturan Tugas',
    },
    {
        settingKey: 'pengaturan_tugas_pembina_ekskul_access_config',
        judul: 'Pembina Ekskul',
        ikon: 'bi-people-fill',
        keterangan: 'Menetapkan dan mencabut pembina ekstrakurikuler. Ikut menentukan role PEMBINA_EKSKUL. Hanya ADMIN yang melekat di kode — WKM Kesiswaan kini perlu ditunjuk di sini.',
        grup: 'Pengaturan Tugas',
    },
    // ─── INFORMASI ──────────────────────────────────────────────────────
    {
        settingKey: 'pengumuman_access_config',
        judul: 'Kelola Pengumuman',
        ikon: 'bi-megaphone-fill',
        keterangan: 'Daftar role dan pengguna yang diberikan akses untuk mengelola pengumuman (tambah, edit, pin, hapus).',
        grup: 'Informasi',
    },
    {
        settingKey: 'informasi_akademik_access_config',
        judul: 'Kelola Folder Akademik',
        ikon: 'bi-mortarboard-fill',
        keterangan: 'Role WKM_AKADEMIK memiliki akses bawaan. Tambahkan role atau pengguna khusus untuk mengelola folder & dokumen kategori Akademik.',
        peranBawaan: ['WKM_AKADEMIK'],
        grup: 'Informasi',
    },
    {
        settingKey: 'informasi_keasramaan_access_config',
        judul: 'Kelola Folder Keasramaan',
        ikon: 'bi-building-fill',
        keterangan: 'Role WKM_KEASRAMAAN memiliki akses bawaan. Tambahkan role atau pengguna khusus untuk mengelola folder & dokumen kategori Keasramaan.',
        peranBawaan: ['WKM_KEASRAMAAN'],
        grup: 'Informasi',
    },
    {
        settingKey: 'informasi_kesiswaan_access_config',
        judul: 'Kelola Folder Kesiswaan',
        ikon: 'bi-people-fill',
        keterangan: 'Role WKM_KESISWAAN memiliki akses bawaan. Tambahkan role atau pengguna khusus untuk mengelola folder & dokumen kategori Kesiswaan.',
        peranBawaan: ['WKM_KESISWAAN'],
        grup: 'Informasi',
    },
    {
        settingKey: 'informasi_umum_access_config',
        judul: 'Kelola Folder Umum',
        ikon: 'bi-info-circle-fill',
        keterangan: 'Role WKM_HUMAS memiliki akses bawaan. Tambahkan role atau pengguna khusus untuk mengelola folder & dokumen kategori Umum.',
        peranBawaan: ['WKM_HUMAS'],
        grup: 'Informasi',
    },
    // ─── AGENDA MADRASAH ────────────────────────────────────────────────
    {
        settingKey: 'agenda_access_config',
        judul: 'Kelola Agenda',
        ikon: 'bi-calendar-event-fill',
        keterangan: 'Role OP_AGENDA memiliki akses bawaan. Tambahkan role atau pengguna khusus untuk mengelola agenda madrasah (tambah, edit, hapus agenda, kategori, dan foto).',
        peranBawaan: ['OP_AGENDA'],
        grup: 'Agenda Madrasah',
    },
    {
        settingKey: 'libur_access_config',
        judul: 'Kelola Data Libur',
        ikon: 'bi-calendar-x-fill',
        keterangan: 'Role OP_JURNAL memiliki akses bawaan. Tambahkan role atau pengguna khusus untuk mengelola kalender dan penetapan hari libur madrasah.',
        peranBawaan: ['OP_JURNAL'],
        grup: 'Agenda Madrasah',
    },
    // ─── NOTULENSI RAPAT ────────────────────────────────────────────────
    {
        settingKey: 'notulensi_access_config',
        judul: 'Pengelola Notulensi Rapat',
        ikon: 'bi-journal-check',
        keterangan: 'Role dan pengguna yang berwenang menambah, mengubah, dan menghapus catatan serta poin-poin hasil rapat.',
        grup: 'Notulensi Rapat',
    },
    // ─── BANK DATA ──────────────────────────────────────────────────────
    {
        settingKey: 'bank_data.kelola',
        isCapability: true,
        judul: 'Pengelola Bank Data',
        ikon: 'bi-database-fill-gear',
        keterangan: 'Menyalakan dataset, memilih kolom yang boleh keluar, dan mengelola konfigurasi Bank Data.',
        grup: 'Bank Data',
    },
];

/** Ikon per grup — dipakai di header grup. */
const GRUP_IKON: Record<string, string> = {
    'Klinik Pembelajaran': 'bi-plus-square-fill',
    'Pusat Dokumen': 'bi-folder-fill',
    'Guru Asuh': 'bi-person-heart',
    'Jurnal Pembelajaran': 'bi-book-fill',
    'Jadwal': 'bi-calendar-week-fill',
    'Izin Guru': 'bi-calendar-plus',
    'Absensi': 'bi-check-square-fill',
    'Master Data': 'bi-database-fill',
    'Pengaturan Data': 'bi-sliders',
    'Pengaturan Tugas': 'bi-calendar-plus-fill',
    'Informasi': 'bi-megaphone-fill',
    'Agenda Madrasah': 'bi-calendar-event-fill',
    'Notulensi Rapat': 'bi-journal-check',
    'Bank Data': 'bi-database-fill-gear',
    'Lainnya': 'bi-grid-fill',
};

/** Urutan tetap supaya grup tidak melompat-lompat. */
const GRUP_ORDER = [
    'Klinik Pembelajaran',
    'Pusat Dokumen',
    'Guru Asuh',
    'Jurnal Pembelajaran',
    'Jadwal',
    'Izin Guru',
    'Absensi',
    'Master Data',
    'Pengaturan Data',
    'Pengaturan Tugas',
    'Informasi',
    'Agenda Madrasah',
    'Notulensi Rapat',
    'Bank Data',
    'Lainnya',
];

/** Selalu punya akses penuh; tidak ditawarkan & tidak bisa dicabut dari sini. */
const ROLE_ADMIN = ['ADMIN', 'ADMINISTRATOR'];
const KONFIG_AWAL: AccessConfig = { allowedRoles: [...ROLE_ADMIN], allowedUsers: [] };

/** Modul yang konfigurasinya gagal dimuat — penyimpanannya ditahan. */
type GagalMuat = Set<string>;

function parseKonfig(nilai: unknown): AccessConfig {
    let raw: unknown = nilai;
    if (typeof raw === 'string') {
        try { raw = JSON.parse(raw); } catch { raw = null; }
    }
    if (!raw || typeof raw !== 'object') return { ...KONFIG_AWAL };
    const config = raw as Record<string, unknown>;
    return {
        allowedRoles: Array.isArray(config.allowedRoles)
            ? config.allowedRoles.filter((role): role is string => typeof role === 'string')
            : [...ROLE_ADMIN],
        allowedUsers: Array.isArray(config.allowedUsers)
            ? config.allowedUsers.filter((user): user is UserAccessItem =>
                !!user && typeof user === 'object' && 'id' in user && 'nama' in user)
            : [],
    };
}

export default function FeatureAccessTab() {
    const [loading, setLoading] = useState(true);
    const [savingKey, setSavingKey] = useState<string | null>(null);

    /** Konfigurasi per modul, dikunci `settingKey`. */
    const [konfig, setKonfig] = useState<Record<string, AccessConfig>>({});
    const [gagalMuat, setGagalMuat] = useState<GagalMuat>(new Set());

    const [dbRoles, setDbRoles] = useState<RoleApiItem[]>([]);
    const [rawUserList, setRawUserList] = useState<UserApiItem[]>([]);

    /** Search & filter state */
    const [search, setSearch] = useState('');
    const [filterGrup, setFilterGrup] = useState<string | null>(null);
    const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());

    const muatSemua = useCallback(async () => {
        try {
            setLoading(true);
            const [usersRes, rolesRes, ssAllRes] = await Promise.all([
                fetch('/api/admin/users').then(r => r.json()).catch(() => ({})),
                fetch('/api/admin/roles').then(r => r.json()).catch(() => ({})),
                fetch('/api/site-settings').then(r => r.json()).catch(() => ({})),
            ]);

            const usersList: UserApiItem[] = usersRes.ok && Array.isArray(usersRes.data) ? usersRes.data : [];
            if (usersRes.ok && Array.isArray(usersRes.data)) setRawUserList(usersRes.data);
            if (rolesRes.ok && Array.isArray(rolesRes.data)) setDbRoles(rolesRes.data);

            const allSettings: any[] = ssAllRes.ok && Array.isArray(ssAllRes.data) ? ssAllRes.data : [];
            const settingsMap = new Map<string, any>(allSettings.map((s: any) => [s.key, s]));

            // Muat grants kapabilitas khusus untuk modul bertanda isCapability
            const capResList = await Promise.all(
                MODUL.filter(m => m.isCapability).map(async (m) => {
                    const res = await fetch(`/api/admin/capabilities?capability=${encodeURIComponent(m.settingKey)}`).then(r => r.json()).catch(() => ({}));
                    return { key: m.settingKey, res };
                })
            );
            const capMap = new Map(capResList.map(c => [c.key, c.res]));

            const hasil: Record<string, AccessConfig> = {};
            const gagal = new Set<string>();

            for (const m of MODUL) {
                const kunci = m.settingKey;
                const settingRow = settingsMap.get(kunci);

                if (m.isCapability) {
                    const capJson = capMap.get(kunci);
                    let capUsers: UserAccessItem[] = [];
                    if (capJson?.ok && Array.isArray(capJson.grants)) {
                        const grantedIds = capJson.grants.map((g: { user_id: string | number }) => String(g.user_id));
                        capUsers = grantedIds.map((id: string) => {
                            const found = usersList.find(u => String(u.id || u.user_id) === id);
                            return {
                                id,
                                nama: found?.nama || found?.name || found?.nama_lengkap || `User #${id}`,
                                role: found?.role || (Array.isArray(found?.roles) ? found.roles[0] : ''),
                                nip: found?.nip || found?.nisn || '',
                                username: found?.username || '',
                            };
                        });
                    }

                    const ssCfg = settingRow ? parseKonfig(settingRow.value) : { ...KONFIG_AWAL };
                    if (!ssAllRes.ok && capJson && !capJson.ok) {
                        gagal.add(kunci);
                    }
                    hasil[kunci] = {
                        allowedRoles: ssCfg.allowedRoles || [...ROLE_ADMIN],
                        allowedUsers: capUsers.length > 0 ? capUsers : ssCfg.allowedUsers || [],
                    };
                } else {
                    if (settingRow) {
                        hasil[kunci] = parseKonfig(settingRow.value);
                    } else if (ssAllRes.ok) {
                        hasil[kunci] = { ...KONFIG_AWAL };
                    } else {
                        hasil[kunci] = { ...KONFIG_AWAL };
                        gagal.add(kunci);
                    }
                }
            }
            setKonfig(hasil);
            setGagalMuat(gagal);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { muatSemua(); }, [muatSemua]);

    const roleOptions: Option[] = useMemo(() => {
        return dbRoles
            .filter(r => !ROLE_ADMIN.includes(String(r.name || r.role || '').toUpperCase()))
            .map(r => {
                const name = String(r.name || r.role || '').toUpperCase();
                return {
                    value: name,
                    label: formatRoleDisplay(name),
                    subLabel: r.description ? r.description : `Role ID: ${name}`,
                };
            });
    }, [dbRoles]);

    const userOptions: Option[] = useMemo(() => {
        return rawUserList.map(u => {
            const roleStr = u.role || (Array.isArray(u.roles) ? u.roles[0] : '');
            const formattedRole = roleStr ? formatRoleDisplay(roleStr) : '';
            return {
                value: String(u.id || u.user_id || ''),
                label: u.nama || u.name || u.nama_lengkap || u.username || 'User',
                subLabel: u.nip ? `NIP: ${u.nip}` : u.nisn ? `NISN: ${u.nisn}` : formattedRole ? `Role: ${formattedRole}` : '',
            };
        });
    }, [rawUserList]);

    const ubahRole = (m: ModulItem, dipilih: string | number | (string | number)[]) => {
        const nilai = (Array.isArray(dipilih) ? dipilih : [dipilih]).map(String).filter(Boolean);
        const defaults = [...ROLE_ADMIN, ...(m.peranBawaan || [])];
        setKonfig(prev => ({
            ...prev,
            [m.settingKey]: {
                allowedRoles: Array.from(new Set([...defaults, ...nilai])),
                allowedUsers: prev[m.settingKey]?.allowedUsers ?? [],
            },
        }));
    };

    const ubahUser = (settingKey: string, dipilih: string | number | (string | number)[]) => {
        const ids = (Array.isArray(dipilih) ? dipilih : [dipilih]).map(String).filter(Boolean);
        setKonfig(prev => {
            const lama = prev[settingKey]?.allowedUsers ?? [];
            const baru: UserAccessItem[] = ids.map(id => {
                const ada = lama.find(u => String(u.id) === id);
                if (ada) return ada;
                const found = rawUserList.find(u => String(u.id || u.user_id) === id);
                return {
                    id,
                    nama: found?.nama || found?.name || found?.nama_lengkap || 'Pengguna',
                    role: found?.role || (Array.isArray(found?.roles) ? found.roles[0] : ''),
                    nip: found?.nip || found?.nisn || '',
                    username: found?.username || '',
                };
            });
            return {
                ...prev,
                [settingKey]: {
                    allowedRoles: prev[settingKey]?.allowedRoles ?? [...ROLE_ADMIN],
                    allowedUsers: baru,
                },
            };
        });
    };

    const simpan = async (m: ModulItem) => {
        if (gagalMuat.has(m.settingKey)) {
            Swal.fire(
                'Tidak bisa menyimpan',
                `Konfigurasi "${m.judul}" gagal dimuat, jadi yang tampil di layar belum tentu sama dengan yang tersimpan. Muat ulang halaman lebih dulu — menyimpan sekarang berisiko menghapus penunjukan yang sudah ada.`,
                'warning',
            );
            return;
        }

        setSavingKey(m.settingKey);
        try {
            const currentCfg = konfig[m.settingKey] ?? KONFIG_AWAL;
            const defaults = [...ROLE_ADMIN, ...(m.peranBawaan || [])];
            const mergedRoles = Array.from(new Set([...defaults, ...(currentCfg.allowedRoles || [])]));
            const payloadValue = {
                allowedRoles: mergedRoles,
                allowedUsers: currentCfg.allowedUsers || [],
            };

            const res = await fetch('/api/site-settings', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    key: m.settingKey,
                    value: JSON.stringify(payloadValue),
                    label: `Pengaturan Akses ${m.judul}`,
                    description: m.keterangan,
                }),
            });
            const json = await res.json();
            if (!json.ok) throw new Error(json.message || json.error || 'Gagal menyimpan pengaturan');

            if (m.isCapability) {
                const userIds = (currentCfg.allowedUsers || [])
                    .map((u) => Number(u.id))
                    .filter((v) => Number.isFinite(v));
                const capRes = await fetch('/api/admin/capabilities', {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        capability: m.settingKey,
                        userIds,
                        mode: 'grant',
                    }),
                });
                const capJson = await capRes.json();
                if (!capJson.ok) throw new Error(capJson.error || 'Gagal menyimpan kapabilitas petugas');
            }

            Swal.fire('Berhasil!', `Hak akses ${m.judul} berhasil disimpan.`, 'success');
            muatSemua();
        } catch (err: unknown) {
            Swal.fire('Error', err instanceof Error ? err.message : 'Terjadi kesalahan', 'error');
        } finally {
            setSavingKey(null);
        }
    };

    /** Bangun pengelompokan: { grupName → ModulItem[] } */
    const groupedModuls = useMemo(() => {
        const map = new Map<string, ModulItem[]>();
        const q = search.toLowerCase().trim();
        for (const m of MODUL) {
            // Filter per grup
            if (filterGrup && m.grup !== filterGrup) continue;
            // Filter per search
            if (q && !m.judul.toLowerCase().includes(q) && !m.keterangan.toLowerCase().includes(q) && !m.grup.toLowerCase().includes(q)) continue;
            if (!map.has(m.grup)) map.set(m.grup, []);
            map.get(m.grup)!.push(m);
        }
        // Urutkan sesuai GRUP_ORDER
        const sorted: [string, ModulItem[]][] = [];
        for (const g of GRUP_ORDER) {
            if (map.has(g)) sorted.push([g, map.get(g)!]);
        }
        // Tambahkan grup yang tidak ada di GRUP_ORDER (kalau ada)
        for (const [g, items] of map) {
            if (!GRUP_ORDER.includes(g)) sorted.push([g, items]);
        }
        return sorted;
    }, [search, filterGrup]);

    /** Daftar semua grup unik (untuk filter chips). */
    const allGroups = useMemo(() => {
        const seen = new Set<string>();
        const result: string[] = [];
        for (const g of GRUP_ORDER) {
            if (MODUL.some(m => m.grup === g) && !seen.has(g)) {
                seen.add(g);
                result.push(g);
            }
        }
        return result;
    }, []);

    const toggleGroup = (grup: string) => {
        setCollapsedGroups(prev => {
            const next = new Set(prev);
            if (next.has(grup)) next.delete(grup);
            else next.add(grup);
            return next;
        });
    };

    const totalFiltered = groupedModuls.reduce((sum, [, items]) => sum + items.length, 0);

    if (loading) return <PageLoader minHeight="300px" dotsOnly size={18} />;

    return (
        <div className="fa-clean-page">
            {/* ──── HEADER ──── */}
            <div className="fa-header-bar">
                <div className="fa-title-group">
                    <i className="bi bi-sliders2"></i>
                    <div>
                        <h2>Hak Akses Fitur &amp; Pengelola Modul</h2>
                        <p className="fa-subtitle">{totalFiltered} modul dari {MODUL.length} total</p>
                    </div>
                </div>
            </div>

            <FilterToolbar>
                <FilterSearch
                    value={search}
                    onChange={setSearch}
                    placeholder="Cari modul..."
                />
                <FilterSelect
                    label="Grup Halaman"
                    icon="grid"
                    value={filterGrup ?? 'all'}
                    onChange={value => setFilterGrup(value === 'all' ? null : value)}
                    options={[
                        { value: 'all', label: 'Semua Grup' },
                        ...allGroups.map(grup => ({ value: grup, label: grup })),
                    ]}
                />
            </FilterToolbar>

            {/* ──── GROUPED MODULES ──── */}
            {groupedModuls.length === 0 && (
                <div className="fa-empty">
                    <i className="bi bi-search"></i>
                    <p>Tidak ada modul yang cocok dengan pencarian.</p>
                </div>
            )}

            {groupedModuls.map(([grup, items]) => {
                const isCollapsed = collapsedGroups.has(grup);
                return (
                    <div className="fa-group" key={grup}>
                        <button
                            type="button"
                            className="fa-group-header"
                            onClick={() => toggleGroup(grup)}
                        >
                            <div className="fa-group-left">
                                <i className={`bi ${GRUP_IKON[grup] || 'bi-folder-fill'}`}></i>
                                <span className="fa-group-name">{grup}</span>
                                <span className="fa-group-badge">{items.length}</span>
                            </div>
                            <i className={`bi ${isCollapsed ? 'bi-chevron-down' : 'bi-chevron-up'} fa-group-chevron`}></i>
                        </button>

                        {!isCollapsed && (
                            <div className="fa-group-body">
                                {items.map(m => {
                                    const cfg = konfig[m.settingKey] ?? KONFIG_AWAL;
                                    const rolesToExclude = [...ROLE_ADMIN, ...(m.peranBawaan || [])];
                                    const roleTerpilih = cfg.allowedRoles.filter(r => !rolesToExclude.includes(String(r).toUpperCase()));
                                    const filteredRoleOptions = roleOptions.filter(opt => !(m.peranBawaan || []).includes(String(opt.value).toUpperCase()));
                                    const userTerpilih = cfg.allowedUsers.map(u => String(u.id));
                                    const sedangSimpan = savingKey === m.settingKey;

                                    return (
                                        <div className="fa-card" key={m.settingKey}>
                                            <div className="fa-card-head">
                                                <div className="fa-head-info">
                                                    <div>
                                                        <h3>{m.judul}</h3>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="fa-card-body">
                                                <p className="fa-note">
                                                    {m.peranBawaan && m.peranBawaan.length > 0
                                                        ? `ADMIN dan ${m.peranBawaan.join(', ')} memiliki hak akses bawaan.`
                                                        : 'ADMIN selalu punya akses penuh.'}
                                                </p>

                                                <div className="fa-fields-row">
                                                    <div className="fa-inline-field">
                                                        <SearchableSelect
                                                            label="Role Pengelola"
                                                            options={filteredRoleOptions}
                                                            value={roleTerpilih}
                                                            onChange={v => ubahRole(m, v)}
                                                            placeholder="Cari atau Pilih Role..."
                                                            itemLabel="role"
                                                            multiple={true}
                                                        />
                                                    </div>

                                                    <div className="fa-inline-field">
                                                        <SearchableSelect
                                                            label="Pengguna Khusus"
                                                            options={userOptions}
                                                            value={userTerpilih}
                                                            onChange={v => ubahUser(m.settingKey, v)}
                                                            placeholder="Cari atau Pilih Pengguna..."
                                                            itemLabel="pengguna"
                                                            multiple={true}
                                                        />
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="fa-card-foot">
                                                <button
                                                    type="button"
                                                    className="fa-btn-submit"
                                                    onClick={() => simpan(m)}
                                                    disabled={sedangSimpan}
                                                >
                                                    {sedangSimpan ? (
                                                        <>
                                                            <span className="fa-spin"></span>
                                                            Menyimpan...
                                                        </>
                                                    ) : (
                                                        <>
                                                            <i className="bi bi-check2-circle"></i>
                                                            Simpan
                                                        </>
                                                    )}
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                );
            })}

            <style jsx>{`
                .fa-clean-page {
                    display: flex;
                    flex-direction: column;
                    gap: 12px;
                }

                /* ─── HEADER ─── */
                .fa-header-bar {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    padding: 14px 18px;
                    background: var(--n-card, #ffffff);
                    border: 1px solid var(--n-border, #e2e8f0);
                    border-radius: 12px;
                }
                .fa-title-group {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                }
                .fa-title-group i {
                    font-size: 1.3rem;
                    color: var(--n-primary, #3b82f6);
                }
                .fa-title-group h2 {
                    margin: 0;
                    font-size: 1rem;
                    font-weight: 700;
                    color: var(--n-ink, #0f172a);
                }
                .fa-subtitle {
                    margin: 2px 0 0;
                    font-size: 0.78rem;
                    color: var(--n-muted, #64748b);
                }

                /* ─── EMPTY STATE ─── */
                .fa-empty {
                    text-align: center;
                    padding: 48px 20px;
                    color: var(--n-muted, #94a3b8);
                }
                .fa-empty i {
                    font-size: 2rem;
                    display: block;
                    margin-bottom: 10px;
                }
                .fa-empty p {
                    margin: 0;
                    font-size: 0.9rem;
                }

                /* ─── GROUP ─── */
                .fa-group {
                    border: 1px solid var(--n-border, #e2e8f0);
                    border-radius: 14px;
                    overflow: hidden;
                    background: var(--n-card, #ffffff);
                }
                .fa-group-header {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    width: 100%;
                    padding: 14px 18px;
                    background: var(--n-soft, #f8fafc);
                    border: none;
                    border-bottom: 1px solid var(--n-border, #e2e8f0);
                    cursor: pointer;
                    transition: background 0.15s;
                    font-family: inherit;
                }
                .fa-group-header:hover {
                    background: #eef4ff;
                }
                .fa-group-left {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                }
                .fa-group-left i {
                    font-size: 1.1rem;
                    color: var(--n-primary, #3b82f6);
                }
                .fa-group-name {
                    font-size: 0.92rem;
                    font-weight: 700;
                    color: var(--n-ink, #0f172a);
                }
                .fa-group-badge {
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    min-width: 22px;
                    height: 22px;
                    padding: 0 7px;
                    border-radius: 12px;
                    background: var(--n-primary, #3b82f6);
                    color: #fff;
                    font-size: 0.72rem;
                    font-weight: 700;
                }
                .fa-group-chevron {
                    font-size: 0.8rem;
                    color: var(--n-muted, #94a3b8);
                    transition: transform 0.2s;
                }
                .fa-group-body {
                    display: flex;
                    flex-direction: column;
                    gap: 0;
                }

                /* ─── CARD ─── */
                .fa-card {
                    border-bottom: 1px solid var(--n-border, #e2e8f0);
                }
                .fa-card:last-child {
                    border-bottom: none;
                }
                .fa-card-head {
                    display: flex;
                    align-items: flex-start;
                    justify-content: space-between;
                    padding: 16px 20px 0;
                }
                .fa-head-info {
                    display: flex;
                    align-items: flex-start;
                    gap: 12px;
                }
                .fa-head-info > i {
                    font-size: 1.1rem;
                    color: var(--n-primary, #3b82f6);
                    margin-top: 2px;
                    flex-shrink: 0;
                }
                .fa-head-info h3 {
                    margin: 0;
                    font-size: 0.9rem;
                    font-weight: 700;
                    color: var(--n-ink, #0f172a);
                }
                .fa-card-body {
                    padding: 12px 20px 16px;
                    display: flex;
                    flex-direction: column;
                    gap: 10px;
                }

                .fa-note {
                    margin: 0;
                    font-size: 0.76rem;
                    color: var(--n-muted, #94a3b8);
                    line-height: 1.4;
                    font-style: italic;
                }

                .fa-fields-row {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 14px;
                }
                @media (max-width: 768px) {
                    .fa-fields-row {
                        grid-template-columns: 1fr;
                    }
                }

                .fa-inline-field {
                    width: 100%;
                }

                /* ─── FOOTER ─── */
                .fa-card-foot {
                    display: flex;
                    justify-content: flex-end;
                    padding: 0 20px 14px;
                }
                .fa-btn-submit {
                    display: flex;
                    align-items: center;
                    gap: 6px;
                    padding: 7px 18px;
                    background: var(--n-primary, #3b82f6);
                    color: white;
                    border: none;
                    border-radius: 8px;
                    font-size: 0.82rem;
                    font-weight: 700;
                    cursor: pointer;
                    transition: all 0.2s;
                    font-family: inherit;
                }
                .fa-btn-submit:hover:not(:disabled) {
                    filter: brightness(1.08);
                    transform: translateY(-1px);
                }
                .fa-btn-submit:disabled {
                    opacity: 0.6;
                    cursor: not-allowed;
                }

                .fa-spin {
                    width: 14px;
                    height: 14px;
                    border: 2px solid rgba(255,255,255,0.3);
                    border-top-color: white;
                    border-radius: 50%;
                    animation: faSpin 0.75s linear infinite;
                    display: inline-block;
                }
                @keyframes faSpin { to { transform: rotate(360deg); } }

                /* ─── DARK MODE ─── */
                :global(.dark) .fa-header-bar,
                :global(.dark) .fa-group {
                    background: #0b1329 !important;
                    border-color: rgba(59, 130, 246, 0.25) !important;
                }
                :global(.dark) .fa-group-header {
                    background: rgba(59, 130, 246, 0.08) !important;
                    border-color: rgba(59, 130, 246, 0.2) !important;
                }
                :global(.dark) .fa-group-header:hover {
                    background: rgba(59, 130, 246, 0.14) !important;
                }
                :global(.dark) .fa-card {
                    border-color: rgba(59, 130, 246, 0.15) !important;
                }
                :global(.dark) .fa-title-group h2,
                :global(.dark) .fa-group-name,
                :global(.dark) .fa-head-info h3 {
                    color: #f1f5f9 !important;
                }
                :global(.dark) .fa-btn-submit {
                    background: #1a73e8 !important;
                    border: 1.5px solid #3b82f6 !important;
                    color: #ffffff !important;
                }
            `}</style>
        </div>
    );
}
