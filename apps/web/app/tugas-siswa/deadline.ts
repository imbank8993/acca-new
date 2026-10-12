/**
 * Status deadline tugas siswa — dipakai bersama oleh TugasSiswaTable (desktop)
 * dan MobileCards supaya warnanya tidak pernah beda antar tampilan.
 *
 * Skema warna: makin dekat deadline, makin merah.
 *   3 hari lagi  → oranye
 *   2 hari lagi  → oranye kemerahan
 *   besok        → merah
 *   hari ini     → merah pekat
 * Tugas yang sudah lewat deadline sengaja ABU-ABU, bukan merah: yang perlu
 * ditonjolkan adalah tugas yang masih bisa dikerjakan, bukan yang sudah lewat.
 *
 * Warna tidak ditulis inline melainkan lewat `tone` → kelas CSS, supaya tiap
 * tampilan bisa punya varian mode gelap sendiri (style inline tidak bisa
 * ditimpa oleh selector `.dark`).
 */
export type DeadlineTone = 'lewat' | 'jauh' | 'h3' | 'h2' | 'h1' | 'today';

export interface DeadlineInfo {
    /** Label yang ditampilkan, mis. "2 hari lagi". */
    text: string;
    tone: DeadlineTone;
    /** Nama ikon Bootstrap Icons tanpa awalan `bi-`. */
    icon: string;
}

export function getDeadlineInfo(deadlineStr: string | null): DeadlineInfo {
    if (!deadlineStr) return { text: '', tone: 'jauh', icon: 'clock' };

    // Tanggal tanpa jam dianggap jatuh tempo di akhir hari (23:59:59)
    const day = deadlineStr.slice(0, 10);
    const deadlinePlain = new Date(day + 'T00:00:00Z');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || !Number.isFinite(deadlinePlain.getTime()) || deadlinePlain.toISOString().slice(0, 10) !== day) return { text: '', tone: 'jauh', icon: 'clock' };
    const schoolDate = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Makassar', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
    const today = new Date(schoolDate + 'T00:00:00Z');

    if (deadlinePlain.getTime() < today.getTime()) {
        return { text: 'Lewat Deadline', tone: 'lewat', icon: 'clock-history' };
    }

    if (today.getTime() === deadlinePlain.getTime()) {
        return { text: 'Hari Ini', tone: 'today', icon: 'exclamation-circle-fill' };
    }

    // Selisih dihitung dari tanggal (bukan jam) supaya "besok" tetap 1 hari
    // walau tugasnya dibuka menjelang tengah malam.
    const diffDays = Math.round((deadlinePlain.getTime() - today.getTime()) / (1000 * 3600 * 24));

    if (diffDays === 1) return { text: 'Besok', tone: 'h1', icon: 'exclamation-circle-fill' };
    if (diffDays === 2) return { text: '2 hari lagi', tone: 'h2', icon: 'alarm-fill' };
    if (diffDays === 3) return { text: '3 hari lagi', tone: 'h3', icon: 'alarm' };
    return { text: `${diffDays} hari lagi`, tone: 'jauh', icon: 'clock' };
}
