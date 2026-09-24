import { prisma } from '@/lib/prisma';
import type { ApiUser } from '@/lib/api-auth';

/** ADMIN atau WKM_KESISWAAN — boleh mengelola/melihat semua ekskul. */
export function isEkskulManager(user: ApiUser): boolean {
    return user.isAdmin || user.roles.includes('WKM_KESISWAAN');
}

/** Apakah guru (nip) adalah pembina aktif dari ekskul tsb. */
export async function isPembinaOfEkskul(nip: string, ekskul_id: string): Promise<boolean> {
    if (!nip || !ekskul_id) return false;
    const data = await prisma.ekskul_pembina.findFirst({
        where: {
            nip,
            ekskul_id,
            aktif: true
        },
        select: { id: true }
    });
    return !!data;
}

/**
 * Petakan siswa yang sedang login (via NISN) ke master_siswa.id — foreign key
 * kanonik utk ekskul_siswa.siswa_id. Return null jika tidak ditemukan.
 */
export async function resolveOwnSiswaId(nisn: string): Promise<string | null> {
    if (!nisn) return null;
    const data = await prisma.master_siswa.findFirst({
        where: {
            nisn,
            aktif: true
        },
        select: { id: true }
    });
    return data ? String(data.id) : null;
}
