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
    const deadline = new Date(deadlineStr);
    if (deadlineStr.length <= 10) {
        deadline.setHours(23, 59, 59, 999);
    }

    const now = new Date();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const deadlinePlain = new Date(deadline);
    deadlinePlain.setHours(0, 0, 0, 0);

    if (deadline.getTime() - now.getTime() < 0) {
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
