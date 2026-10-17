export const JAM_BELAJAR_MULAI = '07:00';
export const JAM_BELAJAR_SELESAI = '16:00';
export const MENIT_PER_JP_MENGAJAR = 40;
export const MENIT_AKHIR_HARI = 24 * 60;

export type StatusKehadiran = 'HADIR' | 'IZIN' | 'SAKIT' | 'ALPHA';

export interface DailyAttendanceMinutes {
  HADIR: number;
  IZIN: number;
  SAKIT: number;
  ALPHA: number;
}

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

export function parseJamKeJp(jamKe?: string | null): number {
  if (!jamKe) return 1;
  const match = jamKe.match(/\d+/g);
  if (!match) return 1;
  const nums = match.map(Number);
  if (nums.length === 1) return 1;
  return Math.max(1, nums[nums.length - 1] - nums[0] + 1);
}

export function resolveTahunAjaranSemester(bulanYYYYMM: string): {
  tahunAjaran: string;
  semester: number;
  semesterStr: string;
} {
  const [y, m] = bulanYYYYMM.split('-').map(Number);
  const refDate = new Date(y, m - 1, 15);
  const refMonth = refDate.getMonth() + 1;
  const refYear = refDate.getFullYear();
  const tahunAjaran = refMonth >= 7 ? `${refYear}/${refYear + 1}` : `${refYear - 1}/${refYear}`;
  const semester = refMonth >= 7 ? 1 : 2;
  return { tahunAjaran, semester, semesterStr: semester === 1 ? 'Ganjil' : 'Genap' };
}

export function entryTimeWindow(entry: any): { start: number; end: number } | null {
  const start = toMinutes(entry.waktu_mulai_real);
  const end = toMinutes(entry.waktu_selesai_real);
  if (start === null && end === null) return null;
  return { start: start ?? 0, end: end ?? MENIT_AKHIR_HARI };
}

export function calcDailyAttendanceMinutes(
  ketidakhadiranHariIni: any[],
  absensiDetailHariIni: any[],
  tanggal?: string,
): DailyAttendanceMinutes {
  const windowStart = toMinutes(JAM_BELAJAR_MULAI) as number;
  const windowEnd = toMinutes(JAM_BELAJAR_SELESAI) as number;
  const totalBudget = windowEnd - windowStart;

  let izinMenit = 0;
  let sakitMenit = 0;

  for (const kh of ketidakhadiranHariIni) {
    let start = windowStart;
    let end = windowEnd;
    const w = entryTimeWindow(kh);
    if (w) {
      start = Math.max(windowStart, w.start);
      end = Math.min(windowEnd, w.end);
    }
    const menit = Math.max(0, end - start);
    if ((kh.jenis || '').toUpperCase() === 'SAKIT') sakitMenit += menit;
    else izinMenit += menit;
  }

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
  }

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

export function dominantStatus(minutes: DailyAttendanceMinutes): StatusKehadiran {
  let best: StatusKehadiran = 'HADIR';
  let bestVal = -1;
  (Object.keys(minutes) as StatusKehadiran[]).forEach((k) => {
    if (minutes[k] > bestVal) {
      bestVal = minutes[k];
      best = k;
    }
  });
  return best;
}
