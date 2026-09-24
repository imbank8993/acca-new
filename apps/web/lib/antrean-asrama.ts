import { prisma } from '@/lib/prisma';
import { ASRAMA_STATUS } from '@/lib/antrean-asrama-status';

export { ASRAMA_STATUS };

export async function idRekomendasiDiLuarStatus(
    statusAntrean: string[] = ASRAMA_STATUS
): Promise<string[]> {
    try {
        const suratRekom = await prisma.acca_letters.findMany({
            where: {
                jenis_izin: 'REKOMENDASI_KONTROL',
                ketidakhadiran_id: { not: null }
            },
            select: { ketidakhadiran_id: true }
        });

        const semuaId = [...new Set(suratRekom.map((r) => r.ketidakhadiran_id).filter(Boolean))] as string[];
        if (semuaId.length === 0) return [];

        const hasil: string[] = [];
        for (let i = 0; i < semuaId.length; i += 100) {
            const chunk = semuaId.slice(i, i + 100);
            const data = await prisma.ketidakhadiran.findMany({
                where: {
                    id: { in: chunk },
                    jenis: 'SAKIT',
                    aktif: true
                },
                select: { id: true, status: true }
            });
            for (const r of data) {
                if (!statusAntrean.includes(r.status)) hasil.push(r.id);
            }
        }
        return hasil;
    } catch (error: any) {
        console.error('[antrean-asrama] gagal membaca surat rekomendasi:', error?.message);
        return [];
    }
}
