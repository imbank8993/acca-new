import { prisma } from './prisma';
import { getAcademicYearFromDate, getSemesterFromDate } from './date-utils';

export async function getActiveAcademicYearServer(): Promise<string | null> {
    const settings = await getActiveSettingsServer();
    return settings?.tahun_ajaran || null;
}

export async function getActiveSemesterServer(): Promise<string | null> {
    const settings = await getActiveSettingsServer();
    return settings?.semester || null;
}

export async function getActiveSettingsServer(): Promise<{ tahun_ajaran: string, semester: string } | null> {
    try {
        const data = await prisma.master_tahun_ajaran.findFirst({
            where: { is_active: true },
            select: { tahun_ajaran: true, semester: true }
        });

        return data ? { tahun_ajaran: data.tahun_ajaran, semester: data.semester || '' } : null;
    } catch (err) {
        console.error('Unexpected error in getActiveSettingsServer:', err);
        return null;
    }
}

export async function getActiveSettingsWithLockServer(): Promise<{ tahun_ajaran: string, semester: string, is_locked: boolean } | null> {
    try {
        const data = await prisma.master_tahun_ajaran.findFirst({
            where: { is_active: true },
            select: { tahun_ajaran: true, semester: true, is_locked: true }
        });

        return data ? { tahun_ajaran: data.tahun_ajaran, semester: data.semester || '', is_locked: data.is_locked || false } : null;
    } catch (err) {
        console.error('Unexpected error in getActiveSettingsWithLockServer:', err);
        return null;
    }
}

export async function setUMLockedServer(tahunAjaran: string, locked: boolean): Promise<boolean> {
    try {
        await prisma.master_tahun_ajaran.updateMany({
            where: { tahun_ajaran: tahunAjaran },
            data: { is_locked: locked }
        });
        return true;
    } catch (err) {
        console.error('Unexpected error in setUMLockedServer:', err);
        return false;
    }
}

export async function getRecommendedSettingsServer(): Promise<{ tahun_ajaran: string, semester: string }> {
    const now = new Date();
    const dateStr = now.toISOString().split('T')[0];
    const recYear = getAcademicYearFromDate(dateStr);
    const recSem = getSemesterFromDate(dateStr);

    try {
        const data = await prisma.master_tahun_ajaran.findFirst({
            where: {
                tahun_ajaran: recYear,
                semester: String(recSem)
            },
            select: { tahun_ajaran: true, semester: true }
        });

        if (data) return { tahun_ajaran: data.tahun_ajaran, semester: String(data.semester) };

        const active = await getActiveSettingsServer();
        return active ? { tahun_ajaran: active.tahun_ajaran, semester: String(active.semester) } : { tahun_ajaran: recYear, semester: String(recSem) };
    } catch (err) {
        return { tahun_ajaran: recYear, semester: String(recSem) };
    }
}
