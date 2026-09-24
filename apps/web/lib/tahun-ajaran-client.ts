/**
 * Helper client-side untuk tahun ajaran aktif.
 * is_active di master_tahun_ajaran bisa 2 baris (Ganjil + Genap) dengan
 * tahun_ajaran yang sama — ambil daftar tahun unik yang aktif.
 */

let _cache: { at: number; years: string[] } | null = null;
const TTL_MS = 60_000;

export async function getActiveTahunAjaranList(): Promise<string[]> {
    if (_cache && Date.now() - _cache.at < TTL_MS) return _cache.years;
    try {
        const res = await fetch('/api/admin/tahun-ajaran');
        const json = await res.json();
        if (json.ok && Array.isArray(json.data)) {
            const years = [...new Set(
                json.data.filter((t: any) => t.is_active).map((t: any) => String(t.tahun_ajaran))
            )] as string[];
            _cache = { at: Date.now(), years };
            return years;
        }
    } catch {
        // fallback di bawah
    }
    return [];
}

/**
 * Label tahun ajaran dari sebuah tanggal (kalender akademik mulai Juli).
 * Contoh: 2026-07-15 → "2026/2027", 2026-03-01 → "2025/2026".
 */
export function tahunAjaranFromDate(dateStr: string): string {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '';
    const y = d.getFullYear();
    return d.getMonth() + 1 >= 7 ? `${y}/${y + 1}` : `${y - 1}/${y}`;
}

/** Semester berjalan berdasar bulan: Jul–Des = '1' (Ganjil), Jan–Jun = '2' (Genap). */
export function currentSemesterDefault(): '1' | '2' {
    return new Date().getMonth() + 1 >= 7 ? '1' : '2';
}
