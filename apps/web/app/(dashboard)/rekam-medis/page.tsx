'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useDashboardUser } from '@/components/UserContext';
import MaintenanceBanner from '@/components/MaintenanceBanner';
import RekamMedisView from '@/app/rekam-medis/view';

/**
 * Halaman ini punya route sendiri, jadi ia TIDAK melewati `[...pageId]` —
 * artinya pemeriksaan `pagesArray` di sana tidak pernah berlaku untuknya.
 * Sebelumnya berkas ini langsung merender view tanpa memeriksa apa pun, jadi
 * `/rekam-medis` terbuka untuk setiap pengguna yang login. Isinya rekam medis
 * siswa — riwayat penyakit, alergi obat, keluhan, tindakan — jadi gerbangnya
 * ditiru dari `[...pageId]`: hanya pemegang halaman `rekam-medis`.
 *
 * Ini lapis kedua. Lapis pertama ada di API (`@RequiresPage('rekam-medis')`
 * pada route rekam-medis-siswa di NestJS); gerbang di klien sendirian tidak
 * pernah cukup, tapi tanpa ia halamannya tetap terbuka dan hanya menampilkan
 * galat — bukan perilaku yang benar.
 */
export default function RekamMedisDashboardPage() {
    const router = useRouter();
    const { user } = useDashboardUser();

    const isAllowed = !!user?.pagesArray?.includes('rekam-medis');

    useEffect(() => {
        if (user && !isAllowed) router.replace('/dashboard');
    }, [user, isAllowed, router]);

    if (!user || !isAllowed) return null;

    return (
        <>
            <MaintenanceBanner pageKey="maintenance_ketidakhadiran_rekam_medis" />
            <RekamMedisView />
        </>
    );
}
