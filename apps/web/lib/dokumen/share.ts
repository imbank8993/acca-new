import { prisma } from '@/lib/prisma';
import type { ResolvedShare } from '@/lib/informasi/share';
import type { InformasiDoc } from '@/lib/informasi/docs';

/**
 * Link publik satu berkas Dokumen Sekolah (tabel uploaded_document_share_links).
 *
 * Bentuk hasilnya sengaja disamakan dengan ResolvedShare milik Informasi supaya
 * halaman /dokumen-link bisa memakai viewer /info-link apa adanya.
 */
export interface ResolvedDokumenShare extends ResolvedShare {
    /** URL asli berkas — HANYA untuk route proxy di server, jangan dikirim ke klien. */
    fileUrl: string;
}

export async function resolveDokumenShareToken(
    token: string,
    options: { countView?: boolean } = {},
): Promise<ResolvedDokumenShare | null> {
    const { countView = true } = options;
    if (!token || token.length > 64) return null;

    try {
        const link = await prisma.uploaded_document_share_links.findUnique({
            where: { token },
            include: { document: { include: { upload_categories: { select: { audience: true } } } } },
        });
        if (!link || link.revoked || !link.document) return null;

        const doc = link.document;
        if (!doc.file_url || doc.file_url === '#') return null;
        // Folder yang kemudian dijadikan privat ikut menutup link lamanya.
        const audience = String(doc.audience || doc.upload_categories?.audience || 'umum').toLowerCase();
        if (audience === 'none') return null;

        if (countView) {
            prisma.uploaded_document_share_links.update({
                where: { id: link.id },
                data: { view_count: { increment: 1 } },
            }).catch(() => { /* hitungan kunjungan hanya pelengkap */ });
        }

        const shown: InformasiDoc = {
            id: doc.id,
            title: doc.file_name,
            category: doc.category_name,
            file_url: '',
            file_name: doc.file_name,
            file_size: Number(doc.file_size || 0),
            show_on_landing: false,
            sort_order: 0,
            created_at: (doc.created_at || link.created_at).toISOString(),
        };

        return {
            scope: 'file',
            label: doc.file_name,
            division: doc.category_name || null,
            folder: doc.category_name || null,
            docs: [shown],
            fileUrl: doc.file_url,
        };
    } catch (err) {
        console.error('resolveDokumenShareToken error:', err);
        return null;
    }
}
