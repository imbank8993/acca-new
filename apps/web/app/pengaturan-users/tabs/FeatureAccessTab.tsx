'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import Swal from 'sweetalert2';
import { PageLoader } from '@/components/ui/Spinner';
import SearchableSelect, { type Option } from '@/components/ui/SearchableSelect';
import { formatRoleDisplay } from '@/lib/auth';

interface UserAccessItem {
    id: string;
    nama: string;
    role?: string;
    nip?: string;
    username?: string;
}

interface AccessConfig {
    allowedRoles: string[];
    allowedUsers: UserAccessItem[];
}

/**
 * Modul yang hak pengelolanya diatur di tab ini. Tiap modul disimpan sebagai
 * satu baris `site_settings` berisi JSON `{ allowedRoles, allowedUsers }`, dan
 * dibaca backend lewat `FeatureAccessGuard`.
 *
 * Menambah modul baru cukup menambah satu entri di sini lalu memasang
 * `@FeatureAccess('<settingKey>')` pada endpoint terkait.
 */
const MODUL: Array<{
    settingKey: string;
    judul: string;
    ikon: string;
    keterangan: string;
    peranBawaan?: string[];
    isCapability?: boolean;
}> = [
    // ─── KLINIK PEMBELAJARAN ─────────────────────────────────────────────
    {
        settingKey: 'klinik.kelola_sesi',
        isCapability: true,
        judul: 'Klinik Pembelajaran: Bentuk & Kelola Sesi',
        ikon: 'bi-calendar2-plus-fill',
        keterangan: 'Membentuk sesi untuk guru lain, mengubah/menghapus sesi siapa pun, serta menelusuri daftar kelas & kandidat siswa.',
    },
    {
        settingKey: 'klinik.approve_slot',
        isCapability: true,
        judul: 'Klinik Pembelajaran: Persetujuan Jadwal Sesi',
        ikon: 'bi-calendar-check-fill',
        keterangan: 'Menyetujui atau menolak pengajuan klinik kelompok dari siswa.',
    },
    {
        settingKey: 'klinik.approve_laporan',
        isCapability: true,
        judul: 'Klinik Pembelajaran: Persetujuan Laporan',
        ikon: 'bi-file-earmark-check-fill',
        keterangan: 'Menyetujui atau meminta revisi laporan pelaksanaan klinik dari guru.',
    },
    {
        settingKey: 'klinik.rekap',
        isCapability: true,
        judul: 'Klinik Pembelajaran: Rekap & Laporan Dokumen',
        ikon: 'bi-file-earmark-bar-graph-fill',
        keterangan: 'Mencetak rekap & laporan dokumen seluruh sesi klinik (memuat nama peserta dan foto dokumentasi).',
    },
    {
        settingKey: 'dokumen_access_config',
        judul: 'Pusat Dokumen',
        ikon: 'bi-folder-fill',
        keterangan: 'Daftar role dan pengguna yang diberikan akses pengelola dokumen.',
    },
    // ─── GURU ASUH ────────────────────────────────────────────────────────
    {
        settingKey: 'guru_asuh_approval_access_config',
        judul: 'Guru Asuh: Approval Laporan Bulanan',
        ikon: 'bi-patch-check-fill',
        keterangan: 'Meninjau, menyetujui, meminta revisi, dan mengesahkan laporan bulanan guru asuh. Hanya role ADMIN yang melekat di kode; role lain atau pengguna tertentu ditunjuk di sini (bawaan: WKM_KEASRAMAAN).',
        peranBawaan: ['WKM_KEASRAMAAN'],
    },
    // ─── JURNAL PEMBELAJARAN ─────────────────────────────────────────────
    {
        settingKey: 'jurnal_input_access_config',
        judul: 'Jurnal Pembelajaran: Input Jurnal',
        ikon: 'bi-pencil-square',
        keterangan: 'Role dan pengguna yang berwenang mengisi formulir jurnal pembelajaran kelas/mata pelajaran (bawaan: PENGURUS_KELAS).',
        peranBawaan: ['PENGURUS_KELAS'],
    },
    {
        settingKey: 'jurnal_review_banding_access_config',
        judul: 'Jurnal Pembelajaran: Review Banding',
        ikon: 'bi-shield-check',
        keterangan: 'Role dan pengguna yang berwenang meninjau, menyetujui, atau menolak permohonan banding jurnal dari guru (bawaan: ADMIN, OP_JURNAL).',
        peranBawaan: ['OP_JURNAL'],
    },
    {
        settingKey: 'jurnal_generate_access_config',
        judul: 'Jurnal Pembelajaran: Generate & Kelola Massal',
        ikon: 'bi-magic',
        keterangan: 'Role dan pengguna yang berwenang mengatur jadwal generate harian otomatis, generate manual, import, dan hapus massal jurnal (bawaan: ADMIN, OP_JURNAL).',
        peranBawaan: ['OP_JURNAL'],
    },
    {
        settingKey: 'jadwal_generate_access_config',
        judul: 'Kelola Jadwal (Generate PBM & Piket)',
        ikon: 'bi-calendar-week-fill',
        keterangan: 'Role dan pengguna yang boleh membuat, mengimpor, mengubah, dan menghapus jadwal PBM & piket.',
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
    },
    {
        settingKey: 'izin_guru_approval_access_config',
        judul: 'Setujui Izin & Sakit (Izin Guru)',
        ikon: 'bi-check2-square',
        keterangan:
            'Menyetujui atau menolak pengajuan Izin dan Sakit di halaman Izin Guru. CATATAN: '
            + 'role KAMAD dulu memegang ini secara melekat di kode; sekarang perlu ditunjuk di '
            + 'sini. Setiap pegawai tetap bisa mengajukan izin untuk dirinya sendiri tanpa '
            + 'ditunjuk.',
    },
    {
        settingKey: 'izin_guru_dinas_access_config',
        judul: 'Verifikasi Dinas Luar (Izin Guru)',
        ikon: 'bi-briefcase-fill',
        keterangan:
            'Memverifikasi pengajuan Dinas Luar. Dipisahkan dari persetujuan Izin & Sakit '
            + 'karena keduanya memang wewenang berbeda. CATATAN: dulu melekat pada OP_IZINGURU.',
    },
    {
        settingKey: 'izin_guru_kelola_access_config',
        judul: 'Kelola Semua Pengajuan Izin Guru',
        ikon: 'bi-folder-check',
        keterangan:
            'Melihat, menyunting, dan menghapus pengajuan izin milik siapa pun, termasuk yang '
            + 'sudah diproses. Pemegangnya otomatis juga boleh menyetujui Izin/Sakit dan '
            + 'memverifikasi Dinas Luar. CATATAN: dulu melekat pada OP_IZINGURU.',
    },
    {
        settingKey: 'absensi_access_config',
        judul: 'Kelola Absensi (Tab Kelola)',
        ikon: 'bi-journal-check',
        keterangan: 'Daftar role dan pengguna yang diberikan akses ke Tab Kelola pada modul Absensi.',
    },
    {
        settingKey: 'pengembangan_diri_access_config',
        judul: 'Kelola Survei Pengembangan Diri',
        ikon: 'bi-clipboard-data-fill',
        keterangan: 'Role dan pengguna yang boleh melihat rekap dan menghapus respon survei Pengembangan Diri. '
            + 'Hanya ADMIN yang melekat di kode -- tidak ada role operator bawaan, karena di basis data tidak ada '
            + 'role operator yang cocok untuk survei ini.',
    },
    // ─── MASTER DATA, PER TAB ─────────────────────────────────────────────────
    //
    // ATURAN untuk ketiga halaman pengaturan (Master Data, Pengaturan Data,
    // Pengaturan Tugas): HANYA role ADMIN yang melekat di kode, dan haknya tidak
    // bisa dicabut dari layar ini. Semua pengelola lain — termasuk para WKM —
    // ditunjuk di sini, per tab. Tidak ada lagi daftar role tertanam di controller,
    // tidak ada lagi `role_pages` (navigasi) yang dipakai sebagai wewenang.
    //
    // Dipecah per tab supaya wewenangnya bisa sesempit kebutuhan — "TU mengelola
    // tab Siswa" tanpa ikut membuka tab Pegawai atau Tahun Ajaran.
    //
    // Halaman Master Data terbuka bagi siapa pun yang memegang MINIMAL SATU tab;
    // tab yang tidak dipegang tidak ikut ditampilkan.
    //
    // Termasuk aksi yang paling berdampak: mutasi jenis pegawai (Guru ↔ Tendik)
    // dan penghapusan permanen (`?scope=all`) kini ikut wewenang tab, bukan lagi
    // khusus ADMIN. Yang menjaga penghapusan permanen adalah `?confirm=all` yang
    // dituntut server, bukan role pemanggilnya.
    {
        settingKey: 'master_tahun_ajaran_access_config',
        judul: 'Master Data: Tahun Ajaran',
        ikon: 'bi-calendar-range-fill',
        keterangan: 'Menambah, mengubah, menghapus tahun ajaran & semester, serta menyalakan periode aktif.',
    },
    {
        settingKey: 'master_siswa_access_config',
        judul: 'Master Data: Siswa',
        ikon: 'bi-people-fill',
        keterangan: 'Data induk siswa, termasuk kolom pribadi: NIK, tempat & tanggal lahir, nama dan nomor HP orang tua, alamat, asal sekolah.',
    },
    {
        settingKey: 'master_guru_access_config',
        judul: 'Master Data: Guru & Tendik',
        ikon: 'bi-person-vcard-fill',
        keterangan: 'Data induk pegawai (kedua tab sekaligus — satu tabel, dibedakan jenis pegawai), termasuk kolom pribadi: alamat, nomor HP, tanggal lahir, riwayat pendidikan, dan nomor rekening.',
    },
    {
        settingKey: 'master_kode_guru_access_config',
        judul: 'Master Data: Kode Guru',
        ikon: 'bi-person-badge-fill',
        keterangan: 'Kode singkat pegawai yang dipakai pada penyusunan jadwal.',
    },
    {
        settingKey: 'master_mapel_access_config',
        judul: 'Master Data: Mata Pelajaran',
        ikon: 'bi-book-fill',
        keterangan: 'Daftar mata pelajaran & kelompoknya, termasuk pemetaan mapel ke kelas dan guru pengampu.',
    },
    {
        settingKey: 'master_kelas_access_config',
        judul: 'Master Data: Kelas',
        ikon: 'bi-building-fill',
        keterangan: 'Rombongan belajar: nama kelas, tingkat, program, dan kode.',
    },
    {
        settingKey: 'master_waktu_access_config',
        judul: 'Master Data: Waktu (Jam Pelajaran)',
        ikon: 'bi-clock-fill',
        keterangan: 'Jam pelajaran per hari & program, termasuk penanda jam istirahat.',
    },
    {
        settingKey: 'master_jp_mapel_access_config',
        judul: 'Master Data: JP Mapel',
        ikon: 'bi-hourglass-split',
        keterangan: 'Alokasi jam pelajaran per mapel & tingkat kelas (intra dan kokurikuler).',
    },
    // ─── PENGATURAN DATA, PER TAB ─────────────────────────────────────────────
    //
    // Pola yang sama dengan Master Data: hanya ADMIN yang melekat di kode.
    // Sebelumnya enam tab di halaman ini dijaga EMPAT mekanisme berbeda, dan dua
    // tab tidak dijaga sama sekali.
    //
    // Pembacaan yang dipakai bersama halaman lain (daftar siswa-kelas dan
    // guru-mapel dipakai jadwal, wali kelas, guru asuh, UM kelulusan) TIDAK
    // digerbangi di sini — hanya penulisannya. Kalau bacanya ikut dibatasi, halaman
    // lain kehilangan sumber dropdown-nya.
    {
        settingKey: 'pengaturan_data_siswa_kelas_access_config',
        judul: 'Pengaturan Data: Siswa Kelas',
        ikon: 'bi-people',
        keterangan: 'Menambah, mengubah, menghapus penempatan siswa ke kelas, termasuk impor massal per rombel.',
    },
    {
        settingKey: 'pengaturan_data_guru_mapel_access_config',
        judul: 'Pengaturan Data: Guru Mapel',
        ikon: 'bi-book',
        keterangan: 'Menambah, mengubah, menghapus pemetaan guru ke mata pelajaran yang diampunya.',
    },
    {
        settingKey: 'pengaturan_data_ekskul_siswa_access_config',
        judul: 'Pengaturan Data: Siswa Ekskul',
        ikon: 'bi-volleyball',
        keterangan: 'Mengelola keanggotaan siswa pada ekstrakurikuler dari sisi pengelola. WKM Kesiswaan dulu memegang ini secara melekat di kode; sekarang perlu ditunjuk di sini. Pendaftaran mandiri oleh siswa sendiri tidak dipengaruhi.',
    },
    {
        settingKey: 'pengaturan_data_relasi_ortu_access_config',
        judul: 'Pengaturan Data: Relasi Orang Tua',
        ikon: 'bi-people-fill',
        keterangan: 'Melihat dan mengelola tautan akun orang tua ke siswa: menautkan, mengubah status keluarga, menghapus relasi, dan mencari siswa untuk form tambah.',
    },
    {
        settingKey: 'pengaturan_data_dropdown_access_config',
        judul: 'Pengaturan Data: Dropdown',
        ikon: 'bi-list-columns',
        keterangan: 'Mengelola daftar pilihan yang dipakai dropdown di seluruh aplikasi: kategori kehadiran, golongan, pangkat, jenis surat, dan lainnya.',
    },
    {
        // Tab paling merusak di seluruh aplikasi: satu permintaan bisa menimpa
        // kolom kunci di puluhan tabel sekaligus, termasuk `users.role`. Sebelum
        // ini, kedua endpoint-nya (`/api/reset-data/search` dan `/replace`) tidak
        // memeriksa sesi maupun role sama sekali.
        settingKey: 'pengaturan_data_ganti_massal_access_config',
        judul: 'Pengaturan Data: Ganti Data Massal',
        ikon: 'bi-arrow-repeat',
        keterangan:
            'Mencari sebuah nilai di seluruh basis data lalu menggantinya berikut seluruh '
            + 'kolom lain yang menyimpannya — dipakai untuk membetulkan salah tulis nama, NIP, '
            + 'atau NISN. Berikan hanya kepada yang benar-benar perlu: daftar kolom yang boleh '
            + 'diganti mencakup role, username, dan email pada tabel users.',
    },
    {
        settingKey: 'master_ekskul_access_config',
        judul: 'Master Data: Ekstrakurikuler',
        ikon: 'bi-volleyball',
        keterangan: 'Daftar ekstrakurikuler: menambah, mengubah, menghapus. CATATAN: WKM Kesiswaan dulu memegang ini secara melekat di kode; sekarang perlu ditunjuk di sini.',
    },

    // ── Halaman Pengaturan Tugas ────────────────────────────────────────────
    // Pola yang sama lagi. Sebelumnya keempat tab di halaman ini dijaga empat
    // mekanisme berbeda, dan tiga di antaranya bermasalah: daftar role tertanam
    // (Wali Kelas), perbandingan `role === 'ADMIN'` yang tidak pernah cocok dengan
    // role gabungan (Guru Asuh), dan `role_pages` — tabel NAVIGASI — pada tab yang
    // justru menentukan role tugas (Tugas Tambahan).
    {
        settingKey: 'pengaturan_tugas_wali_kelas_access_config',
        judul: 'Pengaturan Tugas: Wali Kelas',
        ikon: 'bi-person-workspace',
        keterangan: 'Menetapkan dan mencabut wali kelas per rombel. Menentukan role WALI_KELAS, yang membuka data absensi dan nilai kelas yang diampu.',
    },
    {
        settingKey: 'pengaturan_tugas_guru_asuh_access_config',
        judul: 'Pengaturan Tugas: Guru Asuh',
        ikon: 'bi-heart-fill',
        keterangan: 'Mengelola siswa asuh untuk SEMUA guru, termasuk pengosongan massal. Tanpa ini, guru tetap bisa mengurus siswa asuhnya sendiri.',
    },
    {
        settingKey: 'pengaturan_tugas_ploting_access_config',
        judul: 'Pengaturan Tugas: Tugas Tambahan',
        ikon: 'bi-person-vcard',
        keterangan:
            'Menetapkan dan mencabut tugas tambahan. Berikan hanya kepada yang benar-benar perlu: '
            + 'tabel ini menentukan role tugas (WALI_KELAS, PEMBINA_EKSKUL) yang ikut dihitung saat '
            + 'login, jadi menulis di sini berarti memberi atau mencabut hak akses. Penulisan jurnal '
            + 'harian oleh pemegang tugasnya sendiri tidak dipengaruhi pengaturan ini.',
    },
    {
        settingKey: 'pengaturan_tugas_pembina_ekskul_access_config',
        judul: 'Pengaturan Tugas: Pembina Ekskul',
        ikon: 'bi-people-fill',
        keterangan: 'Menetapkan dan mencabut pembina ekstrakurikuler. Ikut menentukan role PEMBINA_EKSKUL. Hanya ADMIN yang melekat di kode — WKM Kesiswaan kini perlu ditunjuk di sini.',
    },
    {
        settingKey: 'pengumuman_access_config',
        judul: 'Kelola Pengumuman',
        ikon: 'bi-megaphone-fill',
        keterangan: 'Daftar role dan pengguna yang diberikan akses untuk mengelola pengumuman (tambah, edit, pin, hapus).',
    },
    {
        settingKey: 'agenda_access_config',
        judul: 'Kelola Agenda Madrasah',
        ikon: 'bi-calendar-event-fill',
        keterangan: 'Role OP_AGENDA memiliki akses bawaan. Tambahkan role atau pengguna khusus untuk mengelola agenda madrasah (tambah, edit, hapus agenda, kategori, dan foto).',
        peranBawaan: ['OP_AGENDA'],
    },
    {
        settingKey: 'libur_access_config',
        judul: 'Kelola Data Libur Madrasah',
        ikon: 'bi-calendar-x-fill',
        keterangan: 'Role OP_JURNAL memiliki akses bawaan. Tambahkan role atau pengguna khusus untuk mengelola kalender dan penetapan hari libur madrasah.',
        peranBawaan: ['OP_JURNAL'],
    },
    {
        settingKey: 'informasi_akademik_access_config',
        judul: 'Kelola Informasi - Akademik',
        ikon: 'bi-mortarboard-fill',
        keterangan: 'Role WKM_AKADEMIK memiliki akses bawaan. Tambahkan role atau pengguna khusus untuk mengelola folder & dokumen kategori Akademik.',
        peranBawaan: ['WKM_AKADEMIK'],
    },
    {
        settingKey: 'informasi_keasramaan_access_config',
        judul: 'Kelola Informasi - Keasramaan',
        ikon: 'bi-building-fill',
        keterangan: 'Role WKM_KEASRAMAAN memiliki akses bawaan. Tambahkan role atau pengguna khusus untuk mengelola folder & dokumen kategori Keasramaan.',
        peranBawaan: ['WKM_KEASRAMAAN'],
    },
    {
        settingKey: 'informasi_kesiswaan_access_config',
        judul: 'Kelola Informasi - Kesiswaan',
        ikon: 'bi-people-fill',
        keterangan: 'Role WKM_KESISWAAN memiliki akses bawaan. Tambahkan role atau pengguna khusus untuk mengelola folder & dokumen kategori Kesiswaan.',
        peranBawaan: ['WKM_KESISWAAN'],
    },
    {
        settingKey: 'informasi_umum_access_config',
        judul: 'Kelola Informasi - Umum',
        ikon: 'bi-info-circle-fill',
        keterangan: 'Role WKM_HUMAS memiliki akses bawaan. Tambahkan role atau pengguna khusus untuk mengelola folder & dokumen kategori Umum.',
        peranBawaan: ['WKM_HUMAS'],
    },
];

/** Selalu punya akses penuh; tidak ditawarkan & tidak bisa dicabut dari sini. */
const ROLE_ADMIN = ['ADMIN', 'ADMINISTRATOR'];
const KONFIG_AWAL: AccessConfig = { allowedRoles: [...ROLE_ADMIN], allowedUsers: [] };

/** Modul yang konfigurasinya gagal dimuat — penyimpanannya ditahan. */
type GagalMuat = Set<string>;

function parseKonfig(nilai: unknown): AccessConfig {
    let raw: any = nilai;
    if (typeof raw === 'string') {
        try { raw = JSON.parse(raw); } catch { raw = null; }
    }
    if (!raw || typeof raw !== 'object') return { ...KONFIG_AWAL };
    return {
        allowedRoles: Array.isArray(raw.allowedRoles) ? raw.allowedRoles : [...ROLE_ADMIN],
        allowedUsers: Array.isArray(raw.allowedUsers) ? raw.allowedUsers : [],
    };
}

export default function FeatureAccessTab() {
    const [loading, setLoading] = useState(true);
    const [savingKey, setSavingKey] = useState<string | null>(null);

    /** Konfigurasi per modul, dikunci `settingKey`. */
    const [konfig, setKonfig] = useState<Record<string, AccessConfig>>({});
    const [gagalMuat, setGagalMuat] = useState<GagalMuat>(new Set());

    const [dbRoles, setDbRoles] = useState<any[]>([]);
    const [rawUserList, setRawUserList] = useState<any[]>([]);

    const muatSemua = useCallback(async () => {
        try {
            setLoading(true);
            const usersRes = await fetch('/api/admin/users');
            const rolesRes = await fetch('/api/admin/roles');
            const usersJson = await usersRes.json().catch(() => ({}));
            const rolesJson = await rolesRes.json().catch(() => ({}));

            const usersList: any[] = usersJson.ok && Array.isArray(usersJson.data) ? usersJson.data : [];
            if (usersJson.ok && Array.isArray(usersJson.data)) setRawUserList(usersJson.data);
            if (rolesJson.ok && Array.isArray(rolesJson.data)) setDbRoles(rolesJson.data);

            const configRes = await Promise.all(
                MODUL.map(async (m) => {
                    const ssRes = await fetch(`/api/site-settings?key=${encodeURIComponent(m.settingKey)}`).then(r => r.json()).catch(() => ({}));
                    if (m.isCapability) {
                        const capRes = await fetch(`/api/admin/capabilities?capability=${encodeURIComponent(m.settingKey)}`).then(r => r.json()).catch(() => ({}));
                        return { siteSetting: ssRes, cap: capRes };
                    }
                    return { siteSetting: ssRes };
                })
            );

            const hasil: Record<string, AccessConfig> = {};
            const gagal = new Set<string>();
            for (let i = 0; i < MODUL.length; i++) {
                const m = MODUL[i];
                const itemRes = configRes[i];
                const json = itemRes.siteSetting;
                const kunci = m.settingKey;

                if (m.isCapability) {
                    const capJson = itemRes.cap;
                    let capUsers: UserAccessItem[] = [];
                    if (capJson?.ok && Array.isArray(capJson.grants)) {
                        const grantedIds = capJson.grants.map((g: any) => String(g.user_id));
                        capUsers = grantedIds.map((id: string) => {
                            const found = usersList.find((u: any) => String(u.id || u.user_id) === id);
                            return {
                                id,
                                nama: found?.nama || found?.name || found?.nama_lengkap || `User #${id}`,
                                role: found?.role || (Array.isArray(found?.roles) ? found.roles[0] : ''),
                                nip: found?.nip || found?.nisn || '',
                                username: found?.username || '',
                            };
                        });
                    }

                    const ssCfg = json?.ok && json.data ? parseKonfig(json.data.value) : { ...KONFIG_AWAL };
                    if (capJson && !capJson.ok && (!json || !json.ok)) {
                        gagal.add(kunci);
                    }
                    hasil[kunci] = {
                        allowedRoles: ssCfg.allowedRoles || [...ROLE_ADMIN],
                        allowedUsers: capUsers.length > 0 ? capUsers : ssCfg.allowedUsers || [],
                    };
                } else {
                    if (json?.ok && json.data) {
                        hasil[kunci] = parseKonfig(json.data.value);
                    } else if (json?.ok) {
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

    const ubahRole = (m: (typeof MODUL)[number], dipilih: any) => {
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

    const ubahUser = (settingKey: string, dipilih: any) => {
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
                    // NIP ikut disimpan supaya backend tetap mengenali pengguna
                    // walau id barisnya berubah.
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

    const simpan = async (m: (typeof MODUL)[number]) => {
        // Ditahan sebelum apa pun dikirim: konfigurasi yang gagal dimuat tampil
        // sebagai "ADMIN saja" — identik dengan baris yang belum pernah diatur —
        // sehingga menyimpan dari keadaan itu menghapus penunjukan yang sebenarnya
        // ada, tanpa terlihat.
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
        } catch (err: any) {
            Swal.fire('Error', err.message || 'Terjadi kesalahan', 'error');
        } finally {
            setSavingKey(null);
        }
    };

    if (loading) return <PageLoader minHeight="300px" dotsOnly size={18} />;

    return (
        <div className="fa-clean-page">
            <div className="fa-header-bar">
                <div className="fa-title-group">
                    <i className="bi bi-sliders2"></i>
                    <h2>Hak Akses Fitur &amp; Pengelola Modul</h2>
                </div>
            </div>

            {MODUL.map(m => {
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
                                <i className={`bi ${m.ikon}`}></i>
                                <h3>Modul {m.judul}</h3>
                            </div>
                        </div>

                        <div className="fa-card-body">
                            <p className="fa-note">
                                {m.peranBawaan && m.peranBawaan.length > 0
                                    ? `ADMIN dan ${m.peranBawaan.join(', ')} memiliki hak akses bawaan. Tambahkan role atau pengguna di bawah untuk memberi hak yang sama.`
                                    : 'ADMIN selalu punya akses penuh. Tambahkan role atau pengguna di bawah untuk memberi hak yang sama.'}
                            </p>

                            <div className="fa-inline-field">
                                <SearchableSelect
                                    label="Role Pengelola"
                                    options={filteredRoleOptions}
                                    value={roleTerpilih}
                                    onChange={(v: any) => ubahRole(m, v)}
                                    placeholder="Cari atau Pilih Role Pengelola..."
                                    itemLabel="role"
                                    multiple={true}
                                />
                            </div>

                            <div className="fa-inline-field">
                                <SearchableSelect
                                    label="Pengguna Khusus"
                                    options={userOptions}
                                    value={userTerpilih}
                                    onChange={(v: any) => ubahUser(m.settingKey, v)}
                                    placeholder="Cari atau Pilih Pengguna Khusus..."
                                    itemLabel="pengguna"
                                    multiple={true}
                                />
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
                                        Simpan Perubahan
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                );
            })}

            <style jsx>{`
                .fa-clean-page {
                    display: flex;
                    flex-direction: column;
                    gap: 16px;
                }

                .fa-header-bar {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    padding: 12px 16px;
                    background: var(--n-card, #ffffff);
                    border: 1px solid var(--n-border, #e2e8f0);
                    border-radius: 12px;
                }
                .fa-title-group {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                }
                .fa-title-group i {
                    font-size: 1.25rem;
                    color: var(--n-primary, #3b82f6);
                }
                .fa-title-group h2 {
                    margin: 0;
                    font-size: 1rem;
                    font-weight: 700;
                    color: var(--n-ink, #0f172a);
                }

                /* CARD */
                .fa-card {
                    background: var(--n-card, #ffffff);
                    border: 1px solid var(--n-border, #e2e8f0);
                    border-radius: 14px;
                    overflow: hidden;
                    box-shadow: var(--n-shadow-soft);
                }
                .fa-card-head {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    padding: 14px 20px;
                    background: var(--n-soft, #f8fafc);
                    border-bottom: 1px solid var(--n-border, #e2e8f0);
                }
                .fa-head-info {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                }
                .fa-head-info i {
                    font-size: 1.2rem;
                    color: var(--n-primary, #3b82f6);
                }
                .fa-head-info h3 {
                    margin: 0;
                    font-size: 0.95rem;
                    font-weight: 700;
                    color: var(--n-ink, #0f172a);
                }

                .fa-card-body {
                    padding: 20px;
                    display: flex;
                    flex-direction: column;
                    gap: 16px;
                }

                .fa-note {
                    margin: 0;
                    font-size: 0.8rem;
                    color: var(--n-muted, #64748b);
                    line-height: 1.5;
                }

                .fa-inline-field {
                    width: 100%;
                }

                /* FOOTER */
                .fa-card-foot {
                    display: flex;
                    justify-content: flex-end;
                    padding: 12px 20px;
                    background: var(--n-soft, #f8fafc);
                    border-top: 1px solid var(--n-border, #e2e8f0);
                }
                .fa-btn-submit {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    padding: 9px 20px;
                    background: var(--n-primary, #3b82f6);
                    color: white;
                    border: none;
                    border-radius: 10px;
                    font-size: 0.85rem;
                    font-weight: 700;
                    cursor: pointer;
                    transition: all 0.2s;
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

                /* DARK MODE */
                :global(.dark) .fa-header-bar,
                :global(.dark) .fa-card,
                :global(.dark) .fa-card-head,
                :global(.dark) .fa-card-foot {
                    background: #000000 !important;
                    border-color: rgba(59, 130, 246, 0.35) !important;
                }
                :global(.dark) .fa-title-group h2,
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
