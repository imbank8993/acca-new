export function getSemesterFromDate(date: Date | string): number {
    const d = typeof date === 'string' ? new Date(date) : date;
    const month = d.getMonth(); // 0-11
    // July (6) to Dec (11) is Semester 1 (Ganjil)
    // Jan (0) to June (5) is Semester 2 (Genap)
    return (month >= 6) ? 1 : 2;
}

export function getAcademicYearFromDate(date: Date | string): string {
    const d = typeof date === 'string' ? new Date(date) : date;
    const month = d.getMonth();
    const year = d.getFullYear();
    if (month >= 6) {
        return `${year}/${year + 1}`;
    } else {
        return `${year - 1}/${year}`;
    }
}

export function getCurrentAcademicYear(): string {
    return getAcademicYearFromDate(new Date());
}

/**
 * Samakan representasi semester yang tercampur di aplikasi:
 * - `ekskul_siswa.semester` / `ekskul.semester` = INTEGER (1 = Ganjil, 2 = Genap)
 * - `siswa_kelas.semester` / `master_tahun_ajaran.semester` = TEXT ('Ganjil' | 'Genap')
 * Menerima angka ("1"/"2"/1/2) atau teks ("Ganjil"/"Genap") dan mengembalikan keduanya.
 */
export function normalizeSemester(
    raw: string | number | null | undefined
): { num: number; text: 'Ganjil' | 'Genap' } {
    const s = String(raw ?? '').trim().toLowerCase();
    const num = (s === 'genap' || s === '2') ? 2 : 1;
    return { num, text: num === 2 ? 'Genap' : 'Ganjil' };
}

export function formatDateId(dateStr?: string | null): string {
    if (!dateStr) return '-';
    const clean = dateStr.includes('T') ? dateStr.split('T')[0] : dateStr;
    const [y, m, d] = clean.split('-').map(Number);
    if (y && m && d) {
        const dObj = new Date(y, m - 1, d);
        return dObj.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
    }
    const dObj = new Date(dateStr);
    return isNaN(dObj.getTime()) ? clean : dObj.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
}
