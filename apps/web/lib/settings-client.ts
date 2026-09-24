/**
 * lib/settings-client.ts
 * Versi CLIENT-SAFE: semua fungsi menggunakan fetch() ke API route,
 * TIDAK mengimport Prisma/supabase-admin (yang hanya boleh di server-side).
 */
import { getAcademicYearFromDate, getSemesterFromDate } from './date-utils';

export async function getActivePeriods(): Promise<{ tahun_ajaran: string; semester: string }[]> {
    try {
        const res = await fetch('/api/admin/tahun-ajaran?active=true', { cache: 'no-store' });
        if (!res.ok) return [];
        const data = await res.json();
        const rows = data?.data || data || [];
        return Array.isArray(rows) ? rows.filter((r: any) => r.is_active) : [];
    } catch {
        return [];
    }
}

export async function getActiveSettings(): Promise<{ tahun_ajaran: string; semester: string } | null> {
    const periods = await getActivePeriods();
    return periods.length > 0 ? periods[0] : null;
}

export async function getActiveAcademicYear(): Promise<string | null> {
    const settings = await getActiveSettings();
    return settings?.tahun_ajaran || null;
}

export async function getActiveSemester(): Promise<string | null> {
    const settings = await getActiveSettings();
    return settings?.semester || null;
}

export async function getAllActiveAcademicYears(): Promise<{ tahun_ajaran: string; semester: string }[]> {
    return getActivePeriods();
}

export async function getAllAcademicYears(): Promise<string[]> {
    try {
        const res = await fetch('/api/admin/tahun-ajaran', { cache: 'no-store' });
        if (!res.ok) return [];
        const data = await res.json();
        const rows = data?.data || data || [];
        const years = (Array.isArray(rows) ? rows : []).map((r: any) => r.tahun_ajaran).filter(Boolean);
        return Array.from(new Set<string>(years));
    } catch {
        return [];
    }
}

export async function getActiveSettingsWithLock(): Promise<{ tahun_ajaran: string; semester: string; is_locked: boolean } | null> {
    const periods = await getActivePeriods();
    if (periods.length === 0) return null;
    const p = periods[0] as any;
    return { tahun_ajaran: p.tahun_ajaran, semester: p.semester, is_locked: p.is_locked || false };
}

export async function setUMLockedClient(_tahunAjaran: string, _locked: boolean): Promise<boolean> {
    // Operasi ini hanya boleh dilakukan server-side (PATCH ke /api/admin/tahun-ajaran)
    // Client component seharusnya tidak memanggil fungsi ini secara langsung.
    console.warn('[settings-client] setUMLockedClient: gunakan API route dari server action');
    return false;
}

export async function getRecommendedSettings(): Promise<{ tahun_ajaran: string; semester: string }> {
    const now = new Date();
    const dateStr = now.toISOString().split('T')[0];
    const recYear = getAcademicYearFromDate(dateStr);
    const recSem = getSemesterFromDate(dateStr);

    try {
        const periods = await getActivePeriods();
        const match = periods.find(p => p.tahun_ajaran === recYear);
        if (match) return { tahun_ajaran: match.tahun_ajaran, semester: String(match.semester) };
        const active = periods[0];
        return active
            ? { tahun_ajaran: active.tahun_ajaran, semester: String(active.semester) }
            : { tahun_ajaran: recYear, semester: String(recSem) };
    } catch {
        return { tahun_ajaran: recYear, semester: String(recSem) };
    }
}
