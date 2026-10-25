import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { resolveShareToken } from '@/lib/informasi/share';
import ShareLinkClient from './ShareLinkClient';
import { APP_BRAND } from '@/lib/branding';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
    title: 'Informasi Dibagikan - ACCA',
    openGraph: {
        type: 'website',
        siteName: APP_BRAND.name,
        title: 'Informasi Dibagikan - ACCA',
        description: 'Informasi dari MAN Insan Cendekia Gowa.',
        images: [{ url: APP_BRAND.shareImage, width: 1200, height: 630, alt: 'Logo ACCA' }],
    },
    twitter: {
        card: 'summary_large_image',
        images: [APP_BRAND.shareImage],
    },
    // Publik (lihat publicPaths di middleware.ts) supaya link di WA bisa dibuka
    // tanpa login. Aksesnya bersandar pada token acak, jadi jangan diindeks.
    robots: { index: false, follow: false },
};

export default async function InfoLinkPage({ params }: { params: Promise<{ token: string }> }) {
    const { token } = await params;

    const resolved = await resolveShareToken(token);
    if (!resolved) return notFound();

    let schoolName = '';
    try {
        const profil = await prisma.profil_sekolah.findFirst({ select: { nama: true } });
        schoolName = profil?.nama || '';
    } catch {
        // Nama madrasah hanya hiasan header; kegagalannya tidak boleh menutup halaman.
    }

    return <ShareLinkClient share={resolved} token={token} schoolName={schoolName} />;
}
