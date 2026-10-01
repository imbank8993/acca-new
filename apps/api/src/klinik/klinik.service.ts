// @ts-nocheck
import { Injectable, HttpException, UnauthorizedException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
/**
 * `db` di seluruh berkas ini adalah adapter PRISMA, bukan klien Supabase —
 * lihat `createPrismaDbAdapter`. Semua query berjalan di PostgreSQL VPS. Parameter
 * ini dulu bernama `supabaseAdmin` (warisan sebelum modul ini bermigrasi) dengan
 * anotasi `ReturnType<typeof getSupabaseAdmin>` yang bahkan menunjuk simbol tak
 * pernah ada; keduanya diganti agar tidak menyesatkan pembaca berikutnya.
 */
import { createPrismaDbAdapter, type PrismaDbAdapter } from '../prisma/prisma-db-adapter';
import { can } from '../access/access.service';
/**
 * Zona waktu madrasah. Seluruh jam pada klinik_slots disimpan sebagai waktu
 * DINDING setempat — `jam_mulai` "14:00" berarti pukul 14.00 WIB, bukan UTC.
 * Karena itu "sekarang" harus dihitung pada zona yang sama sebelum dibandingkan
 * dengan jendela absensi. Sebelumnya kedua helper di bawah mengembalikan UTC,
 * sehingga jendela absensi sesi siang baru terbuka pukul 21.00 WIB.
 */
const ZONA_MADRASAH = 'Asia/Jakarta';

/** "YYYY-MM-DDTHH:mm" pada waktu dinding madrasah. */
function waktuDindingMadrasah(): string {
    const bagian = new Intl.DateTimeFormat('en-CA', {
        timeZone: ZONA_MADRASAH,
        year: 'numeric', month: '2-digit', day: '2-digit',
        // hourCycle h23 supaya tengah malam jadi "00", bukan "24".
        hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
    }).formatToParts(new Date());
    const ambil = (tipe: string) => bagian.find(p => p.type === tipe)?.value || '';
    return `${ambil('year')}-${ambil('month')}-${ambil('day')}T${ambil('hour')}:${ambil('minute')}`;
}

const getCurrentDateInTz = async () => waktuDindingMadrasah().slice(0, 10);
const getCurrentDateTimeInTz = async () => waktuDindingMadrasah();

/**
 * Geser waktu dinding tanpa menyentuh zona: tanggal+jam diperlakukan sebagai
 * UTC hanya sebagai alat hitung, lalu diserialkan kembali apa adanya. Sepadan
 * dengan `jendelaAbsensi()` di apps/web/app/klinik/view.tsx.
 */
const geserWaktuDinding = (tanggal: string, jam: string, offset: number) => {
    const rawJam = String(jam || '').trim();
    const jamNorm = rawJam.includes('T') ? (rawJam.split('T')[1] || '').slice(0, 5) : rawJam.slice(0, 5);
    const rawTgl = String(tanggal || '').includes('T') ? String(tanggal).split('T')[0] : String(tanggal || '').slice(0, 10);
    if (!rawTgl || !jamNorm) return '';
    const d = new Date(`${rawTgl}T${jamNorm}:00Z`);
    if (Number.isNaN(d.getTime())) return '';
    d.setMinutes(d.getMinutes() + offset);
    return d.toISOString().slice(0, 16);
};

/**
 * Notifikasi personal ke satu akun (`users.auth_id`). Dulu stub kosong sisa
 * migrasi, sehingga setiap pemberitahuan klinik — penugasan peserta, hasil
 * approval — hilang tanpa jejak padahal kode memanggilnya seolah terkirim.
 *
 * Kegagalannya sengaja tidak dilempar: aksinya sudah tersimpan, dan gagal
 * mengabari bukan alasan membatalkan sesi yang sudah jadi.
 */
const notifyUser = async (db: PrismaDbAdapter, auth_id: string, payload: any) => {
    if (!auth_id) return;
    try {
        const { error } = await db.from('notifications').insert([{ ...payload, recipient_user_id: auth_id }]);
        if (error) throw error;
    } catch (err: any) {
        console.error('[klinik] gagal mengirim notifikasi:', err?.message || err);
    }
};

/**
 * `req.user` berasal dari tabel `users` yang TIDAK punya kolom `isAdmin` —
 * status admin hanya ada di `role`. Kode ini dulu membaca `isAdminUser(user)` yang
 * selamanya undefined, sehingga semua jalan keluar khusus admin tertutup.
 */
const isAdminUser = (user: any) =>
    (user?.roles || []).some((r: any) => ['ADMIN', 'ADMINISTRATOR'].includes(String(r).toUpperCase()));






/**
 * Kuota pengajuan kelompok siswa. Pengaju hanya memilih anggota awal, TAPI
 * kuotanya sengaja diberi ruang lebih supaya siswa lain masih bisa menekan
 * "Gabung" di tab Kelompok selagi pengajuan berstatus pending. Kalau kuota
 * disamakan persis dengan jumlah anggota awal, slot lahir dalam keadaan penuh
 * dan tombol Gabung tidak akan pernah bisa dipakai.
 */
const KUOTA_KELOMPOK_SISWA = 10;

/** Kuota default sesi yang dibuka guru (dipakai kalau form tidak mengirimnya). */
const KUOTA_GURU_DEFAULT = 5;

/** Peserta minimal supaya sebuah sesi layak dilaksanakan (dicek di update_report). */
const PESERTA_MINIMAL = 2;

/**
 * Status sebuah pengajuan yang belum diputuskan final.
 *
 *   pending_guru — khusus pengajuan kelompok siswa: guru pengampu yang DITUNJUK
 *                  siswa belum menyatakan bersedia. Reviewer belum melihatnya.
 *   pending      — sudah di meja pemegang izin klinik.approve_slot.
 *                  Sesi yang dibuka guru langsung lahir di status ini.
 *
 * Selama masih salah satu dari keduanya, pengaju boleh menyunting/membatalkan
 * dan siswa lain boleh ikut bergabung.
 */
const STATUS_PENGAJUAN = ['pending', 'pending_guru'];

/** Status sesi yang sudah berjalan — pesertanya masih boleh berubah. */
const STATUS_BERJALAN = ['open', 'full'];

/** Batas baris daftar calon anggota yang dikirim ke UI dalam sekali muat. */
const BATAS_DAFTAR_TEMAN = 300;

/**
 * Jendela absensi mandiri, relatif terhadap jadwal sesi. Siswa boleh menyatakan
 * hadir sejak sedikit sebelum jam mulai (datang lebih awal) sampai sekian lama
 * setelah jam selesai (sesi molor / antre mengisi). Di luar itu kehadiran hanya
 * bisa ditandai guru pengampu lewat `absen_guru`.
 */
const ABSENSI_TOLERANSI_AWAL_MENIT = 15;
const ABSENSI_TOLERANSI_AKHIR_MENIT = 60;

/** Nilai kehadiran yang sah. NULL = belum diabsen (beda dari 'A'/alpa). */
const KEHADIRAN_VALID = ['H', 'S', 'I', 'A'];

// Halaman Klinik cuma mengenal tiga role: ADMIN (semua fungsi), GURU dan
// SISWA (mengajukan). Fungsi khusus di antaranya — bentuk sesi, approve sesi,
// approve laporan, cetak rekap — TIDAK melekat pada role mana pun; admin
// menunjuk orangnya lewat tab Pengaturan di halaman Klinik. Dulu keempatnya
// dijaga satu fungsi `bolehKelolaKlinik` (ADMIN/OP_KLINIK/WKM_AKADEMIK),
// sehingga memberi seseorang salah satunya berarti memberi keempatnya.

/**
 * Jendela absensi sebuah sesi sebagai waktu dinding "YYYY-MM-DDTHH:mm", supaya
 * bisa dibandingkan langsung dengan getCurrentDateTimeInTz(). Perhitungannya
 * WAJIB di server: jam perangkat siswa bisa digeser sesuka hati.
 */
function jendelaAbsensi(slot: { tanggal: string; jam_mulai: string; jam_selesai: string }) {
    return {
        mulai: geserWaktuDinding(slot.tanggal, slot.jam_mulai, -ABSENSI_TOLERANSI_AWAL_MENIT),
        selesai: geserWaktuDinding(slot.tanggal, slot.jam_selesai, ABSENSI_TOLERANSI_AKHIR_MENIT),
    };
}

/**
 * Resolve baris `users` milik pemanggil. Utamakan `auth_id` (akurat), tapi
 * fallback ke `nip` (dipakai jg utk NISN siswa, lihat api-auth-pattern) kalau
 * baris auth_id tidak ketemu — beberapa akun siswa ternyata tidak selalu
 * punya `auth_id` konsisten dgn sesi login mereka.
 */
async function resolveUserRecord(db: PrismaDbAdapter, authId?: string, nip?: string) {
    if (authId) {
        const { data: byAuthId } = await db.from('users')
            .select('id, nama, nip, username').eq('auth_id', authId).maybeSingle();
        if (byAuthId) return byAuthId;
    }

    if (nip) {
        const { data: byNip } = await db.from('users')
            .select('id, nama, nip, username').eq('nip', nip).maybeSingle();
        if (byNip) return byNip;
    }
    return null;
}

/** Identitas siswa pada tabel `users` (NISN disimpan di nip/username). */
function identitasSiswa(u: any): string {
    return u?.nip || u?.username || '';
}

/**
 * Peta NISN -> baris users utk daftar NISN (siswa login pakai NISN di
 * kolom nip ATAU username, jadi dua-duanya dicek).
 */
async function mapUsersByNisn(db: PrismaDbAdapter, nisnList: string[]) {
    const map = new Map<string, { id: number; nama: string }>();
    if (nisnList.length === 0) return map;

    const [byNip, byUsername] = await Promise.all([
        db.from('users').select('id, nama, nip, username').in('nip', nisnList),
        db.from('users').select('id, nama, nip, username').in('username', nisnList),
    ]);
    for (const row of [...(byUsername.data || []), ...(byNip.data || [])]) {
        const key = identitasSiswa(row);
        if (key) map.set(key, { id: row.id, nama: row.nama });
        if (row.username) map.set(row.username, { id: row.id, nama: row.nama });
    }
    return map;
}

/**
 * Opsi form pengajuan klinik (mapel + guru pengampu). Dilayani dari server
 * dgn service role karena siswa tidak punya akses baca langsung ke
 * master_mapel/guru_mapel lewat anon client (RLS).
 */
async function getOptions(db: PrismaDbAdapter) {
    // Catatan skema: guru_mapel TIDAK punya kolom guru_id — NIP guru ada di `nip`.
    const [mapel, guruMapel] = await Promise.all([
        db.from('master_mapel').select('id, nama').eq('aktif', true).order('nama'),
        db.from('guru_mapel').select('nip, nama_guru, nama_mapel').eq('aktif', true).order('nama_guru'),
    ]);
    if (mapel.error) throw mapel.error;
    if (guruMapel.error) throw guruMapel.error;

    // Hanya tawarkan guru yang punya akun `users`; create_slot memetakan
    // NIP -> users.id, jadi guru tanpa akun akan gagal saat pengajuan dikirim.
    const nipList = [...new Set((guruMapel.data || []).map(g => g.nip).filter(Boolean))];
    const { data: akun } = nipList.length
        ? await db.from('users').select('nip').in('nip', nipList)
        : { data: [] as any[] };
    const punyaAkun = new Set((akun || []).map((u: any) => u.nip));

    return {
        mapel: mapel.data || [],
        guru_mapel: (guruMapel.data || []).filter(g => punyaAkun.has(g.nip)),
    };
}

/**
 * Kelas reguler = tingkat + satu huruf ("X A", "XI D", "XII B"). Rombel
 * peminatan ("XI Biologi 2") dan UTBK ("UTBK A") juga tersimpan di
 * siswa_kelas (lihat kurikulum-peminatan-rombel), tapi tidak dipakai utk
 * pemilihan kelompok klinik.
 */
const KELAS_REGULER = /^(X|XI|XII)\s+[A-Z]$/i;

/** Tahun ajaran aktif (is_active = 2 baris Ganjil+Genap dgn tahun sama). */
async function getTahunAjaranAktif(db: PrismaDbAdapter) {
    const { data } = await db
        .from('master_tahun_ajaran').select('tahun_ajaran').eq('is_active', true);
    return (data?.[0]?.tahun_ajaran as string) || null;
}

/**
 * Peta NISN -> kelas reguler pada tahun ajaran aktif. Dipakai saat menyimpan
 * peserta supaya kolom `kelas` tidak terisi rombel peminatan/UTBK atau kelas
 * tahun lalu (siswa_kelas menyimpan semuanya sekaligus).
 */
async function petaKelasReguler(db: PrismaDbAdapter, nisnList: string[]) {
    const peta = new Map<string, string>();
    const daftar = nisnList.filter(Boolean);
    if (daftar.length === 0) return peta;

    const ta = await getTahunAjaranAktif(db);
    let query = db.from('siswa_kelas')
        .select('nisn, kelas').in('nisn', daftar).eq('aktif', true);
    if (ta) query = query.eq('tahun_ajaran', ta);

    const { data } = await query;
    for (const row of data || []) {
        if (KELAS_REGULER.test(row.kelas || '') && !peta.has(row.nisn)) peta.set(row.nisn, row.kelas);
    }
    return peta;
}

/** Tingkat (angkatan) dari nama kelas reguler: "XII D" -> "XII". */
function tingkatKelas(kelas: string): string | null {
    const m = (kelas || '').match(/^(XII|XI|X)\s+[A-Z]$/i);
    return m ? m[1].toUpperCase() : null;
}

/**
 * Sesi boleh dibatasi ke tingkat tertentu lewat `target_kelas` (mis. ['XI','XII']).
 * Pencocokannya WAJIB lewat tingkatKelas(). Pola lama `^(X{1,3}|IX|IV|V?I{0,3})`
 * selalu berhenti di huruf X pertama, jadi "X A", "XI D", dan "XII B" sama-sama
 * dibaca "X": sesi bertarget XI/XII menolak SEMUA siswa, sedangkan sesi bertarget
 * X justru menerima seluruh tingkat.
 *
 * Return pesan error, atau null bila lolos.
 */
function salahTargetKelas(targetKelas: string[] | null | undefined, kelas: string | null): string | null {
    if (!targetKelas || targetKelas.length === 0) return null;
    const tingkat = tingkatKelas(kelas || '');
    if (!tingkat) return 'Kelas reguler Anda belum terdata, hubungi wali kelas';
    if (!targetKelas.includes(tingkat)) {
        return `Klinik ini khusus untuk kelas ${targetKelas.join(', ')}`;
    }
    return null;
}

/**
 * Pastikan seluruh anggota kelompok satu angkatan dgn pengaju dan berada di
 * kelas reguler. Daftar di UI sudah difilter, ini penjaga di sisi server.
 * Return pesan error, atau null bila lolos.
 */
async function validasiAnggotaSeangkatan(
    db: PrismaDbAdapter,
    identitasPengaju: string,
    anggotaIds: number[]
): Promise<string | null> {
    if (anggotaIds.length === 0) return null;

    const { data: userRows } = await db
        .from('users').select('id, nama, nip, username').in('id', anggotaIds);
    if ((userRows || []).length !== anggotaIds.length) {
        return 'Ada anggota kelompok yang datanya tidak ditemukan';
    }

    const identitas = (userRows || []).map(identitasSiswa);
    const peta = await petaKelasReguler(db, [identitasPengaju, ...identitas]);
    const tingkatPengaju = tingkatKelas(peta.get(identitasPengaju) || '');
    if (!tingkatPengaju) return 'Kelas reguler Anda belum terdata, hubungi wali kelas';

    const bedaAngkatan = (userRows || []).filter(u => {
        const t = tingkatKelas(peta.get(identitasSiswa(u)) || '');
        return t !== tingkatPengaju;
    });
    if (bedaAngkatan.length > 0) {
        return `Anggota kelompok harus satu angkatan (kelas ${tingkatPengaju}): ${bedaAngkatan.map(u => u.nama).join(', ')}`;
    }
    return null;
}

/**
 * Peserta yang DITUNJUK pembentuk sesi (guru/pengelola), bukan yang mendaftar
 * sendiri. Yang dijaga di sini:
 *
 *   1. setiap users.id benar-benar ada — kalau tidak, barisnya hilang diam-diam
 *      saat insert dan guru mengira semua peserta sudah terdaftar;
 *   2. pemiliknya benar-benar siswa (punya enrolment kelas reguler tahun
 *      berjalan) — tanpa ini id guru/admin mana pun bisa dikirim lewat API dan
 *      muncul sebagai peserta klinik;
 *   3. kelasnya cocok dengan `target_kelas` sesi — filter yang selama ini hanya
 *      ditegakkan pada jalur 'register'/'join_request'.
 *
 * TIDAK ada syarat seangkatan: pembentuk sesi memang boleh menggabung siswa
 * lintas kelas dan lintas tingkat selama target_kelas mengizinkan.
 * Return pesan error, atau null bila lolos.
 */
async function validasiPesertaTunjukan(
    db: PrismaDbAdapter,
    siswaIds: number[],
    targetKelas: string[] | null | undefined
): Promise<string | null> {
    if (siswaIds.length === 0) return null;

    const { data: userRows } = await db
        .from('users').select('id, nama, nip, username').in('id', siswaIds);
    if ((userRows || []).length !== siswaIds.length) {
        return 'Ada siswa terpilih yang datanya tidak ditemukan';
    }

    const peta = await petaKelasReguler(db, (userRows || []).map(identitasSiswa));

    const bukanSiswa = (userRows || []).filter(u => !peta.get(identitasSiswa(u)));
    if (bukanSiswa.length > 0) {
        return 'Peserta berikut tidak terdata di kelas reguler tahun ajaran aktif: '
            + bukanSiswa.map(u => u.nama || u.id).join(', ');
    }

    if (targetKelas && targetKelas.length > 0) {
        const diLuarTarget = (userRows || []).filter(
            u => !targetKelas.includes(tingkatKelas(peta.get(identitasSiswa(u)) || '') || ''));
        if (diLuarTarget.length > 0) {
            return `Sesi ini dibatasi untuk kelas ${targetKelas.join(', ')}, `
                + `tetapi ada peserta di luar tingkat itu: ${diLuarTarget.map(u => u.nama).join(', ')}`;
        }
    }
    return null;
}

/**
 * Validasi tanggal & jam sesi. Dipakai create_slot MAUPUN update_slot — tanpa
 * ini jadwal yang sudah lolos saat dibuat bisa diedit mundur ke masa lalu.
 * Tanggal "hari ini" diambil dari zona waktu madrasah, bukan UTC: pada dini
 * hari WIB, `new Date().toISOString()` masih menunjuk tanggal kemarin sehingga
 * sesi bertanggal lampau ikut lolos.
 */
async function validasiJadwal(p: any): Promise<string | null> {
    if (!p?.tanggal || !p?.jam_mulai || !p?.jam_selesai) {
        return 'Tanggal, jam mulai, dan jam selesai wajib diisi';
    }
    const hariIni = await getCurrentDateInTz();
    if (String(p.tanggal) < hariIni) return 'Tanggal tidak bisa di masa lalu';
    if (String(p.jam_selesai) <= String(p.jam_mulai)) return 'Jam selesai harus setelah jam mulai';
    return null;
}

/** Jumlah peserta yang saat ini terdaftar pada sebuah slot. */
async function hitungPeserta(db: PrismaDbAdapter, slotId: string) {
    const { count } = await db
        .from('klinik_peserta').select('*', { count: 'exact', head: true }).eq('slot_id', slotId);
    return count || 0;
}

/**
 * Tingkat kelas reguler pemanggil ("X"/"XI"/"XII"), atau null bila belum
 * terdata. Dipakai untuk menjaga aturan "satu kelompok = satu angkatan".
 */
async function tingkatSiswa(db: PrismaDbAdapter, identitas: string) {
    const peta = await petaKelasReguler(db, [identitas]);
    return { kelas: peta.get(identitas) || null, tingkat: tingkatKelas(peta.get(identitas) || '') };
}

/**
 * Daftar calon anggota kelompok utk siswa pengaju: seluruh siswa kelas reguler
 * pada angkatan yang sama (XII boleh dgn XII mana pun, dst) — bukan hanya
 * kelasnya sendiri — atau hasil pencarian nama/kelas bila `q` diisi. Hanya
 * siswa yang punya akun `users` yang bisa dijadikan peserta
 * (klinik_peserta.siswa_id FK ke users.id).
 */
async function getTemanKelompok(
    db: PrismaDbAdapter,
    nisnPengaju: string,
    q: string
) {
    // siswa_kelas menyimpan enrolment beberapa tahun ajaran; tanpa filter ini
    // kelas tahun lalu (mis. XI D) ikut terbawa bersama kelas sekarang (XII D).
    const taAktif = await getTahunAjaranAktif(db);

    const kelasQuery = db
        .from('siswa_kelas').select('kelas').eq('nisn', nisnPengaju).eq('aktif', true);
    if (taAktif) kelasQuery.eq('tahun_ajaran', taAktif);
    const { data: own } = await kelasQuery;
    const kelasPengaju = [...new Set((own || []).map((r: any) => r.kelas).filter(Boolean))]
        .filter(k => KELAS_REGULER.test(k));
    const tingkat = kelasPengaju.map(tingkatKelas).find(Boolean) || null;

    if (!tingkat) return { kelas: kelasPengaju, tingkat, data: [] };

    let query = db.from('siswa_kelas')
        .select('nisn, nama_siswa, kelas').eq('aktif', true).order('nama_siswa');
    if (taAktif) query = query.eq('tahun_ajaran', taAktif);

    if (q) {
        // Karakter yang punya arti khusus di filter PostgREST harus dibuang.
        const aman = q.replace(/[(),*%]/g, ' ').trim();
        if (!aman) return { kelas: kelasPengaju, tingkat, data: [] };
        query = query.or(`nama_siswa.ilike.%${aman}%,kelas.ilike.%${aman}%`);
    } else {
        // "XII %" tidak ikut mengambil "XI ..." karena spasi wajib setelah tingkat.
        // Rombel peminatan yg ikut terjaring (mis. "XI Biologi 2") disaring di bawah.
        query = query.like('kelas', `${tingkat} %`);
    }

    // Satu siswa punya beberapa baris (Ganjil+Genap, plus rombel peminatan), jadi
    // satu angkatan bisa >1000 baris — paginasi wajib, lihat postgrest-1000-row-cap.
    const rows: any[] = [];
    for (let dari = 0; ; dari += 1000) {
        const { data: halaman, error } = await query.range(dari, dari + 999);
        if (error) throw error;
        rows.push(...(halaman || []));
        if ((halaman?.length || 0) < 1000) break;
    }

    // Enrolment bisa duplikat (soft delete lama) — dedupe per NISN, dan hanya
    // pakai baris kelas reguler seangkatan supaya kelas yang tampil bukan rombel
    // peminatan dan tidak lintas angkatan.
    const unik = new Map<string, { nisn: string; nama_siswa: string; kelas: string }>();
    for (const r of rows) {
        if (!r.nisn || r.nisn === nisnPengaju) continue;
        if (tingkatKelas(r.kelas || '') !== tingkat) continue;
        if (!unik.has(r.nisn)) unik.set(r.nisn, r as any);
    }

    const userMap = await mapUsersByNisn(db, [...unik.keys()]);
    const semua = [...unik.values()]
        .filter(r => userMap.has(r.nisn))
        .map(r => ({
            siswa_id: userMap.get(r.nisn)!.id,
            nisn: r.nisn,
            nama: userMap.get(r.nisn)!.nama || r.nama_siswa,
            kelas: r.kelas,
        }))
        // Lintas kelas dalam satu angkatan — kelompokkan per kelas biar mudah dipindai.
        .sort((a, b) => (a.kelas || '').localeCompare(b.kelas || '') || (a.nama || '').localeCompare(b.nama || ''));

    // Angkatan besar dipotong supaya payload tetap wajar, tapi jumlah aslinya
    // ikut dikirim: tanpa itu siswa berkelas akhir abjad seolah "tidak ada"
    // dan tidak ada petunjuk bahwa daftarnya harus dicari lewat kotak pencarian.
    return {
        kelas: kelasPengaju,
        tingkat,
        data: semua.slice(0, BATAS_DAFTAR_TEMAN),
        total: semua.length,
        terpotong: semua.length > BATAS_DAFTAR_TEMAN,
    };
}

/**
 * Ambil SEMUA baris sebuah query, bukan 1000 pertama. PostgREST memotong hasil
 * di 1000 baris tanpa error apa pun — satu angkatan saja sudah melewatinya
 * karena tiap siswa punya beberapa baris enrolment (Ganjil+Genap+peminatan).
 */
async function ambilSemuaBaris(query: any): Promise<any[]> {
    const rows: any[] = [];
    for (let dari = 0; ; dari += 1000) {
        const { data: halaman, error } = await query.range(dari, dari + 999);
        if (error) throw error;
        rows.push(...(halaman || []));
        if ((halaman?.length || 0) < 1000) break;
    }
    return rows;
}

/** Urutan tampil tingkat, supaya "X A" tidak jatuh di antara "XI"/"XII" secara alfabetis. */
const URUTAN_TINGKAT: Record<string, number> = { X: 1, XI: 2, XII: 3 };

function bandingkanKelas(a: string, b: string): number {
    const ta = URUTAN_TINGKAT[tingkatKelas(a) || ''] || 9;
    const tb = URUTAN_TINGKAT[tingkatKelas(b) || ''] || 9;
    return ta - tb || a.localeCompare(b);
}

/**
 * Kelas reguler pada tahun ajaran aktif + jumlah siswanya, untuk pemilih peserta
 * pada sesi bentukan admin. Rombel peminatan/UTBK sengaja tidak ditawarkan —
 * sama seperti pemilihan kelompok siswa (lihat KELAS_REGULER).
 */
async function getKelasReguler(db: PrismaDbAdapter) {
    const ta = await getTahunAjaranAktif(db);
    // Urutan eksplisit: paginasi tanpa ORDER BY bisa mengembalikan baris yang
    // sama dua kali (atau melewatkannya) antar halaman.
    let query = db.from('siswa_kelas').select('nisn, kelas').eq('aktif', true).order('nisn');
    if (ta) query = query.eq('tahun_ajaran', ta);

    // Satu siswa bisa punya beberapa baris (Ganjil+Genap, sisa soft delete),
    // jadi yang dihitung NISN unik per kelas — bukan jumlah baris.
    const perKelas = new Map<string, Set<string>>();
    for (const row of await ambilSemuaBaris(query)) {
        if (!row.nisn || !KELAS_REGULER.test(row.kelas || '')) continue;
        if (!perKelas.has(row.kelas)) perKelas.set(row.kelas, new Set());
        perKelas.get(row.kelas)!.add(row.nisn);
    }

    return [...perKelas.entries()]
        .map(([kelas, nisnSet]) => ({ kelas, tingkat: tingkatKelas(kelas), jumlah: nisnSet.size }))
        .sort((a, b) => bandingkanKelas(a.kelas, b.kelas));
}

/** Batas baris daftar kandidat peserta yang dikirim ke UI dalam sekali muat. */
const BATAS_DAFTAR_KANDIDAT = 500;

/**
 * Calon peserta sesi bentukan admin: siswa kelas reguler pada tahun ajaran
 * aktif, disaring per kelas dan/atau kata kunci.
 *
 * Berbeda dari getTemanKelompok, di sini TIDAK ada syarat seangkatan — justru
 * itu inti fiturnya: admin boleh menggabung beberapa siswa lintas kelas bahkan
 * lintas tingkat dalam satu sesi.
 *
 * `kelasList` menerima dua bentuk sekaligus: nama kelas utuh ("XII A", dikirim
 * pemilih kelas modal admin) dan tingkat saja ("XII", dikirim pemilih Target
 * Kelas pada form guru).
 */
async function getKandidatSiswa(
    db: PrismaDbAdapter,
    kelasList: string[],
    q: string
) {
    // Tanpa penyaring apa pun, query di bawah memaginasi SELURUH tabel
    // siswa_kelas (tiap siswa punya beberapa baris enrolment) lalu menarik
    // ribuan NISN lewat mapUsersByNisn. Pemanggil wajib menyebut kelas atau
    // kata kunci lebih dulu.
    if (kelasList.length === 0 && !q) return { data: [], total: 0, terpotong: false };

    const ta = await getTahunAjaranAktif(db);
    let query = db.from('siswa_kelas')
        .select('nisn, nama_siswa, kelas').eq('aktif', true).order('nama_siswa');
    if (ta) query = query.eq('tahun_ajaran', ta);

    // Disaring di database, bukan setelah semua baris ditarik. "XII " dengan
    // spasi wajib membuat pola tingkat tidak ikut menjaring "XII" dari kelas
    // lain; rombel peminatan yang lolos disaring KELAS_REGULER di bawah.
    if (kelasList.length > 0) {
        query = query.or(
            kelasList
                .map(k => (k.includes(' ') ? `kelas.eq.${k}` : `kelas.like.${k} %`))
                .join(',')
        );
    }

    if (q) {
        // Karakter yang punya arti khusus di filter adapter harus dibuang —
        // termasuk koma, yang dipakai memisah bagian-bagian `or()`.
        const aman = q.replace(/[(),*%]/g, ' ').trim();
        // Kata kunci yang habis tersaring bukan berarti "tanpa filter": tanpa
        // penjagaan ini, mencari "%%%" justru mengembalikan seluruh siswa.
        if (!aman) return { data: [], total: 0, terpotong: false };
        query = query.or(`nama_siswa.ilike.%${aman}%,kelas.ilike.%${aman}%`);
    }

    const unik = new Map<string, { nisn: string; nama_siswa: string; kelas: string }>();
    for (const row of await ambilSemuaBaris(query)) {
        if (!row.nisn || !KELAS_REGULER.test(row.kelas || '')) continue;
        if (kelasList.length > 0) {
            const t = tingkatKelas(row.kelas || '');
            const cocok = kelasList.some(k => k === row.kelas || k === t);
            if (!cocok) continue;
        }
        if (!unik.has(row.nisn)) unik.set(row.nisn, row as any);
    }

    // Hanya siswa yang punya akun `users` — klinik_peserta.siswa_id FK ke users.id.
    const userMap = await mapUsersByNisn(db, [...unik.keys()]);
    const semua = [...unik.values()]
        .filter(r => userMap.has(r.nisn))
        .map(r => ({
            siswa_id: userMap.get(r.nisn)!.id,
            nisn: r.nisn,
            nama: userMap.get(r.nisn)!.nama || r.nama_siswa,
            kelas: r.kelas,
        }))
        .sort((a, b) => bandingkanKelas(a.kelas, b.kelas) || (a.nama || '').localeCompare(b.nama || ''));

    return {
        data: semua.slice(0, BATAS_DAFTAR_KANDIDAT),
        total: semua.length,
        terpotong: semua.length > BATAS_DAFTAR_KANDIDAT,
    };
}

/**
 * Peserta yang DITUNJUK pembentuk sesi, bukan yang mendaftar sendiri. Dipakai
 * membedakan penugasan (tidak boleh mengundurkan diri) dari pendaftaran
 * sukarela — sesi bentukan admin yang kuotanya longgar tetap bisa diisi
 * pendaftar biasa, dan mereka masih berhak membatalkan.
 */
const STATUS_DITUGASKAN = 'ditugaskan';

/**
 * Susun baris klinik_peserta untuk sekumpulan users.id. Kelas SELALU diturunkan
 * di server dari enrolment reguler tahun berjalan — nilai kiriman klien bisa
 * basi atau berisi rombel peminatan.
 */
async function bangunBarisPeserta(
    db: PrismaDbAdapter,
    slotId: string,
    siswaIds: number[],
    status: string = 'registered'
) {
    const { data: userRows } = await db
        .from('users').select('id, nama, nip, username').in('id', siswaIds);
    const kelasMap = await petaKelasReguler(db, (userRows || []).map(identitasSiswa));

    return (userRows || []).map(u => ({
        slot_id: slotId,
        siswa_id: u.id,
        nama_siswa: u.nama,
        kelas: kelasMap.get(identitasSiswa(u)) || 'SISWA',
        status,
    }));
}

/**
 * Kabari siswa yang DITUNJUK pembentuk sesi. Dikirim dari sini, bukan dari
 * trigger: baris pesertanya baru ada setelah slot tersimpan, dan tiap siswa
 * butuh notifikasi personal (recipient_user_id = users.auth_id).
 *
 * Dipakai create_slot (jalur guru) maupun create_slot_admin supaya kedua jalur
 * penugasan berbunyi sama.
 */
async function kabariPesertaTunjukan(
    db: PrismaDbAdapter,
    opsi: {
        slotId: string;
        siswaIds: number[];
        mapel: string;
        namaGuru: string;
        tanggal: string;
        jamMulai: string;
    }
) {
    if (opsi.siswaIds.length === 0) return;

    const { data: akunPeserta } = await db
        .from('users').select('id, auth_id').in('id', opsi.siswaIds);

    const tanggalTampil = new Date(`${opsi.tanggal}T12:00:00`)
        .toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long' });

    await Promise.all((akunPeserta || [])
        .filter((u: any) => u.auth_id)
        .map((u: any) => notifyUser(db, u.auth_id, {
            type: 'klinik_request',
            title: 'Anda Dijadwalkan Ikut Klinik',
            message: `Klinik ${opsi.mapel} bersama ${opsi.namaGuru} pada ${tanggalTampil}, `
                + `pukul ${String(opsi.jamMulai).slice(0, 5)}. Jangan lupa mengisi absensi saat sesi berlangsung.`,
            link: '/klinik?tab=available',
            source_table: 'klinik_slots',
            source_id: String(opsi.slotId),
        })));
}

/**
 * GET /api/klinik
 * Fetch slots based on user role and filters
 */
export async function handleGet(req: any, action: string, searchParams: URLSearchParams, db: PrismaDbAdapter) {
    try {
        const user = req.user;
        if (!user) throw new UnauthorizedException('Unauthorized');

        
        

        if (action === 'options') {
            return { ok: true, data: await getOptions(db) };
        }

        if (action === 'teman') {
            const q = (searchParams.get('q') || '').trim();

            // Dua daftar berbeda di balik satu action:
            //   pembentuk sesi (guru/pengelola) → seluruh kelas reguler, disaring
            //     tingkat yang sedang dipilih di form;
            //   siswa pengaju                   → hanya teman seangkatannya.
            //
            // Gerbang lama memakai `isAdmin` dan `!user.nisn`; KEDUANYA tidak
            // pernah ada pada baris `users` (NISN siswa tersimpan di nip/username,
            // lihat identitasSiswa). `!user.nisn` karenanya selalu true dan
            // membuat action ini membagikan seluruh direktori siswa — NISN, nama,
            // kelas, users.id — kepada akun apa pun yang punya token, padahal
            // action `kandidat` di bawah menjaga data yang sama persis.
            if (user.roles?.includes('GURU') || can(user, 'klinik.kelola_sesi')) {
                const targetKelas = (searchParams.get('target_kelas') || searchParams.get('kelas') || '')
                    .split(',').map(k => k.trim()).filter(Boolean);
                const result = await getKandidatSiswa(db, targetKelas, q);
                return { ok: true, data: result.data, total: result.total, terpotong: result.terpotong };
            }

            if (!user.roles?.includes('SISWA')) {
                throw new ForbiddenException('Anda tidak memiliki izin tersebut');
            }
            const result = await getTemanKelompok(db, identitasSiswa(user), q);
            return { ok: true, ...result };
        }

        if (action === 'kelas') {
            // Daftar kelas hanya untuk pembentuk sesi — siswa tidak perlu (dan
            // tidak boleh) menelusuri seluruh rombel madrasah.
            if (!can(user, 'klinik.kelola_sesi')) throw new ForbiddenException( 'Anda tidak memiliki izin tersebut');
            return { ok: true, data: await getKelasReguler(db) };
        }

        if (action === 'kandidat') {
            if (!can(user, 'klinik.kelola_sesi')) throw new ForbiddenException( 'Anda tidak memiliki izin tersebut');
            const kelasList = (searchParams.get('kelas') || '')
                .split(',').map(k => k.trim()).filter(Boolean);
            const q = (searchParams.get('q') || '').trim();
            const result = await getKandidatSiswa(db, kelasList, q);
            return { ok: true, ...result };
        }

        const status = searchParams.get('status');

        
        let query = db.from('klinik_slots').select(`
            *,
            guru:users!guru_id (
                nip,
                nama
            ),
            klinik_peserta (
                id,
                siswa_id,
                nama_siswa,
                kelas,
                status,
                kehadiran,
                kehadiran_at,
                kehadiran_sumber
            ),
            klinik_laporan (*)
        `).order('tanggal', { ascending: false }).order('jam_mulai', { ascending: true });

        if (status) query = query.eq('status', status);

        // Guru biasa hanya melihat sesinya sendiri; pengelola klinik melihat
        // semuanya. Cakupan ini dulu ditentukan parameter `role` yang dikirim
        // browser — artinya siapa pun bisa menambahkan `?role=ADMIN` di URL dan
        // memanen seluruh sesi madrasah. Sekarang diputuskan dari identitas yang
        // sudah terverifikasi di server; parameter dari klien tidak dipakai lagi.
        const roles: string[] = Array.isArray(user?.roles) ? user.roles : [user?.role].filter(Boolean);
        const hasBroadAccess =
            user.roles?.includes('ADMIN') ||
            user.roles?.includes('BENDAHARA_KOMITE') ||
            user.role === 'ADMIN' ||
            roles.some((r: string) => ['KAMAD', 'KTU', 'SUPERVISOR', 'PENGAWAS_MADRASAH'].includes(r.toUpperCase())) ||
            can(user, 'klinik.kelola_sesi');
        if (!hasBroadAccess && user.roles?.includes('GURU')) {
            const guruRecord = await resolveUserRecord(db, user.auth_id || user.authId, user.nip);
            // Tanpa baris user yang cocok, jangan bocorkan apa pun.
            query = query.eq('guru_id', guruRecord?.id ?? -1);
        }

        const { data, error } = await query;
        if (error) throw error;

        // Identitas siswa pengaju utk pengajuan kelompok — dibutuhkan halaman
        // approval supaya reviewer tahu siapa yang mengajukan, bukan cuma gurunya.
        if (data && Array.isArray(data)) {
            const pengajuIds = [...new Set(
                data.filter((s: any) => s.initiator_type === 'SISWA' && s.initiator_siswa_id)
                    .map((s: any) => s.initiator_siswa_id)
            )];
            if (pengajuIds.length > 0) {
                const { data: pengajuRows } = await db
                    .from('users').select('id, nama').in('id', pengajuIds);
                const namaMap = new Map((pengajuRows || []).map((u: any) => [u.id, u.nama]));
                for (const slot of data as any[]) {
                    if (slot.initiator_type !== 'SISWA' || !slot.initiator_siswa_id) continue;
                    slot.initiator_nama = namaMap.get(slot.initiator_siswa_id) || null;
                    // Kelasnya sudah tersimpan di barisnya sendiri sbg peserta.
                    slot.initiator_kelas = (slot.klinik_peserta || [])
                        .find((p: any) => p.siswa_id === slot.initiator_siswa_id)?.kelas || null;
                }
            }
        }

        // Batch fetch class data for students without kelas (Bug 4 + Bug 7 fix)
        if (data && Array.isArray(data)) {
            const missingKelas: { peserta: any; siswa_id: number }[] = [];
            for (const slot of data) {
                if (slot.klinik_peserta && Array.isArray(slot.klinik_peserta)) {
                    for (const peserta of slot.klinik_peserta) {
                        if (!peserta.kelas && peserta.siswa_id) {
                            missingKelas.push({ peserta, siswa_id: peserta.siswa_id });
                        }
                    }
                }
            }

            if (missingKelas.length > 0) {
                const siswaIds = [...new Set(missingKelas.map(m => m.siswa_id))];

                // Tabel users TIDAK punya kolom nisn — NISN siswa tersimpan di
                // nip/username (lihat identitasSiswa & catatan di lib/api-auth.ts).
                const { data: userRecords } = await db
                    .from('users')
                    .select('id, nip, username')
                    .in('id', siswaIds);

                if (userRecords && userRecords.length > 0) {
                    const userMap = new Map(userRecords.map((u: any) => [u.id, u]));

                    // Lewat petaKelasReguler, bukan query siswa_kelas mentah: tanpa
                    // filter tahun ajaran + kelas reguler, peserta bisa tampil dengan
                    // rombel peminatan ("XI Biologi 2") atau kelas tahun lalu, dan
                    // tanpa paginasi hasilnya terpotong diam-diam di 1000 baris.
                    const kelasMap = await petaKelasReguler(
                        db, userRecords.map(identitasSiswa));

                    for (const { peserta, siswa_id } of missingKelas) {
                        const identitas = identitasSiswa(userMap.get(siswa_id));
                        if (identitas && kelasMap.has(identitas)) {
                            peserta.kelas = kelasMap.get(identitas);
                        }
                    }
                }
            }
        }

        // `now` = waktu dinding zona madrasah. UI memakainya untuk memutuskan
        // apakah tombol absensi tampil, supaya jam perangkat siswa yang meleset
        // (atau sengaja digeser) tidak menghasilkan tampilan yang berbeda dari
        // keputusan server saat absennya dikirim.
        return { ok: true, data, now: await getCurrentDateTimeInTz() };
    } catch (err: any) {
        // HttpException (termasuk Forbidden/Unauthorized) sudah membawa status
        // dan pesan yang memang ditulis untuk pengguna — diteruskan apa adanya.
        // Tanpa penjagaan ini setiap penolakan 400/403/409 di atas berubah jadi
        // 500 dengan pesan "Http Exception", karena itulah nilai `.message`
        // sebuah HttpException yang responsnya berupa objek.
        if (err instanceof HttpException) throw err;
        throw new HttpException({ ok: false, error: err.message }, 500);
    }
}

/**
 * POST /api/klinik
 * - Role GURU: Create new slot
 * - Role SISWA: Register for a slot
 */
export async function handlePost(req: any, action: string, payload: any, db: PrismaDbAdapter) {
    try {
        const user = req.user;
        if (!user) throw new UnauthorizedException('Unauthorized');

        
        
        

        if (action === 'create_slot') {
            // Guru/Admin (alur lama) ATAU Siswa (pengajuan kelompok baru)
            // Mengajukan = hak dasar yang melekat pada identitas: setiap guru
            // boleh membuka jadwal, setiap siswa boleh mengajukan. Bukan fungsi
            // khusus yang ditunjuk admin, jadi tetap cek role di sini.
            const isSiswaCreator = user.roles.includes('SISWA');
            if (!user.roles.includes('GURU') && !isAdminUser(user) && !isSiswaCreator) {
                throw new ForbiddenException('Hanya Guru atau Siswa yang dapat mengajukan jadwal klinik');
            }

            const salahJadwal = await validasiJadwal(payload);
            if (salahJadwal) throw new HttpException({ ok: false, error: salahJadwal }, 400);

            // Bug 9: Get actual user ID from auth session, not from body
            const userRecord = await resolveUserRecord(db, user.auth_id || user.authId, user.nip);
            if (!userRecord) throw new ForbiddenException('User tidak ditemukan');

            // Aturannya sengaja identik dengan `isPengajuanSiswa` di view.tsx
            // (SISWA yang bukan GURU). Kalau kedua sisi memakai rumus berbeda,
            // form kelompok yang dilihat siswa akan disimpan sbg sesi guru biasa.
            const pengajuanSiswa = isSiswaCreator && !user.roles.includes('GURU');

            // Anggota kelompok yang ditunjuk siswa pengaju (users.id), tanpa dirinya sendiri.
            const anggotaIds: number[] = [...new Set(
                (Array.isArray(payload.anggota) ? payload.anggota : [])
                    .map((v: any) => Number(v))
                    .filter((v: number) => Number.isFinite(v) && v !== userRecord.id)
            )] as number[];

            // Kelompok siswa: pengaju tidak mengisi kuota. Kuotanya diberi ruang
            // di atas jumlah anggota awal supaya siswa lain masih bisa "Gabung".
            // Guru/Admin tetap menentukan kuota sendiri.
            const maxSiswa = pengajuanSiswa
                ? Math.max(anggotaIds.length + 1, KUOTA_KELOMPOK_SISWA)
                : (Number(payload.max_siswa) || KUOTA_GURU_DEFAULT);

            if (pengajuanSiswa) {
                // Klinik kelompok wajib punya minimal 2 peserta (pengaju + teman),
                // sesuai syarat approval di PATCH approve_slot.
                if (anggotaIds.length < 1) {
                    throw new HttpException({ ok: false, error: 'Pilih minimal 1 teman kelompok' }, 400);
                }
                const salah = await validasiAnggotaSeangkatan(
                    db, identitasSiswa(userRecord), anggotaIds);
                if (salah) throw new HttpException({ ok: false, error: salah }, 400);
            } else {
                if (maxSiswa < PESERTA_MINIMAL) {
                    throw new HttpException({ ok: false, error: `Kuota peserta klinik minimal harus ${PESERTA_MINIMAL} siswa` }, 400);
                }
                if (anggotaIds.length > maxSiswa) {
                    throw new HttpException({
                        ok: false,
                        error: `Jumlah peserta terpilih (${anggotaIds.length}) tidak boleh melebihi kuota siswa (${maxSiswa})`,
                    }, 400);
                }
                // Peserta yang ditunjuk guru tidak melewati 'register' maupun
                // 'join_request', jadi tidak ada satu pun penjagaan yang otomatis
                // berlaku untuknya — semuanya ditegakkan di sini.
                const salahPeserta = await validasiPesertaTunjukan(
                    db, anggotaIds, payload.target_kelas);
                if (salahPeserta) throw new HttpException({ ok: false, error: salahPeserta }, 400);
            }

            let insertPayload: any = {
                mapel: payload.mapel,
                topik: payload.topik,
                tanggal: payload.tanggal,
                jam_mulai: payload.jam_mulai,
                jam_selesai: payload.jam_selesai,
                max_siswa: maxSiswa,
                status: 'pending',
                target_kelas: payload.target_kelas && payload.target_kelas.length > 0 ? payload.target_kelas : null
            };

            if (pengajuanSiswa) {
                // Siswa wajib pilih guru pengampu (dari daftar guru_mapel utk mapel tsb,
                // dikirim sbg NIP karena guru_mapel.guru_id menyimpan NIP, bukan users.id)
                if (!payload.guru_nip) {
                    throw new HttpException({ ok: false, error: 'Pilih guru pengampu terlebih dahulu' }, 400);
                }
                const { data: guruRecord } = await db.from('users')
                    .select('id, nama').eq('nip', payload.guru_nip).maybeSingle();
                if (!guruRecord) {
                    throw new HttpException({ ok: false, error: 'Guru pengampu tidak ditemukan' }, 400);
                }
                insertPayload = {
                    ...insertPayload,
                    guru_id: guruRecord.id,
                    nama_guru: guruRecord.nama,
                    initiator_type: 'SISWA',
                    initiator_siswa_id: userRecord.id,
                    // Guru pengampu ditunjuk oleh siswa, jadi dia harus menyatakan
                    // bersedia dulu sebelum pengajuan diteruskan ke reviewer.
                    status: 'pending_guru',
                };
            } else {
                insertPayload = { ...insertPayload, guru_id: userRecord.id, nama_guru: userRecord.nama, initiator_type: 'GURU' };
            }

            const { data, error } = await db.from('klinik_slots').insert([insertPayload]).select().single();
            if (error) throw error;

            // Siswa pengaju otomatis jadi peserta pertama, diikuti teman kelompok
            // atau siswa yang ditunjuk oleh Guru saat membuat slot.
            const identitas = identitasSiswa(userRecord);

            const anggotaRows = anggotaIds.length > 0
                ? (await db.from('users').select('id, nama, nip, username').in('id', anggotaIds)).data || []
                : [];

            const semuaIdentitas = [
                ...(pengajuanSiswa ? [identitas] : []),
                ...anggotaRows.map(identitasSiswa)
            ].filter(Boolean);
            const kelasMap = await petaKelasReguler(db, semuaIdentitas);

            const pesertaRows = [
                ...(pengajuanSiswa ? [{ siswa_id: userRecord.id, nama_siswa: userRecord.nama, kelas: kelasMap.get(identitas) }] : []),
                ...anggotaRows.map(a => ({
                    siswa_id: a.id,
                    nama_siswa: a.nama,
                    kelas: kelasMap.get(identitasSiswa(a)),
                })),
            ].map(p => ({
                slot_id: data.id,
                siswa_id: p.siswa_id,
                nama_siswa: p.nama_siswa,
                kelas: p.kelas || 'SISWA',
                // Pengaju kelompok mendaftarkan dirinya sendiri (boleh mundur),
                // sedangkan peserta yang DITUNJUK guru adalah penugasan — sama
                // seperti sesi bentukan admin, mereka tidak boleh mengundurkan
                // diri sendiri lewat cancel_registration.
                status: p.siswa_id === userRecord.id ? 'registered' : STATUS_DITUGASKAN,
            }));

            if (pesertaRows.length > 0) {
                const { error: pesertaErr } = await db.from('klinik_peserta').insert(pesertaRows);
                if (pesertaErr) {
                    // Slot tanpa peserta tidak berguna — batalkan, siapa pun
                    // pembuatnya. Dulu galat ini ditelan diam-diam untuk sesi
                    // guru: slotnya tersimpan kosong dan API tetap membalas
                    // sukses, jadi guru baru tahu saat absensi dibuka.
                    // Trigger notifikasi sudah menyala saat INSERT slot, jadi
                    // barisnya ikut dibuang supaya reviewer tidak mengklik
                    // notifikasi menuju slot mati.
                    await db.from('klinik_slots').delete().eq('id', data.id);
                    await db.from('notifications').delete()
                        .eq('source_table', 'klinik_slots').eq('source_id', String(data.id));
                    throw new Error(
                        (pengajuanSiswa ? 'Gagal menyimpan anggota kelompok: ' : 'Gagal menyimpan peserta: ')
                        + pesertaErr.message);
                }

                // Peserta tunjukan guru dikabari dari sini — mereka tidak pernah
                // menekan "Daftar" sendiri, jadi tanpa ini sesi muncul di jadwal
                // mereka tanpa pemberitahuan apa pun.
                if (!pengajuanSiswa) {
                    await kabariPesertaTunjukan(db, {
                        slotId: data.id,
                        siswaIds: anggotaRows.map((a: any) => a.id),
                        mapel: payload.mapel,
                        namaGuru: userRecord.nama,
                        tanggal: payload.tanggal,
                        jamMulai: payload.jam_mulai,
                    });
                }
            }

            return { ok: true, data };
        }

        if (action === 'create_slot_admin') {
            // Sesi yang DIBENTUK admin: menunjuk guru pengampu sekaligus
            // pesertanya. Sengaja tidak menumpang 'create_slot' — di sana admin
            // jatuh ke cabang "sesi guru" dan guru_id akan terisi dirinya
            // sendiri, padahal yang mengampu bisa guru lain.
            if (!can(user, 'klinik.kelola_sesi')) throw new ForbiddenException('Anda tidak memiliki izin membentuk sesi klinik');

            const salahJadwal = await validasiJadwal(payload);
            if (salahJadwal) throw new HttpException({ ok: false, error: salahJadwal }, 400);

            if (!payload.mapel || !String(payload.topik || '').trim()) {
                throw new HttpException({ ok: false, error: 'Mata pelajaran dan topik wajib diisi' }, 400);
            }

            const pembuat = await resolveUserRecord(db, user.auth_id || user.authId, user.nip);
            if (!pembuat) throw new ForbiddenException('User tidak ditemukan');

            // guru_mapel menyimpan NIP (bukan users.id), jadi form mengirim NIP.
            if (!payload.guru_nip) {
                throw new HttpException({ ok: false, error: 'Pilih guru pengampu terlebih dahulu' }, 400);
            }
            const { data: guruRecord } = await db.from('users')
                .select('id, nama').eq('nip', payload.guru_nip).maybeSingle();
            if (!guruRecord) {
                throw new HttpException({ ok: false, error: 'Guru pengampu tidak ditemukan' }, 400);
            }

            const pesertaIds: number[] = [...new Set(
                (Array.isArray(payload.anggota) ? payload.anggota : [])
                    .map((v: any) => Number(v))
                    .filter((v: number) => Number.isFinite(v))
            )] as number[];

            if (pesertaIds.length < PESERTA_MINIMAL) {
                throw new HttpException({
                    ok: false,
                    error: `Pilih minimal ${PESERTA_MINIMAL} siswa sebagai peserta sesi`,
                }, 400);
            }

            // TIDAK ada validasi seangkatan di sini — justru inti fiturnya:
            // admin boleh menggabung siswa lintas kelas dan lintas tingkat.
            // Yang tetap dijaga: setiap peserta harus punya akun `users`.
            const { count: jumlahAkun } = await db
                .from('users').select('id', { count: 'exact', head: true }).in('id', pesertaIds);
            if ((jumlahAkun || 0) !== pesertaIds.length) {
                throw new HttpException({ ok: false, error: 'Ada siswa terpilih yang datanya tidak ditemukan' }, 400);
            }

            // Kuota merangkap saklar keterbukaan: kuota = jumlah peserta ⇒ sesi
            // lahir 'full' dan tertutup dari pendaftaran umum; kuota lebih besar
            // ⇒ 'open', siswa lain masih boleh mendaftar lewat action 'register'.
            const maxSiswa = Math.max(Number(payload.max_siswa) || 0, pesertaIds.length, PESERTA_MINIMAL);

            const { data: slotBaru, error: slotErr } = await db.from('klinik_slots').insert([{
                guru_id: guruRecord.id,
                nama_guru: guruRecord.nama,
                mapel: payload.mapel,
                topik: payload.topik,
                tanggal: payload.tanggal,
                jam_mulai: payload.jam_mulai,
                jam_selesai: payload.jam_selesai,
                max_siswa: maxSiswa,
                // Tidak lewat approval: pembentuknya sudah reviewer terakhir.
                status: pesertaIds.length >= maxSiswa ? 'full' : 'open',
                initiator_type: 'ADMIN',
                dibuat_oleh: pembuat.id,
                // target_kelas SENGAJA dikosongkan: filter itu menolak pendaftar
                // di luar tingkat tsb (salahTargetKelas), padahal sesi ini justru
                // dibentuk untuk menggabung siswa lintas tingkat.
                target_kelas: null,
            }]).select().single();
            if (slotErr) throw slotErr;

            const pesertaRows = await bangunBarisPeserta(
                db, slotBaru.id, pesertaIds, STATUS_DITUGASKAN);
            const { error: pesertaErr } = await db.from('klinik_peserta').insert(pesertaRows);
            if (pesertaErr) {
                // Sesi tanpa peserta tidak berguna. Trigger notifikasi sudah
                // menyala saat INSERT slot, jadi barisnya ikut dibuang supaya
                // guru tidak mengklik notifikasi menuju sesi yang sudah mati.
                await db.from('klinik_slots').delete().eq('id', slotBaru.id);
                await db.from('notifications').delete()
                    .eq('source_table', 'klinik_slots').eq('source_id', String(slotBaru.id));
                throw new Error('Gagal menyimpan peserta: ' + pesertaErr.message);
            }

            await kabariPesertaTunjukan(db, {
                slotId: slotBaru.id,
                siswaIds: pesertaIds,
                mapel: payload.mapel,
                namaGuru: guruRecord.nama,
                tanggal: payload.tanggal,
                jamMulai: payload.jam_mulai,
            });

            return { ok: true, data: slotBaru };
        }

        if (action === 'join_request') {
            // Siswa bergabung ke pengajuan kelompok siswa lain yang MASIH pending
            // (belum disetujui) — beda dari 'register' yang khusus slot 'open'.
            const { slot_id } = payload;
            if (!user.roles.includes('SISWA')) {
                throw new ForbiddenException('Hanya siswa yang dapat bergabung ke pengajuan kelompok');
            }
            const userRecord = await resolveUserRecord(db, user.authId, user.nip);
            if (!userRecord) throw new ForbiddenException('User tidak ditemukan');

            const { data: slot, error: slotErr } = await db
                .from('klinik_slots')
                .select('max_siswa, status, initiator_type, initiator_siswa_id, target_kelas')
                .eq('id', slot_id).single();
            if (slotErr || !slot) throw new Error('Pengajuan tidak ditemukan');
            if (slot.initiator_type !== 'SISWA' || !STATUS_PENGAJUAN.includes(slot.status)) {
                throw new Error('Pengajuan ini sudah tidak bisa dibergabungi (sudah diproses atau bukan pengajuan kelompok siswa)');
            }

            if (await hitungPeserta(db, slot_id) >= slot.max_siswa) {
                throw new Error('Kuota sudah penuh (Maksimal ' + slot.max_siswa + ' siswa)');
            }

            const identitas = identitasSiswa(userRecord);
            const { kelas: kelasSiswa, tingkat: tingkatPendaftar } = await tingkatSiswa(db, identitas);

            // Aturan "satu kelompok = satu angkatan" berlaku juga di sini. Tanpa
            // penjagaan ini, syarat seangkatan yang dipaksakan saat pengajuan
            // dibuat (validasiAnggotaSeangkatan) bisa dilangkahi lewat tombol Gabung.
            if (!tingkatPendaftar) {
                throw new Error('Kelas reguler Anda belum terdata, hubungi wali kelas');
            }
            const { data: pengajuRow } = await db.from('users')
                .select('id, nip, username').eq('id', slot.initiator_siswa_id).maybeSingle();
            const { tingkat: tingkatPengaju } = await tingkatSiswa(db, identitasSiswa(pengajuRow));
            if (tingkatPengaju && tingkatPengaju !== tingkatPendaftar) {
                throw new Error(`Pengajuan ini khusus angkatan kelas ${tingkatPengaju}`);
            }

            const salahTarget = salahTargetKelas(slot.target_kelas, kelasSiswa);
            if (salahTarget) throw new HttpException({ ok: false, error: salahTarget }, 400);

            const { data, error } = await db.from('klinik_peserta').insert([{
                slot_id,
                siswa_id: userRecord.id,
                nama_siswa: userRecord.nama,
                kelas: kelasSiswa || 'SISWA',
                status: 'registered'
            }]).select().single();
            if (error) {
                if (error.code === '23505') throw new Error('Anda sudah bergabung di pengajuan ini');
                throw new Error('Gagal bergabung: ' + error.message);
            }

            // Mitigasi race condition: periksa urutan baris antrean seperti di action 'register'
            const { data: antrean } = await db
                .from('klinik_peserta')
                .select('id')
                .eq('slot_id', slot_id)
                .order('created_at', { ascending: true })
                .order('id', { ascending: true });

            const urutanSaya = (antrean || []).findIndex((p: any) => p.id === data.id);
            if (urutanSaya >= slot.max_siswa) {
                await db.from('klinik_peserta').delete().eq('id', data.id);
                throw new Error('Kuota sudah penuh (Maksimal ' + slot.max_siswa + ' siswa)');
            }

            return { ok: true, data };
        }

        if (action === 'register') {
            // Identitas peserta TIDAK boleh datang dari body: sebelumnya siapa pun
            // yang login bisa mendaftarkan siswa lain (dan menghabiskan kuotanya).
            // Hanya admin / guru pengampu slot yang boleh mendaftarkan orang lain.
            const callerRecord = await resolveUserRecord(db, user.authId, user.nip);
            if (!callerRecord) throw new ForbiddenException('User tidak ditemukan');

            const { slot_id } = payload;

            // 1. Get slot info
            const { data: slot, error: slotErr } = await db
                .from('klinik_slots')
                .select('max_siswa, status, target_kelas, guru_id')
                .eq('id', slot_id)
                .single();

            if (slotErr || !slot) throw new Error('Slot tidak ditemukan');
            if (slot.status !== 'open') throw new Error('Slot tidak tersedia untuk pendaftaran (Status: ' + slot.status + ')');

            const mendaftarkanOrangLain =
                payload.siswa_id != null && Number(payload.siswa_id) !== callerRecord.id;
            if (mendaftarkanOrangLain && !isAdminUser(user) && slot.guru_id !== callerRecord.id) {
                throw new ForbiddenException('Anda hanya dapat mendaftarkan diri sendiri');
            }
            if (!mendaftarkanOrangLain && !user.roles.includes('SISWA')) {
                throw new ForbiddenException('Hanya siswa yang dapat mendaftar klinik');
            }

            let siswa_id = callerRecord.id;
            let nama_siswa = callerRecord.nama;
            let pesertaRecord: any = callerRecord;
            if (mendaftarkanOrangLain) {
                const { data: target } = await db.from('users')
                    .select('id, nama, nip, username').eq('id', Number(payload.siswa_id)).maybeSingle();
                if (!target) throw new Error('Siswa yang didaftarkan tidak ditemukan');
                siswa_id = target.id;
                nama_siswa = target.nama;
                pesertaRecord = target;
            }

            // 2. Count current participants accurately
            const currentCount = await hitungPeserta(db, slot_id);
            if (currentCount >= slot.max_siswa) {
                await db.from('klinik_slots').update({ status: 'full' }).eq('id', slot_id);
                throw new Error('Kuota sudah penuh (Maksimal ' + slot.max_siswa + ' siswa)');
            }

            // 3. Kelas selalu diturunkan di server dari enrolment reguler tahun
            //    berjalan — nilai `kelas` kiriman klien bisa basi/rombel peminatan.
            const finalKelas = (await tingkatSiswa(db, identitasSiswa(pesertaRecord))).kelas;

            const salahTarget = salahTargetKelas(slot.target_kelas, finalKelas);
            if (salahTarget) throw new HttpException({ ok: false, error: salahTarget }, 400);

            // 4. Perform registration
            const { data, error } = await db.from('klinik_peserta').insert([
                {
                    slot_id,
                    siswa_id,
                    nama_siswa,
                    kelas: finalKelas || 'SISWA',
                    status: 'registered'
                }
            ]).select().single();

            if (error) {
                console.error('DB Insert Error:', error);
                if (error.code === '23505') throw new Error('Anda sudah terdaftar di klinik ini');
                throw new Error('Gagal menyimpan pendaftaran: ' + error.message);
            }

            // Bug 3: mitigasi race condition. Membandingkan TOTAL peserta dgn kuota
            // membuat dua pendaftar bersamaan sama-sama menyimpulkan "saya yang
            // kelebihan" lalu dua-duanya mundur — slot berakhir kurang satu peserta
            // sekaligus terkunci 'full'. Yang dipakai sekarang: urutan baris.
            // Semua request melihat urutan yang sama, jadi tepat satu yang mundur.
            const { data: antrean } = await db
                .from('klinik_peserta')
                .select('id')
                .eq('slot_id', slot_id)
                .order('created_at', { ascending: true })
                .order('id', { ascending: true });

            const urutanSaya = (antrean || []).findIndex((p: any) => p.id === data.id);
            const totalPeserta = (antrean || []).length;

            if (urutanSaya >= slot.max_siswa) {
                await db.from('klinik_peserta').delete().eq('id', data.id);
                await db.from('klinik_slots').update({ status: 'full' }).eq('id', slot_id);
                throw new Error('Kuota sudah penuh (Maksimal ' + slot.max_siswa + ' siswa)');
            }

            // 5. Update slot status to 'full' if reached limit
            if (totalPeserta >= slot.max_siswa) {
                await db.from('klinik_slots').update({ status: 'full' }).eq('id', slot_id);
            }

            return { ok: true, data };
        }

        if (action === 'cancel_registration') {
            const { slot_id, siswa_id } = payload;

            // Sebelumnya endpoint ini sama sekali tanpa penjagaan: cukup kirim
            // slot_id + siswa_id dan siapa pun yang login bisa mengeluarkan peserta
            // mana pun dari sesi mana pun. Sekarang: diri sendiri, guru pengampu,
            // atau admin.
            const callerRecord = await resolveUserRecord(db, user.authId, user.nip);
            if (!callerRecord) throw new ForbiddenException('User tidak ditemukan');

            const { data: slot } = await db.from('klinik_slots')
                .select('max_siswa, status, guru_id, initiator_type, initiator_siswa_id').eq('id', slot_id).maybeSingle();
            if (!slot) throw new Error('Jadwal tidak ditemukan');

            const targetId = Number(siswa_id);

            // Siswa pengaju kelompok adalah penanggung jawab pengajuan — mereka
            // tidak boleh keluar dari kelompoknya sendiri. Jika ingin membatalkan,
            // mereka harus membatalkan/menghapus jadwalnya via delete_slot.
            if (slot.initiator_type === 'SISWA' && slot.initiator_siswa_id === targetId) {
                throw new ForbiddenException('Pengaju kelompok tidak dapat keluar dari sesi. Batalkan atau hapus pengajuan jadwal bila tidak jadi dilaksanakan.');
            }

            const pengelolaSesi = can(user, 'klinik.kelola_sesi') || slot.guru_id === callerRecord.id;
            const bolehBatal = pengelolaSesi || targetId === callerRecord.id;
            if (!bolehBatal) {
                throw new ForbiddenException('Anda hanya dapat membatalkan pendaftaran Anda sendiri');
            }

            const { data: pesertaRow } = await db.from('klinik_peserta')
                .select('status, kehadiran').eq('slot_id', slot_id).eq('siswa_id', targetId).maybeSingle();

            // Penugasan bukan pendaftaran sukarela: yang DITUNJUK pembentuk sesi
            // tidak boleh mengundurkan diri. Yang mendaftar sendiri ke sesi yang
            // sama (kalau kuotanya longgar) tetap boleh membatalkan.
            if (pesertaRow?.status === STATUS_DITUGASKAN && !pengelolaSesi) {
                throw new ForbiddenException('Anda ditugaskan mengikuti sesi ini — hubungi guru pengampu bila berhalangan');
            }

            // Kehadiran menempel pada baris peserta; menghapus barisnya berarti
            // menghapus catatan absensinya. Kalau memang keliru, guru pengampu
            // dapat mengosongkan kehadirannya dulu lewat absensi, baru dikeluarkan.
            if (pesertaRow?.kehadiran) {
                throw new HttpException({
                    ok: false,
                    error: 'Kehadiran peserta ini sudah tercatat. Kosongkan dulu absensinya bila memang keliru.',
                }, 409);
            }

            // Sesi yang laporannya sudah masuk tidak boleh berubah daftar pesertanya:
            // laporan & rekap yang sudah dicetak/disahkan akan ikut berubah isi.
            if (slot.status === 'paid' || (slot.status === 'finished' && !isAdminUser(user))) {
                throw new HttpException({
                    ok: false,
                    error: 'Sesi ini sudah dilaporkan, daftar peserta tidak dapat diubah lagi',
                }, 409);
            }

            // 1. Delete the registration
            const { error: deleteErr } = await db
                .from('klinik_peserta')
                .delete()
                .eq('slot_id', slot_id)
                .eq('siswa_id', targetId);

            if (deleteErr) throw deleteErr;

            // 2. Check current count to see if we should reopen the slot
            const count = await hitungPeserta(db, slot_id);
            if (count < slot.max_siswa && slot.status === 'full') {
                await db.from('klinik_slots').update({ status: 'open' }).eq('id', slot_id);
            }

            return { ok: true };
        }

        if (action === 'update_slot') {
            const { slot_id, payload: updateData } = payload;
            const userRecord = await resolveUserRecord(db, user.authId, user.nip);
            if (!userRecord) throw new ForbiddenException('User tidak ditemukan');

            const { data: slot } = await db.from('klinik_slots').select('*').eq('id', slot_id).single();
            if (!slot) throw new Error('Jadwal tidak ditemukan');

            // Sesi bentukan admin lahir langsung 'open'. Kalau gerbangnya tetap
            // "hanya pengajuan yang belum diputuskan", sesi jenis itu tidak akan
            // pernah bisa disunting sama sekali — pesertanya pun tidak. Karena
            // itu pengelola boleh menyunting sesi yang masih berjalan; setelah
            // dilaporkan (finished/paid) tetap terkunci untuk semua orang.
            const pengelola = can(user, 'klinik.kelola_sesi');
            const bolehEditStatus = STATUS_PENGAJUAN.includes(slot.status)
                || (pengelola && STATUS_BERJALAN.includes(slot.status));
            if (!bolehEditStatus) {
                throw new Error('Sesi ini sudah tidak dapat diedit');
            }

            const isCreator = (slot.guru_id === userRecord.id) || (slot.initiator_type === 'SISWA' && slot.initiator_siswa_id === userRecord.id);
            if (!pengelola && !isCreator) {
                throw new ForbiddenException('Anda tidak memiliki akses untuk mengedit jadwal ini');
            }

            // Validasi yang sama dgn create_slot. Tanpa ini jadwal yang sudah lolos
            // saat dibuat bisa disunting mundur ke tanggal lampau atau jam terbalik.
            const salahJadwal = await validasiJadwal(updateData);
            if (salahJadwal) throw new HttpException({ ok: false, error: salahJadwal }, 400);

            // Pengajuan kelompok siswa: daftar anggota ikut disunting dari modal,
            // jadi peserta disinkronkan (tambah yang baru, buang yang dicabut).
            // Pengaju sendiri selalu jadi peserta dan tidak bisa dikeluarkan.
            const kelompokSiswa = slot.initiator_type === 'SISWA' && Array.isArray(updateData.anggota);
            // Sesi bentukan admin juga menyunting daftar pesertanya dari modal,
            // tapi tanpa syarat seangkatan dan tanpa "pengaju" yang wajib ikut.
            const sesiAdmin = slot.initiator_type === 'ADMIN' && Array.isArray(updateData.anggota);
            // Sesi yang dibuka guru kini juga boleh menunjuk peserta langsung.
            // Sebelumnya `anggota` yang dikirim modal dibuang diam-diam di sini:
            // guru mencabut/menambah peserta, API membalas sukses, dan daftarnya
            // tidak berubah sama sekali. Slot lama bisa punya initiator_type
            // kosong, jadi semua yang bukan SISWA/ADMIN diperlakukan sebagai guru.
            const sesiGuru = !sesiAdmin && slot.initiator_type !== 'SISWA' && Array.isArray(updateData.anggota);
            // `|| KUOTA_GURU_DEFAULT` dulu diam-diam mereset kuota ke 5 ketika field
            // tidak dikirim (mis. admin mengedit sesi kelompok) — pertahankan nilai lama.
            let maxSiswa = Number(updateData.max_siswa) || slot.max_siswa || KUOTA_GURU_DEFAULT;
            let anggotaIds: number[] = [];

            if (sesiAdmin) {
                anggotaIds = [...new Set(
                    updateData.anggota
                        .map((v: any) => Number(v))
                        .filter((v: number) => Number.isFinite(v))
                )] as number[];
                if (anggotaIds.length < PESERTA_MINIMAL) {
                    throw new HttpException({
                        ok: false,
                        error: `Sesi harus memiliki minimal ${PESERTA_MINIMAL} peserta`,
                    }, 400);
                }
                const { count: jumlahAkun } = await db
                    .from('users').select('id', { count: 'exact', head: true }).in('id', anggotaIds);
                if ((jumlahAkun || 0) !== anggotaIds.length) {
                    throw new HttpException({ ok: false, error: 'Ada siswa terpilih yang datanya tidak ditemukan' }, 400);
                }
                maxSiswa = Math.max(Number(updateData.max_siswa) || 0, anggotaIds.length, PESERTA_MINIMAL);
            } else if (kelompokSiswa) {
                anggotaIds = [...new Set(
                    updateData.anggota
                        .map((v: any) => Number(v))
                        .filter((v: number) => Number.isFinite(v) && v !== slot.initiator_siswa_id)
                )] as number[];
                if (anggotaIds.length < 1) {
                    throw new HttpException({ ok: false, error: 'Pilih minimal 1 teman kelompok' }, 400);
                }

                const { data: pengajuRow } = await db.from('users')
                    .select('id, nip, username').eq('id', slot.initiator_siswa_id).maybeSingle();
                if (!pengajuRow) {
                    // Tanpa penjagaan ini identitas pengaju jadi string kosong dan
                    // validasi seangkatan lolos/gagal dgn pesan yang menyesatkan.
                    throw new HttpException({ ok: false, error: 'Data siswa pengaju tidak ditemukan' }, 400);
                }
                const salah = await validasiAnggotaSeangkatan(
                    db, identitasSiswa(pengajuRow), anggotaIds);
                if (salah) throw new HttpException({ ok: false, error: salah }, 400);

                maxSiswa = Math.max(anggotaIds.length + 1, KUOTA_KELOMPOK_SISWA);
            } else {
                if (maxSiswa < PESERTA_MINIMAL) {
                    throw new HttpException({ ok: false, error: `Kuota peserta klinik minimal harus ${PESERTA_MINIMAL} siswa` }, 400);
                }
                // Kuota tidak boleh diturunkan di bawah peserta yang terlanjur terdaftar.
                const terdaftar = await hitungPeserta(db, slot_id);
                if (maxSiswa < terdaftar) {
                    throw new HttpException({
                        ok: false,
                        error: `Kuota tidak boleh kurang dari jumlah peserta yang sudah terdaftar (${terdaftar} siswa)`,
                    }, 400);
                }

                if (sesiGuru) {
                    anggotaIds = [...new Set(
                        updateData.anggota
                            .map((v: any) => Number(v))
                            .filter((v: number) => Number.isFinite(v))
                    )] as number[];
                    if (anggotaIds.length > maxSiswa) {
                        throw new HttpException({
                            ok: false,
                            error: `Jumlah peserta terpilih (${anggotaIds.length}) tidak boleh melebihi kuota siswa (${maxSiswa})`,
                        }, 400);
                    }
                    const salahPeserta = await validasiPesertaTunjukan(
                        db, anggotaIds, updateData.target_kelas);
                    if (salahPeserta) throw new HttpException({ ok: false, error: salahPeserta }, 400);
                }
            }

            const slotPatch: any = {
                mapel: updateData.mapel,
                topik: updateData.topik,
                tanggal: updateData.tanggal,
                jam_mulai: updateData.jam_mulai,
                jam_selesai: updateData.jam_selesai,
                max_siswa: maxSiswa,
                target_kelas: updateData.target_kelas && updateData.target_kelas.length > 0 ? updateData.target_kelas : null
            };

            // Siswa boleh mengganti guru pengampu selagi pengajuannya masih pending;
            // admin boleh mengganti pengampu sesi bentukannya kapan pun sebelum
            // sesi itu dilaporkan.
            if ((kelompokSiswa || sesiAdmin) && updateData.guru_nip) {
                const { data: guruRecord } = await db.from('users')
                    .select('id, nama').eq('nip', updateData.guru_nip).maybeSingle();
                if (!guruRecord) {
                    throw new HttpException({ ok: false, error: 'Guru pengampu tidak ditemukan' }, 400);
                }
                slotPatch.guru_id = guruRecord.id;
                slotPatch.nama_guru = guruRecord.nama;

                // Kesediaan melekat pada GURU tertentu, bukan pada pengajuannya.
                // Kalau gurunya diganti setelah guru lama menyatakan bersedia,
                // pengajuan harus turun lagi ke tahap kesediaan — kalau tidak,
                // reviewer bisa menyetujui sesi yang mengikat guru yang belum
                // pernah setuju. Trigger notifikasi mengirim undangan ke guru baru.
                // Tidak berlaku untuk sesi bentukan admin: di sana penugasan guru
                // memang keputusan madrasah, bukan permintaan yang perlu disetujui.
                if (kelompokSiswa && guruRecord.id !== slot.guru_id) {
                    slotPatch.status = 'pending_guru';
                    slotPatch.catatan_penolakan = null;
                }
            }

            const { error } = await db.from('klinik_slots').update(slotPatch).eq('id', slot_id);

            if (error) throw error;

            if (kelompokSiswa || sesiAdmin || sesiGuru) {
                // Pengaju kelompok siswa selalu ikut dan tidak bisa dikeluarkan.
                // Sesi bentukan admin tidak punya pengaju — daftarnya apa adanya.
                const idsFinal = new Set<number>(
                    kelompokSiswa ? [...anggotaIds, slot.initiator_siswa_id] : anggotaIds);
                const { data: semuaPeserta } = await db
                    .from('klinik_peserta').select('id, siswa_id, nama_siswa, kehadiran, status').eq('slot_id', slot_id);

                // Sesi guru tetap terbuka untuk pendaftaran umum, jadi yang
                // disinkronkan HANYA baris penugasan. Kalau seluruh peserta ikut
                // dibandingkan, siswa yang menekan "Daftar" setelah modal dibuka
                // akan terhapus diam-diam saat guru menyimpan.
                const pesertaLama = sesiGuru
                    ? (semuaPeserta || []).filter((p: any) => p.status === STATUS_DITUGASKAN)
                    : (semuaPeserta || []);

                // Yang dibandingkan untuk "sudah ada" tetap SELURUH peserta:
                // menunjuk siswa yang sudah mendaftar sendiri tidak boleh
                // menghasilkan baris kedua (slot_id+siswa_id unik).
                const idsLama = new Set((semuaPeserta || []).map((p: any) => p.siswa_id));
                const dibuang = pesertaLama.filter((p: any) => !idsFinal.has(p.siswa_id));
                const ditambah = [...idsFinal].filter(id => !idsLama.has(id));

                // Kehadiran menempel pada baris peserta, jadi membuang peserta yang
                // sudah diabsen berarti menghapus catatan kehadirannya diam-diam.
                const sudahDiabsen = dibuang.filter((p: any) => p.kehadiran);
                if (sudahDiabsen.length > 0) {
                    throw new HttpException({
                        ok: false,
                        error: 'Peserta yang kehadirannya sudah tercatat tidak dapat dikeluarkan: '
                            + sudahDiabsen.map((p: any) => p.nama_siswa).join(', '),
                    }, 409);
                }

                if (dibuang.length > 0) {
                    await db.from('klinik_peserta').delete().in('id', dibuang.map((p: any) => p.id));
                }
                if (ditambah.length > 0) {
                    // Sesi admin & sesi guru sama-sama MENUNJUK pesertanya, jadi
                    // barisnya berstatus penugasan (tidak boleh mundur sendiri).
                    // Hanya anggota kelompok siswa yang berstatus pendaftaran.
                    const { error: insErr } = await db.from('klinik_peserta').insert(
                        await bangunBarisPeserta(
                            db, slot_id, ditambah,
                            kelompokSiswa ? 'registered' : STATUS_DITUGASKAN));
                    if (insErr) throw new Error('Gagal menyimpan peserta: ' + insErr.message);
                }

                // Sesi admin sudah berjalan, jadi kuota vs jumlah peserta menentukan
                // apakah sesi masih terbuka untuk pendaftar lain. Pengajuan kelompok
                // siswa belum punya status open/full — dilewati.
                if (sesiAdmin && STATUS_BERJALAN.includes(slot.status)) {
                    await db.from('klinik_slots')
                        .update({ status: idsFinal.size >= maxSiswa ? 'full' : 'open' })
                        .eq('id', slot_id);
                }
            }

            return { ok: true };
        }

        if (action === 'delete_slot') {
            const { slot_id } = payload;
            const userRecord = await resolveUserRecord(db, user.authId, user.nip);
            if (!userRecord) throw new ForbiddenException('User tidak ditemukan');

            const { data: slot } = await db.from('klinik_slots').select('*').eq('id', slot_id).single();
            if (!slot) throw new Error('Jadwal tidak ditemukan');

            const isCreator = (slot.guru_id === userRecord.id) || (slot.initiator_type === 'SISWA' && slot.initiator_siswa_id === userRecord.id);
            const canDelete = can(user, 'klinik.kelola_sesi') || (isCreator && STATUS_PENGAJUAN.includes(slot.status));

            if (!canDelete) {
                throw new ForbiddenException('Anda tidak memiliki akses untuk menghapus jadwal ini');
            }

            const { error } = await db.from('klinik_slots').delete().eq('id', slot_id);
            if (error) throw error;
            return { ok: true };
        }

        throw new HttpException({ ok: false, error: 'Invalid action' }, 400);
    } catch (err: any) {
        // HttpException (termasuk Forbidden/Unauthorized) sudah membawa status
        // dan pesan yang memang ditulis untuk pengguna — diteruskan apa adanya.
        // Tanpa penjagaan ini setiap penolakan 400/403/409 di atas berubah jadi
        // 500 dengan pesan "Http Exception", karena itulah nilai `.message`
        // sebuah HttpException yang responsnya berupa objek.
        if (err instanceof HttpException) throw err;
        throw new HttpException({ ok: false, error: err.message }, 500);
    }
}

/**
 * PATCH /api/klinik
 * - Role ADMIN: Approve/Reject slot
 * - Role GURU: Update report / upload documentation
 */
export async function handlePatch(req: any, action: string, id: any, payload: any, db: PrismaDbAdapter) {
    try {
        const user = req.user;
        if (!user) throw new UnauthorizedException('Unauthorized');

        
        
        

        if (action === 'approve_guru') {
            // Gerbang PERTAMA pengajuan kelompok siswa: guru pengampu yang ditunjuk
            // siswa menyatakan bersedia atau menolak. Baru setelah bersedia,
            // pengajuan diteruskan ke pemegang izin approve_slot (status
            // 'pending_guru' -> 'pending').
            const { guruAction, catatan } = payload; // 'terima' | 'tolak'
            if (!['terima', 'tolak'].includes(guruAction)) {
                throw new HttpException({ ok: false, error: 'guruAction (terima|tolak) wajib diisi' }, 400);
            }
            if (guruAction === 'tolak' && !catatan?.trim()) {
                throw new HttpException({ ok: false, error: 'Alasan wajib diisi saat menolak pengajuan' }, 400);
            }

            const { data: slot } = await db.from('klinik_slots')
                .select('id, guru_id, status').eq('id', id).maybeSingle();
            if (!slot) {
                throw new HttpException({ ok: false, error: 'Pengajuan tidak ditemukan' }, 404);
            }
            if (slot.status !== 'pending_guru') {
                throw new HttpException({ ok: false, error: 'Pengajuan ini sudah diproses' }, 409);
            }

            // Hanya guru pengampu yang ditunjuk. Admin diizinkan sbg jalan keluar
            // manual kalau gurunya berhalangan lama, bukan sebagai alur normal.
            const callerRecord = await resolveUserRecord(db, user.authId, user.nip);
            if (!isAdminUser(user) && (!callerRecord || slot.guru_id !== callerRecord.id)) {
                throw new ForbiddenException('Hanya guru pengampu yang ditunjuk yang dapat memproses pengajuan ini');
            }

            const { data, error } = await db.from('klinik_slots').update({
                status: guruAction === 'terima' ? 'pending' : 'cancelled',
                catatan_penolakan: guruAction === 'tolak' ? catatan.trim() : null,
            }).eq('id', id).select().single();
            if (error) throw error;
            return { ok: true, data };
        }

        if (action === 'approve_slot') {
            // Bug 6: hanya pemegang izin approval yang boleh menyetujui/menolak slot
            if (!can(user, 'klinik.approve_slot')) throw new ForbiddenException('Anda tidak memiliki izin menyetujui/menolak sesi klinik');
            // Status wajib dari daftar putih: field ini dulu ditulis apa adanya,
            // sehingga reviewer bisa mengirim status 'paid' dan melompati gerbang
            // Bendahara Komite di mark_paid.
            if (!['open', 'cancelled'].includes(payload.status)) {
                throw new HttpException({ ok: false, error: 'Status hanya boleh open atau cancelled' }, 400);
            }
            const { data: checkSlot, error: checkError } = await db.from('klinik_slots')
                .select('id, status, initiator_type, klinik_peserta(id)')
                .eq('id', id)
                .single();

            if (checkError || !checkSlot) {
                throw new HttpException({ ok: false, error: 'Slot klinik tidak ditemukan' }, 404);
            }

            // Pengajuan kelompok siswa yang gurunya belum menyatakan bersedia belum
            // boleh diputuskan reviewer — guru yang ditunjuk bisa saja berhalangan,
            // dan menyetujuinya lebih dulu berarti mengikat guru tanpa persetujuannya.
            if (checkSlot.status === 'pending_guru') {
                throw new HttpException({
                    ok: false,
                    error: 'Pengajuan ini masih menunggu kesediaan guru pengampu',
                }, 409);
            }

            // Syarat peserta minimal HANYA berlaku untuk pengajuan kelompok siswa,
            // yang memang lahir bersama pesertanya. Sesi yang dibuka guru selalu
            // kosong saat diajukan — siswa baru bisa mendaftar SETELAH statusnya
            // 'open' (lihat action 'register'), jadi memberlakukan syarat yang sama
            // di sini membuat sesi guru mustahil disetujui sekaligus mustahil diisi.
            // Kecukupan pesertanya dijaga belakangan, saat laporan diajukan.
            if (payload.status === 'open'
                && checkSlot.initiator_type === 'SISWA'
                && (checkSlot.klinik_peserta || []).length < PESERTA_MINIMAL) {
                throw new HttpException({ ok: false, error: `Pengajuan kelompok minimal harus memiliki ${PESERTA_MINIMAL} peserta untuk dapat disetujui.` }, 400);
            }
            
            const { data, error } = await db.from('klinik_slots')
                .update({
                    status: payload.status, // 'open' or 'cancelled'
                    // Alasan penolakan reviewer, supaya pengaju tahu duduk perkaranya.
                    catatan_penolakan: payload.status === 'cancelled'
                        ? (payload.catatan?.trim() || null)
                        : null,
                })
                .eq('id', id)
                .select().single();
            if (error) throw error;
            return { ok: true, data };
        }

        if (action === 'update_report') {
            const { slot_id, materi, fotos, finalized } = payload;

            // Kepemilikan: hanya guru pengampu slot tsb atau admin yang boleh isi laporan
            const { data: slotOwner } = await db.from('klinik_slots')
                .select('guru_id, status').eq('id', slot_id).single();
            const callerRecord = await resolveUserRecord(db, user.authId, user.nip);
            if (!isAdminUser(user) && (!callerRecord || slotOwner?.guru_id !== callerRecord.id)) {
                throw new ForbiddenException('Hanya guru pengampu sesi ini yang dapat mengisi laporan');
            }
            if (slotOwner?.status === 'paid') {
                throw new HttpException({
                    ok: false,
                    error: 'Sesi ini sudah ditandai lunas, laporannya tidak dapat diubah lagi',
                }, 409);
            }

            // Gerbang peserta minimal dipindahkan ke sini dari approve_slot. Sesi guru
            // disetujui dalam keadaan kosong, jadi kecukupan peserta baru bisa dinilai
            // saat laporan masuk. Sesi yang tidak pernah mencapai PESERTA_MINIMAL
            // dianggap batal dilaksanakan: laporannya ditolak supaya tidak ikut
            // terhitung sebagai honor di halaman Pembayaran.
            const jumlahPeserta = await hitungPeserta(db, slot_id);
            if (jumlahPeserta < PESERTA_MINIMAL) {
                throw new HttpException({
                    ok: false,
                    error: `Klinik batal dilaksanakan: peserta hanya ${jumlahPeserta} orang, minimal ${PESERTA_MINIMAL} siswa. Laporan tidak dapat diajukan.`,
                }, 409);
            }
            // Penulis laporan diambil dari pemilik slot, bukan dari body.
            const guru_id = slotOwner?.guru_id ?? callerRecord?.id ?? null;

            // 1. Check if report already exists
            const { data: existing } = await db
                .from('klinik_laporan')
                .select('id')
                .eq('slot_id', slot_id)
                .maybeSingle();

            const reportPayload: any = {
                guru_id,
                materi_disampaikan: materi,
                foto_bukti: fotos,
                is_finalized: finalized,
            };
            if (finalized) {
                // Finalisasi baru = ajuan baru bagi reviewer, reset jejak approval lama
                reportPayload.status = 'Submitted';
                reportPayload.approved_by = null;
                reportPayload.approved_by_name = null;
                reportPayload.approved_at = null;
                reportPayload.catatan_reviewer = null;
            }

            let result;
            if (existing) {
                result = await db.from('klinik_laporan').update({
                    ...reportPayload,
                    updated_at: new Date().toISOString()
                }).eq('id', existing.id).select().single();
            } else {
                result = await db.from('klinik_laporan').insert([{ slot_id, ...reportPayload }]).select().single();
            }

            if (result.error) throw result.error;

            if (finalized) {
                await db.from('klinik_slots').update({ status: 'finished' }).eq('id', slot_id);
            }

            return { ok: true, data: result.data };
        }

        if (action === 'approve_laporan') {
            // Approval laporan klinik — izin terpisah dari approval sesi, jadi
            // seseorang bisa dipercaya memeriksa laporan tanpa ikut menyetujui sesi.
            if (!can(user, 'klinik.approve_laporan')) throw new ForbiddenException('Anda tidak memiliki izin menyetujui laporan klinik');
            const { laporanAction, catatan } = payload; // 'approve' | 'revisi'
            if (!['approve', 'revisi'].includes(laporanAction)) {
                throw new HttpException({ ok: false, error: 'laporanAction (approve|revisi) wajib diisi' }, 400);
            }
            if (laporanAction === 'revisi' && !catatan?.trim()) {
                throw new HttpException({ ok: false, error: 'Catatan wajib diisi saat mengembalikan laporan' }, 400);
            }

            const { data: laporanRow } = await db.from('klinik_laporan')
                .select('id, slot_id, status').eq('id', id).maybeSingle();
            if (!laporanRow) {
                throw new HttpException({ ok: false, error: 'Laporan tidak ditemukan' }, 404);
            }

            const { data: slotRow } = await db.from('klinik_slots')
                .select('id, status, max_siswa').eq('id', laporanRow.slot_id).maybeSingle();
            if (slotRow?.status === 'paid') {
                throw new HttpException({
                    ok: false,
                    error: 'Sesi ini sudah ditandai lunas, laporannya tidak dapat diproses ulang',
                }, 409);
            }

            const reviewerRecord = await resolveUserRecord(db, user.auth_id || user.authId, user.nip);

            const updatePayload: any = { catatan_reviewer: catatan || null };
            if (laporanAction === 'approve') {
                updatePayload.status = 'Approved';
                updatePayload.approved_by = reviewerRecord?.id || null;
                updatePayload.approved_by_name = reviewerRecord?.nama || 'Admin';
                updatePayload.approved_at = new Date().toISOString();
            } else {
                updatePayload.status = 'Revisi';
                updatePayload.is_finalized = false;
            }

            const { data, error } = await db.from('klinik_laporan')
                .update(updatePayload).eq('id', id).select().single();
            if (error) throw error;

            // Laporan dikembalikan => sesinya harus keluar dari status 'finished'.
            // Tombol "Isi Laporan" milik guru hanya muncul saat slot open/full, jadi
            // tanpa langkah ini laporan Revisi tidak akan pernah bisa diperbaiki dan
            // sesinya mentok selamanya (tidak pernah Approved, tidak pernah dibayar).
            if (laporanAction === 'revisi' && slotRow && slotRow.status === 'finished') {
                const terdaftar = await hitungPeserta(db, slotRow.id);
                await db.from('klinik_slots')
                    .update({ status: terdaftar >= slotRow.max_siswa ? 'full' : 'open' })
                    .eq('id', slotRow.id);
            }

            return { ok: true, data };
        }

        if (action === 'absen_mandiri') {
            // Siswa menyatakan kehadirannya sendiri. Identitasnya diambil dari
            // sesi login, TIDAK pernah dari body — kalau tidak, satu siswa bisa
            // mengabsenkan seluruh temannya.
            const slotId = payload.slot_id || id;
            const callerRecord = await resolveUserRecord(db, user.authId, user.nip);
            if (!callerRecord) throw new ForbiddenException('User tidak ditemukan');

            const { data: slot } = await db.from('klinik_slots')
                .select('id, status, tanggal, jam_mulai, jam_selesai').eq('id', slotId).maybeSingle();
            if (!slot) {
                throw new HttpException({ ok: false, error: 'Sesi tidak ditemukan' }, 404);
            }
            if (!STATUS_BERJALAN.includes(slot.status)) {
                throw new HttpException({
                    ok: false,
                    error: 'Absensi hanya dibuka untuk sesi yang sudah disetujui dan belum dilaporkan',
                }, 409);
            }

            const { data: peserta } = await db.from('klinik_peserta')
                .select('id, kehadiran, kehadiran_sumber, kehadiran_at')
                .eq('slot_id', slotId).eq('siswa_id', callerRecord.id).maybeSingle();
            if (!peserta) throw new ForbiddenException('Anda bukan peserta sesi ini');

            // Penilaian guru (mis. ditandai Sakit) tidak boleh ditimpa siswa.
            if (peserta.kehadiran && peserta.kehadiran_sumber === 'GURU') {
                throw new HttpException({
                    ok: false,
                    error: 'Kehadiran Anda sudah ditandai guru pengampu.',
                }, 409);
            }
            // Idempoten: tombol yang tertekan dua kali bukan kesalahan.
            if (peserta.kehadiran === 'H') {
                return { ok: true, data: peserta, sudah: true };
            }

            const { mulai, selesai } = jendelaAbsensi(slot);
            if (!mulai || !selesai) {
                throw new HttpException({ ok: false, error: 'Jadwal sesi ini tidak lengkap' }, 409);
            }
            const sekarang = await getCurrentDateTimeInTz();
            if (sekarang < mulai || sekarang > selesai) {
                const tgl = new Date(`${mulai.slice(0, 10)}T12:00:00`)
                    .toLocaleDateString('id-ID', { day: 'numeric', month: 'long' });
                throw new HttpException({
                    ok: false,
                    error: `Absensi sesi ini hanya dibuka ${tgl} pukul ${mulai.slice(11)}–${selesai.slice(11)}.`,
                }, 409);
            }

            const { data, error } = await db.from('klinik_peserta').update({
                kehadiran: 'H',
                kehadiran_at: new Date().toISOString(),
                kehadiran_sumber: 'MANDIRI',
                kehadiran_oleh: null,
            }).eq('id', peserta.id).select().single();
            if (error) throw error;
            return { ok: true, data };
        }

        if (action === 'absen_guru') {
            // Guru pengampu / pengelola menandai kehadiran peserta. Sekaligus
            // jaring pengaman untuk siswa yang hadir tapi lupa absen mandiri,
            // dan satu-satunya cara mencatat S/I/A.
            const slotId = payload.slot_id || id;
            const callerRecord = await resolveUserRecord(db, user.auth_id || user.authId, user.nip);

            const { data: slot } = await db.from('klinik_slots')
                .select('id, status, guru_id').eq('id', slotId).maybeSingle();
            if (!slot) {
                throw new HttpException({ ok: false, error: 'Sesi tidak ditemukan' }, 404);
            }
            if (!can(user, 'klinik.kelola_sesi') && (!callerRecord || slot.guru_id !== callerRecord.id)) {
                throw new ForbiddenException('Hanya guru pengampu sesi ini yang dapat mengisi absensi');
            }
            if (slot.status === 'paid' || slot.status === 'cancelled') {
                throw new HttpException({
                    ok: false,
                    error: 'Sesi ini sudah ditutup, absensinya tidak dapat diubah lagi',
                }, 409);
            }

            const masukan = (Array.isArray(payload.entries) ? payload.entries : [])
                .map((e: any) => ({
                    siswa_id: Number(e?.siswa_id),
                    // String kosong dari <select> diperlakukan sama dengan null:
                    // "belum diabsen", yang berbeda dari 'A' (alpa).
                    kehadiran: e?.kehadiran ? String(e.kehadiran).toUpperCase() : null,
                }))
                .filter((e: any) => Number.isFinite(e.siswa_id));

            if (masukan.some((e: any) => e.kehadiran && !KEHADIRAN_VALID.includes(e.kehadiran))) {
                throw new HttpException({
                    ok: false,
                    error: `Nilai kehadiran hanya boleh ${KEHADIRAN_VALID.join('/')} atau dikosongkan`,
                }, 400);
            }

            const { data: pesertaSlot } = await db.from('klinik_peserta')
                .select('siswa_id').eq('slot_id', slotId);
            const sah = new Set((pesertaSlot || []).map((p: any) => p.siswa_id));

            // Dikelompokkan per nilai supaya 30 peserta tetap 1–5 query, bukan 30.
            const perNilai = new Map<string, number[]>();
            for (const e of masukan) {
                if (!sah.has(e.siswa_id)) continue; // siswa_id asing diabaikan diam-diam
                const kunci = e.kehadiran || '';
                if (!perNilai.has(kunci)) perNilai.set(kunci, []);
                perNilai.get(kunci)!.push(e.siswa_id);
            }

            const waktu = new Date().toISOString();
            for (const [nilai, ids] of perNilai) {
                const { error } = await db.from('klinik_peserta').update({
                    kehadiran: nilai || null,
                    kehadiran_at: nilai ? waktu : null,
                    kehadiran_sumber: nilai ? 'GURU' : null,
                    kehadiran_oleh: nilai ? (callerRecord?.id ?? null) : null,
                }).eq('slot_id', slotId).in('siswa_id', ids);
                if (error) throw error;
            }

            return {
                ok: true,
                data: { diproses: [...perNilai.values()].reduce((n, ids) => n + ids.length, 0) },
            };
        }

        if (action === 'mark_paid') {
            // Dipusatkan ke halaman Pembayaran. Bendahara Komite = jabatan
            // sungguhan, jadi cek role di sini memang pada tempatnya.
            if (!isAdminUser(user) && !user.roles?.includes('BENDAHARA_KOMITE')) {
                throw new ForbiddenException('Hanya Bendahara Komite/Admin yang dapat menandai pembayaran');
            }
            const { data: laporan } = await db.from('klinik_laporan').select('status').eq('slot_id', id).maybeSingle();
            if (laporan?.status !== 'Approved') {
                throw new HttpException({ ok: false, error: 'Laporan sesi ini belum disetujui, belum bisa ditandai lunas.' }, 409);
            }
            const { data, error } = await db.from('klinik_slots')
                .update({ status: 'paid' })
                .eq('id', id)
                .select().single();
            if (error) throw error;
            return { ok: true, data };
        }

        if (action === 'unmark_paid') {
            if (!isAdminUser(user) && !user.roles?.includes('BENDAHARA_KOMITE')) {
                throw new ForbiddenException('Hanya Bendahara Komite/Admin yang dapat membatalkan pembayaran');
            }
            const { data, error } = await db.from('klinik_slots')
                .update({ status: 'finished' })
                .eq('id', id)
                .select().single();
            if (error) throw error;
            return { ok: true, data };
        }

        throw new HttpException({ ok: false, error: 'Invalid action' }, 400);
    } catch (err: any) {
        // HttpException (termasuk Forbidden/Unauthorized) sudah membawa status
        // dan pesan yang memang ditulis untuk pengguna — diteruskan apa adanya.
        // Tanpa penjagaan ini setiap penolakan 400/403/409 di atas berubah jadi
        // 500 dengan pesan "Http Exception", karena itulah nilai `.message`
        // sebuah HttpException yang responsnya berupa objek.
        if (err instanceof HttpException) throw err;
        throw new HttpException({ ok: false, error: err.message }, 500);
    }
}


@Injectable()
export class KlinikService {
  constructor(private prisma: PrismaService) {}
  
  async handleGet(req: any, action: string, searchParams: URLSearchParams) {
    return handleGet(req, action, searchParams, createPrismaDbAdapter(this.prisma));
  }

  async handlePost(req: any, action: string, payload: any) {
    return handlePost(req, action, payload, createPrismaDbAdapter(this.prisma));
  }

  async handlePatch(req: any, action: string, id: any, payload: any) {
    return handlePatch(req, action, id, payload, createPrismaDbAdapter(this.prisma));
  }
}

