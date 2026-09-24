/**
 * Helper bersama untuk data hari libur.
 *
 * Semua pembaca tabel `libur` WAJIB lewat file ini. Alasannya dua:
 *
 * 1. `jam_ke` bertipe TEXT dan bisa berisi `'Semua'` (libur sehari penuh) atau
 *    nomor jam pelajaran. Membandingkannya dengan `parseInt()` mentah membuat
 *    `'Semua'` jadi `NaN` sehingga libur sehari penuh malah terlewat.
 * 2. Sejak migrasi 20260827 libur bisa dibatasi lingkupnya: berlaku untuk semua
 *    kelas, untuk tingkat tertentu, atau untuk daftar kelas tertentu. Pembaca
 *    yang tidak tahu soal `lingkup`/`target_kelas` akan meliburkan seluruh
 *    sekolah padahal liburnya cuma untuk sebagian kelas.
 *
 * File ini murni (tanpa akses DB) supaya bisa dipakai di server maupun browser.
 */

export type LiburLingkup = 'semua' | 'tingkat' | 'kelas';

export interface LiburRow {
    id?: number;
    tanggal: string;
    jam_ke?: string | number | null;
    keterangan?: string | null;
    /** Kolom hasil migrasi 20260827; `undefined` kalau migrasi belum dijalankan. */
    lingkup?: string | null;
    /** Daftar tingkat ('10'/'11'/'12') atau nama kelas, tergantung `lingkup`. */
    target_kelas?: string[] | string | null;
}

/** Konteks kelas yang sedang dinilai. `tingkat` diambil dari master_kelas.tingkat. */
export interface KelasContext {
    kelas?: string | null;
    tingkat?: number | string | null;
}

export const JAM_SEMUA = 'Semua';

export const LINGKUP_OPTIONS: { value: LiburLingkup; label: string; hint: string }[] = [
    { value: 'semua', label: 'Semua kelas', hint: 'Libur berlaku untuk seluruh madrasah' },
    { value: 'tingkat', label: 'Tingkat tertentu', hint: 'Mis. hanya kelas XII' },
    { value: 'kelas', label: 'Kelas tertentu', hint: 'Mis. hanya XI Fisika 1 dan XI Fisika 2' },
];

/** 10 → "X", 11 → "XI", 12 → "XII". Nilai lain dikembalikan apa adanya. */
export function labelTingkat(tingkat: number | string | null | undefined): string {
    const raw = String(tingkat ?? '').trim();
    const map: Record<string, string> = { '7': 'VII', '8': 'VIII', '9': 'IX', '10': 'X', '11': 'XI', '12': 'XII' };
    return map[raw] || raw;
}

/** Normalisasi `target_kelas` yang bisa datang sebagai array, string koma, atau null. */
export function parseTargetKelas(value: unknown): string[] {
    if (Array.isArray(value)) {
        return value.map(v => String(v).trim()).filter(Boolean);
    }
    if (typeof value === 'string') {
        const raw = value.trim();
        if (!raw) return [];
        // Bentuk literal array Postgres ("{X A,XI B}") kalau ada klien yang mengirim mentah.
        const inner = raw.startsWith('{') && raw.endsWith('}') ? raw.slice(1, -1) : raw;
        return inner
            .split(',')
            .map(v => v.trim().replace(/^"|"$/g, ''))
            .filter(Boolean);
    }
    return [];
}

/**
 * Lingkup efektif sebuah baris libur. Baris lama (sebelum migrasi) atau baris
 * dengan target kosong selalu jatuh ke `'semua'` supaya perilakunya sama persis
 * seperti sebelum fitur ini ada.
 */
export function normalizeLingkup(row: Pick<LiburRow, 'lingkup' | 'target_kelas'>): LiburLingkup {
    const raw = String(row?.lingkup ?? '').trim().toLowerCase();
    if (raw !== 'tingkat' && raw !== 'kelas') return 'semua';
    if (parseTargetKelas(row?.target_kelas).length === 0) return 'semua';
    return raw;
}

/** Normalisasi `jam_ke` jadi `'Semua'` atau nomor jam sebagai string. */
export function normalizeJamKe(jam: unknown): string {
    if (jam === null || jam === undefined) return JAM_SEMUA;
    const raw = String(jam).trim();
    if (!raw) return JAM_SEMUA;
    if (raw.toLowerCase() === 'semua') return JAM_SEMUA;
    return raw;
}

/**
 * Pecah input jam dari form/import jadi daftar jam tunggal.
 * `'Semua'`, `'1,2'`, `['1','2']`, `2` → `['Semua']` / `['1','2']` / `['2']`.
 *
 * Penting: nilai gabungan berkoma TIDAK BOLEH tersimpan ke DB — pembacanya
 * melakukan perbandingan per jam, sehingga `'1,2'` cuma terbaca sebagai jam 1.
 */
export function expandJamKe(input: unknown): string[] {
    const raw = Array.isArray(input) ? input : String(input ?? '').split(',');
    const out = raw
        .map(v => normalizeJamKe(v))
        .filter(Boolean);
    const unik = Array.from(new Set(out));
    // 'Semua' menelan jam spesifik: liburnya sudah sehari penuh.
    if (unik.includes(JAM_SEMUA)) return [JAM_SEMUA];
    return unik.length > 0 ? unik : [JAM_SEMUA];
}

function samaKelas(a: string, b: string): boolean {
    return a.trim().toLowerCase() === b.trim().toLowerCase();
}

/**
 * Apakah baris libur ini berlaku untuk kelas pada konteks yang diberikan?
 *
 * Kalau lingkupnya terbatas tapi konteks kelas/tingkat tidak diketahui, hasilnya
 * `false` — lebih aman menganggap "bukan libur" (jurnal tetap dibuat, bisa
 * dihapus manual) daripada meliburkan kelas yang sebenarnya tetap belajar.
 */
export function liburBerlakuUntukKelas(row: LiburRow, ctx: KelasContext = {}): boolean {
    const lingkup = normalizeLingkup(row);
    if (lingkup === 'semua') return true;

    const targets = parseTargetKelas(row.target_kelas);
    if (targets.length === 0) return true;

    if (lingkup === 'tingkat') {
        const tingkat = String(ctx.tingkat ?? '').trim();
        if (!tingkat) return false;
        return targets.some(t => String(t).trim() === tingkat);
    }

    const kelas = String(ctx.kelas ?? '').trim();
    if (!kelas) return false;
    return targets.some(t => samaKelas(t, kelas));
}

/** Apakah `jam_ke` baris libur mencakup jam pelajaran tertentu. */
export function liburMencakupJam(row: LiburRow, jamKe: number | string | null | undefined): boolean {
    const jamLibur = normalizeJamKe(row.jam_ke);
    if (jamLibur === JAM_SEMUA) return true;
    if (jamKe === null || jamKe === undefined || jamKe === '') return false;
    return Number(jamLibur) === Number(jamKe);
}

/** Label lingkup untuk ditampilkan di tabel/kalender. */
export function labelLingkup(row: LiburRow): string {
    const lingkup = normalizeLingkup(row);
    if (lingkup === 'semua') return 'Semua kelas';
    const targets = parseTargetKelas(row.target_kelas);
    if (lingkup === 'tingkat') {
        return `Tingkat ${targets.map(labelTingkat).join(', ')}`;
    }
    return targets.join(', ');
}

export interface LiburIndex {
    /** Semua baris libur pada tanggal tersebut (tanpa filter kelas). */
    rowsOn(tanggal: string): LiburRow[];
    /** Libur sehari penuh (`jam_ke = 'Semua'`) yang berlaku untuk kelas ini. */
    isLiburSehari(tanggal: string, ctx?: KelasContext): boolean;
    /** Libur pada satu jam pelajaran (termasuk yang sehari penuh). */
    isLibur(tanggal: string, jamKe: number | string | null | undefined, ctx?: KelasContext): boolean;
    /** Baris libur pertama yang berlaku — untuk mengambil keterangannya. */
    find(tanggal: string, jamKe?: number | string | null, ctx?: KelasContext): LiburRow | undefined;
}

/**
 * Bangun indeks libur dari hasil query. Dipakai supaya pengecekan di dalam loop
 * harian tidak menyaring ulang seluruh array untuk setiap tanggal × siswa.
 */
export function buildLiburIndex(rows: LiburRow[] | null | undefined): LiburIndex {
    const byDate = new Map<string, LiburRow[]>();
    for (const row of rows || []) {
        if (!row?.tanggal) continue;
        const key = String(row.tanggal).split('T')[0];
        if (!byDate.has(key)) byDate.set(key, []);
        byDate.get(key)!.push(row);
    }

    const rowsOn = (tanggal: string) => byDate.get(String(tanggal).split('T')[0]) || [];

    const find: LiburIndex['find'] = (tanggal, jamKe = null, ctx = {}) =>
        rowsOn(tanggal).find(row =>
            liburBerlakuUntukKelas(row, ctx) &&
            (jamKe === null || jamKe === undefined ? true : liburMencakupJam(row, jamKe))
        );

    return {
        rowsOn,
        find,
        isLiburSehari: (tanggal, ctx = {}) =>
            rowsOn(tanggal).some(row =>
                normalizeJamKe(row.jam_ke) === JAM_SEMUA && liburBerlakuUntukKelas(row, ctx)
            ),
        isLibur: (tanggal, jamKe, ctx = {}) =>
            rowsOn(tanggal).some(row =>
                liburMencakupJam(row, jamKe) && liburBerlakuUntukKelas(row, ctx)
            ),
    };
}

/**
 * Tahun ajaran dari sebuah tanggal. Batasnya Juli: 2026-07-01 → "2026/2027",
 * 2026-06-30 → "2025/2026".
 */
export function tahunAjaranDariTanggal(dateStr: string): string {
    const [y, m] = String(dateStr).split('-').map(Number);
    if (!y || !m) return '';
    return m >= 7 ? `${y}/${y + 1}` : `${y - 1}/${y}`;
}

/**
 * Rentang tanggal sebuah tahun ajaran ("2026/2027" → 2026-07-01 s/d 2027-06-30).
 *
 * Tabel `libur` TIDAK punya kolom `tahun_ajaran` (lihat migrasi 20260827), jadi
 * filter tahun ajaran harus jadi filter rentang tanggal, bukan `.eq()` kolom.
 */
export function rentangTahunAjaran(tahunAjaran: string): { start: string; end: string } | null {
    const m = String(tahunAjaran || '').match(/^(\d{4})\s*\/\s*(\d{4})$/);
    if (!m) return null;
    const awal = Number(m[1]);
    return { start: `${awal}-07-01`, end: `${awal + 1}-06-30` };
}

/** Validasi ketat format `YYYY-MM-DD` (termasuk tanggal yang benar-benar ada). */
export function isTanggalValid(value: unknown): boolean {
    const raw = String(value ?? '').trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return false;
    const [y, m, d] = raw.split('-').map(Number);
    if (m < 1 || m > 12 || d < 1 || d > 31) return false;
    const dt = new Date(Date.UTC(y, m - 1, d));
    return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

/**
 * Daftar tanggal `YYYY-MM-DD` dari start s/d end (inklusif).
 *
 * Sengaja memakai aritmetika kalender lokal, bukan `toISOString()` di atas objek
 * Date yang di-mutasi: `toISOString()` mengonversi ke UTC sehingga tanggalnya
 * bisa mundur sehari di zona waktu negatif atau saat melewati batas DST.
 */
export function rentangTanggal(start: string, end: string): string[] {
    if (!isTanggalValid(start) || !isTanggalValid(end)) return [];
    const [sy, sm, sd] = start.split('-').map(Number);
    const [ey, em, ed] = end.split('-').map(Number);
    const out: string[] = [];
    const curr = new Date(sy, sm - 1, sd);
    const last = new Date(ey, em - 1, ed);
    while (curr <= last) {
        out.push(
            `${curr.getFullYear()}-${String(curr.getMonth() + 1).padStart(2, '0')}-${String(curr.getDate()).padStart(2, '0')}`
        );
        curr.setDate(curr.getDate() + 1);
    }
    return out;
}
