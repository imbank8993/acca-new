// Satuan akumulasi durasi ketidakhadiran (izin/sakit): 1 JP = 1 jam (60 menit).
// "Hari" bukan dihitung independen dari selisih tanggal kalender, melainkan
// diturunkan dari total JP (24 JP = 1 hari penuh). Ini membuat entri seharian
// penuh (tanpa jam spesifik) dan entri berjam spesifik bisa dijumlah dalam satu
// satuan yang sama sebelum dipecah jadi label "X hari Y JP" saat ditampilkan.
//
// Aturan turunan JP per entri:
// - Entri KONTINU multi-hari (satu rentang tak terputus, mis. 1 Sep 08.00 →
//   3 Sep 21.00): JP = selisih waktu sesungguhnya dari awal ke akhir rentang.
// - Entri dengan jam spesifik (waktu_mulai_real & waktu_selesai_real):
//   JP = durasi jam asli dikali jumlah hari rentang (tgl_mulai s/d tgl_selesai).
// - Entri seharian penuh atau multi-hari tanpa jam spesifik: 24 JP dikali
//   jumlah hari kalender yang dicakup.
export const JP_PER_HARI = 24;
const MENIT_PER_JP = 60;
export const MENIT_AKHIR_HARI = 24 * 60;

export function toMinutes(t?: string | Date | null): number | null {
    if (!t) return null;
    if (t instanceof Date) {
        if (isNaN(t.getTime())) return null;
        return t.getUTCHours() * 60 + t.getUTCMinutes();
    }
    const str = String(t).trim();
    if (!str) return null;
    if (str.includes('T')) {
        const timePart = str.split('T')[1]?.replace(/Z.*$/, '');
        if (timePart) {
            const [h, m] = timePart.split(':').map(Number);
            if (!isNaN(h) && !isNaN(m)) return h * 60 + m;
        }
    }
    const [h, m] = str.split(':').map(Number);
    if (isNaN(h) || isNaN(m)) return null;
    return h * 60 + m;
}

export function calcHariKalender(tglMulai: string, tglSelesai: string): number {
    if (!tglMulai || !tglSelesai) return 1;
    const [y1, m1, d1] = tglMulai.split('-').map(Number);
    const [y2, m2, d2] = tglSelesai.split('-').map(Number);
    const ms = new Date(y2, m2 - 1, d2).getTime() - new Date(y1, m1 - 1, d1).getTime();
    return Math.max(1, Math.floor(ms / (1000 * 60 * 60 * 24)) + 1);
}

export interface KetidakhadiranEntryLike {
    tgl_mulai: string;
    tgl_selesai: string;
    waktu_mulai_real?: string | null;
    waktu_selesai_real?: string | null;
    is_kontinu?: boolean | null;
}

// Entri kontinu non-stop yang membentang lebih dari satu tanggal: SATU baris
// yang berarti "mulai tgl_mulai pukul waktu_mulai_real, tanpa putus, sampai
// tgl_selesai pukul waktu_selesai_real". Jamnya adalah batas rentang, BUKAN
// jam yang berulang tiap hari — lihat entryTimeWindowForDate().
//
// PENTING: flag is_kontinu WAJIB disimpan dengan benar saat input, karena ini
// satu-satunya cara membedakan entri kontinu dari entri berulang yang juga
// bisa disimpan sebagai satu baris multi-hari.
export function isKontinuMultiHari(entry: KetidakhadiranEntryLike): boolean {
    return !!entry.is_kontinu
        && !!entry.tgl_mulai && !!entry.tgl_selesai
        && entry.tgl_mulai !== entry.tgl_selesai;
}

// Jendela jam sebuah entri dalam menit. Sisi yang kosong berarti TERBUKA,
// bukan "seharian penuh": ini bentuk data lama entri kontinu yang masih
// terpecah per tanggal (hari pertama [08:00, null], terakhir [null, 21:00]).
// null di kedua sisi = seharian penuh.
//
// Untuk entri kontinu satu-baris, nilai balik ini adalah BATAS RENTANG
// (mis. {08:00, 21:00} untuk 1 Sep 08.00 → 3 Sep 21.00) — cocok untuk label
// tampilan, tapi jangan dipakai menghitung menit per hari; pakai
// entryTimeWindowForDate() untuk itu.
export function entryTimeWindow(entry: KetidakhadiranEntryLike): { start: number; end: number } | null {
    const start = toMinutes(entry.waktu_mulai_real);
    const end = toMinutes(entry.waktu_selesai_real);
    if (start === null && end === null) return null;

    const s = start ?? 0;
    const e = end ?? MENIT_AKHIR_HARI;

    // Guard: entri multi-hari tanpa flag is_kontinu yang menghasilkan end < start
    // (mis. 16:53 → 12:00 lintas hari) tidak bisa diinterpretasikan sebagai
    // jendela dalam satu hari — perlakukan seharian penuh agar tidak salah blokir.
    if (e < s && entry.tgl_mulai && entry.tgl_selesai && entry.tgl_mulai !== entry.tgl_selesai) {
        return null;
    }

    return { start: s, end: e };
}

// Jendela jam yang benar-benar berlaku pada SATU tanggal tertentu. Untuk entri
// biasa jendelanya sama tiap hari; untuk entri kontinu multi-hari:
//   hari pertama  -> [waktu_mulai_real, akhir hari]
//   hari di tengah-> null (seharian penuh)
//   hari terakhir -> [awal hari, waktu_selesai_real]
// Semua pembaca yang menghitung "hari ini kena berapa menit" WAJIB lewat sini.
export function entryTimeWindowForDate(
    entry: KetidakhadiranEntryLike,
    tanggal: string
): { start: number; end: number } | null {
    if (!isKontinuMultiHari(entry)) return entryTimeWindow(entry);

    const mulai = toMinutes(entry.waktu_mulai_real);
    const selesai = toMinutes(entry.waktu_selesai_real);

    if (tanggal <= entry.tgl_mulai) {
        return mulai === null ? null : { start: mulai, end: MENIT_AKHIR_HARI };
    }
    if (tanggal >= entry.tgl_selesai) {
        return selesai === null ? null : { start: 0, end: selesai };
    }
    return null; // hari di tengah rentang = 24 jam penuh
}

// True bila entri punya batas jam (salah satu sisi pun cukup), bukan 24 jam penuh.
export function isEntryTimeSpecific(entry: KetidakhadiranEntryLike): boolean {
    return entryTimeWindow(entry) !== null;
}

function menitKeJam(menit: number): string {
    const h = Math.floor(menit / 60);
    const m = menit % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

// Label jam untuk tampilan; entri kontinu tetap memperlihatkan jam aslinya
// (mis. "08:00 – 24:00") alih-alih hilang jadi "Semua Jam". Entri kontinu
// multi-hari memakai panah supaya jelas itu batas rentang lintas hari,
// bukan jam yang berulang tiap hari.
export function formatEntryWaktu(
    entry: KetidakhadiranEntryLike,
    labelSeharian = 'Semua Jam'
): string {
    const w = entryTimeWindow(entry);
    if (!w) return labelSeharian;
    const pemisah = isKontinuMultiHari(entry) ? '→' : '–';
    return `${menitKeJam(w.start)} ${pemisah} ${menitKeJam(w.end)}`;
}

// JP mentah satu entri (bisa pecahan, mis. 1.5 JP untuk 90 menit).
export function calcEntryJp(entry: KetidakhadiranEntryLike): number {
    const hariKalender = calcHariKalender(entry.tgl_mulai, entry.tgl_selesai);

    // Kontinu = satu rentang utuh: hari pertama dihitung dari jam mulai s.d.
    // akhir hari, hari-hari tengah 24 jam penuh, hari terakhir s.d. jam selesai.
    if (isKontinuMultiHari(entry)) {
        const mulai = toMinutes(entry.waktu_mulai_real) ?? 0;
        const selesai = toMinutes(entry.waktu_selesai_real) ?? MENIT_AKHIR_HARI;
        const totalMenit = (hariKalender - 1) * MENIT_AKHIR_HARI - mulai + selesai;
        return Math.max(0, totalMenit) / MENIT_PER_JP;
    }

    const w = entryTimeWindow(entry);
    if (w) {
        const durasiJpPerHari = Math.max(0, w.end - w.start) / MENIT_PER_JP;
        return durasiJpPerHari * hariKalender;
    }
    return hariKalender * JP_PER_HARI;
}

// Potong entri ke periode [from, to] supaya rekap per bulan/semester hanya
// menghitung bagian yang jatuh di dalam periode itu. Penting sejak entri
// kontinu jadi SATU baris: sebuah entri 30 Sep → 2 Okt harus tetap masuk rekap
// September, tapi hanya sebatas jatahnya di September.
// Mengembalikan null bila entri sama sekali di luar periode.
export function clipEntryToRange<T extends KetidakhadiranEntryLike>(
    entry: T,
    from?: string | null,
    to?: string | null
): T | null {
    const mulai = from && entry.tgl_mulai < from ? from : entry.tgl_mulai;
    const selesai = to && entry.tgl_selesai > to ? to : entry.tgl_selesai;
    if (!mulai || !selesai || selesai < mulai) return null;
    if (mulai === entry.tgl_mulai && selesai === entry.tgl_selesai) return entry;

    // Sisi yang terpotong kehilangan jam batasnya: entri jadi mulai dari awal
    // hari / berlanjut sampai akhir hari di tepi periode.
    if (isKontinuMultiHari(entry)) {
        return {
            ...entry,
            tgl_mulai: mulai,
            tgl_selesai: selesai,
            waktu_mulai_real: mulai === entry.tgl_mulai ? entry.waktu_mulai_real : null,
            waktu_selesai_real: selesai === entry.tgl_selesai ? entry.waktu_selesai_real : null,
        };
    }

    // Mode berulang / entri biasa: jamnya sama tiap hari, cukup potong tanggalnya.
    return { ...entry, tgl_mulai: mulai, tgl_selesai: selesai };
}

export function isCurrentlyActive(entry: KetidakhadiranEntryLike, localDateStr: string, currentMins: number): boolean {
    // 1. Tanggal aktif
    if (entry.tgl_mulai && localDateStr < entry.tgl_mulai) return false;
    if (entry.tgl_selesai && localDateStr > entry.tgl_selesai) return false;

    // 2. Waktu aktif — jendela jam yang berlaku pada tanggal itu (entri kontinu
    //    punya jendela berbeda di hari pertama/tengah/terakhir)
    const w = entryTimeWindowForDate(entry, localDateStr);
    if (w && (currentMins < w.start || currentMins >= w.end)) {
        return false;
    }
    return true;
}

export function jpToHari(totalJpRaw: number): number {
    return Math.floor(Math.round(Math.max(0, totalJpRaw)) / JP_PER_HARI);
}

// Label gabungan "X hari Y JP" dari total JP terakumulasi.
export function formatJpDurasi(totalJpRaw: number): string {
    const totalJp = Math.round(Math.max(0, totalJpRaw));
    if (totalJp <= 0) return '0 JP';
    const hari = Math.floor(totalJp / JP_PER_HARI);
    const sisaJp = totalJp % JP_PER_HARI;
    if (hari > 0 && sisaJp > 0) return `${hari} hari ${sisaJp} JP`;
    if (hari > 0) return `${hari} hari`;
    return `${totalJp} JP`;
}

// ---------------------------------------------------------------------------
// Rekap kehadiran HARIAN (dipakai wali kelas/guru asuh untuk grid H/I/S/A).
// Satuan berbeda dari JP administratif izin/sakit di atas: di sini "JP" adalah
// JP MENGAJAR (1 sesi guru mapel bisa 1/2/3 JP, 1 JP = 40 menit riil), bukan
// JP administratif (1 jam). Jendela pembelajaran dipakai umum 07.00-16.00
// (540 menit) untuk semua hari, tidak dibedakan per jadwal per hari.
// ---------------------------------------------------------------------------
export const JAM_BELAJAR_MULAI = '07:00';
export const JAM_BELAJAR_SELESAI = '16:00';
export const MENIT_PER_JP_MENGAJAR = 40;

// Jumlah JP mengajar dari format jam_ke absensi_sesi, mis. "3-4" -> 2, "1" -> 1.
export function parseJamKeJp(jamKeStr?: string | null): number {
    if (!jamKeStr) return 1;
    const parts = jamKeStr.split(',').map(p => p.trim()).filter(Boolean);
    let total = 0;
    for (const part of parts) {
        if (part.includes('-')) {
            const [a, b] = part.split('-').map(n => parseInt(n, 10));
            if (!isNaN(a) && !isNaN(b)) total += Math.max(1, Math.abs(b - a) + 1);
        } else {
            const n = parseInt(part, 10);
            if (!isNaN(n)) total += 1;
        }
    }
    return total || 1;
}

export type StatusKehadiran = 'HADIR' | 'IZIN' | 'SAKIT' | 'ALPHA';

export interface DailyAttendanceMinutes {
    HADIR: number;
    IZIN: number;
    SAKIT: number;
    ALPHA: number;
}

interface KetidakhadiranEntryForDay extends KetidakhadiranEntryLike {
    jenis: string;
}

interface AbsensiDetailForDay {
    jamKe?: string | null;
    status: StatusKehadiran | string;
}

// Rekap kehadiran 1 siswa 1 hari dalam satuan MENIT, jendela 07.00-16.00.
// `tanggal` (YYYY-MM-DD) wajib diisi bila daftar entrinya bisa memuat entri
// kontinu multi-hari — jendela jamnya berbeda di hari pertama/tengah/terakhir.
// Urutan prioritas:
// 1. ketidakhadiran (izin/sakit) mengisi menitnya sendiri lebih dulu — sumber
//    utama, dihitung dari overlap jendela jam entri pada tanggal tersebut
//    terhadap jendela belajar (seharian penuh kalau tidak ada jam spesifik).
// 2. Sisa menit yang TIDAK tercakup ketidakhadiran diisi dari absensi_detail
//    guru mapel (1 JP = 40 menit) — hanya status HADIR/ALPHA yang dipakai di
//    sini karena IZIN/SAKIT sudah diwakili ketidakhadiran di langkah 1.
// 3. Sisa menit yang masih belum tercatat sama sekali (guru belum absen)
//    dianggap HADIR.
export function calcDailyAttendanceMinutes(
    ketidakhadiranHariIni: KetidakhadiranEntryForDay[],
    absensiDetailHariIni: AbsensiDetailForDay[],
    tanggal?: string
): DailyAttendanceMinutes {
    const windowStart = toMinutes(JAM_BELAJAR_MULAI) as number;
    const windowEnd = toMinutes(JAM_BELAJAR_SELESAI) as number;
    const totalBudget = windowEnd - windowStart;

    let izinMenit = 0;
    let sakitMenit = 0;
    for (const kh of ketidakhadiranHariIni) {
        let start = windowStart;
        let end = windowEnd;
        const w = tanggal ? entryTimeWindowForDate(kh, tanggal) : entryTimeWindow(kh);
        if (w) {
            start = Math.max(windowStart, w.start);
            end = Math.min(windowEnd, w.end);
        }
        const menit = Math.max(0, end - start);
        if ((kh.jenis || '').toUpperCase() === 'SAKIT') sakitMenit += menit;
        else izinMenit += menit;
    }
    // Cap ke budget total kalau ada beberapa entri ketidakhadiran yang
    // menitnya bertumpuk melebihi 540 menit (mis. data duplikat/tumpang tindih)
    const khMentahTotal = izinMenit + sakitMenit;
    const khTotal = Math.min(totalBudget, khMentahTotal);
    if (khMentahTotal > khTotal && khMentahTotal > 0) {
        const scale = khTotal / khMentahTotal;
        izinMenit = Math.round(izinMenit * scale);
        sakitMenit = khTotal - izinMenit;
    }

    const remainingBudget = totalBudget - khTotal;

    let hadirMenit = 0;
    let alphaMenit = 0;
    for (const d of absensiDetailHariIni) {
        const menit = parseJamKeJp(d.jamKe) * MENIT_PER_JP_MENGAJAR;
        const status = (d.status || 'HADIR').toUpperCase();
        if (status === 'HADIR') hadirMenit += menit;
        else if (status === 'ALPHA') alphaMenit += menit;
        // IZIN/SAKIT dari absensi guru mapel diabaikan di sini — sudah
        // diwakili ketidakhadiran pada langkah 1, supaya tidak dobel hitung.
    }
    // Cap defensif: absensi guru mapel semestinya sudah otomatis HADIR di
    // luar jam ketidakhadiran (lihat pengecekan overlap di absensi/view.tsx),
    // tapi tetap dibatasi ke sisa budget untuk jaga-jaga data tidak konsisten.
    const guruTotal = hadirMenit + alphaMenit;
    if (guruTotal > remainingBudget && guruTotal > 0) {
        const scale = remainingBudget / guruTotal;
        hadirMenit = Math.round(hadirMenit * scale);
        alphaMenit = remainingBudget - hadirMenit;
    }

    const unaccounted = Math.max(0, remainingBudget - hadirMenit - alphaMenit);

    return {
        HADIR: hadirMenit + unaccounted,
        IZIN: izinMenit,
        SAKIT: sakitMenit,
        ALPHA: alphaMenit,
    };
}

// Status dengan menit terbanyak = status absensi harian kelas.
export function dominantStatus(minutes: DailyAttendanceMinutes): StatusKehadiran {
    let best: StatusKehadiran = 'HADIR';
    let bestVal = -1;
    (Object.keys(minutes) as StatusKehadiran[]).forEach(k => {
        if (minutes[k] > bestVal) { bestVal = minutes[k]; best = k; }
    });
    return best;
}
