import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { resolveDokumenShareToken } from '@/lib/dokumen/share';
import ShareLinkClient from '@/app/info-link/[token]/ShareLinkClient';
import { APP_BRAND } from '@/lib/branding';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
    title: 'Dokumen Dibagikan - ACCA',
    openGraph: {
        type: 'website',
        siteName: APP_BRAND.name,
        title: 'Dokumen Dibagikan - ACCA',
        description: 'Dokumen dari MAN Insan Cendekia Gowa.',
        images: [{ url: APP_BRAND.shareImage, width: 1200, height: 630, alt: 'Logo ACCA' }],
    },
    twitter: {
        card: 'summary_large_image',
        images: [APP_BRAND.shareImage],
    },
    // Publik (publicPaths di middleware.ts) supaya bisa dibuka dari WA tanpa
    // login; aksesnya bersandar pada token acak, jadi jangan diindeks.
    robots: { index: false, follow: false },
};

export default async function DokumenLinkPage({ params }: { params: Promise<{ token: string }> }) {
    const { token } = await params;

    const resolved = await resolveDokumenShareToken(token);
    if (!resolved) return notFound();

    let schoolName = '';
    try {
        const profil = await prisma.profil_sekolah.findFirst({ select: { nama: true } });
        schoolName = profil?.nama || '';
    } catch {
        // Nama madrasah hanya hiasan header.
    }

    // URL asli berkas tidak ikut dikirim ke klien; viewer mengambilnya lewat proxy bertoken.
    const { fileUrl: _fileUrl, ...share } = resolved;

    return (
        <ShareLinkClient
            share={share}
            token={token}
            schoolName={schoolName}
            fileBase="/api/dokumen-share/file"
            eyebrow="Dokumen dibagikan"
            note="Tautan ini hanya menampilkan dokumen di atas. Untuk melihat dokumen lain, masuk ke aplikasi menggunakan akun Anda."
        />
    );
}
