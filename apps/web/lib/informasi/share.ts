import { randomBytes } from 'crypto';
import { prisma } from '@/lib/prisma';
import { getInformasiDocuments, parseInformasiCategory, type InformasiDoc } from '@/lib/informasi/docs';

export type ShareScope = 'folder' | 'file';

export interface ShareLinkRow {
    id: string;
    token: string;
    scope: ShareScope;
    division: string | null;
    folder: string | null;
    doc_id: string | null;
    label: string | null;
    created_by: string | null;
    created_by_name: string | null;
    expires_at: string | null;
    revoked: boolean;
    view_count: number;
    created_at: string;
}

export interface ResolvedShare {
    scope: ShareScope;
    label: string;
    division: string | null;
    folder: string | null;
    docs: InformasiDoc[];
}

export function generateShareToken(): string {
    return randomBytes(12).toString('base64url');
}

export function isShareLinkActive(link: Pick<ShareLinkRow, 'revoked' | 'expires_at'>): boolean {
    if (link.revoked) return false;
    if (link.expires_at && new Date(link.expires_at).getTime() < Date.now()) return false;
    return true;
}

export async function resolveShareToken(
    token: string,
    options: { countView?: boolean } = {}
): Promise<ResolvedShare | null> {
    const { countView = true } = options;
    if (!token) return null;

    try {
        const link = await prisma.informasi_share_links.findUnique({
            where: { token }
        });

        if (!link) return null;

        const linkRow: ShareLinkRow = {
            ...link,
            scope: link.scope as ShareScope,
            expires_at: link.expires_at ? link.expires_at.toISOString() : null,
            created_at: link.created_at.toISOString()
        };

        if (!isShareLinkActive(linkRow)) return null;

        const all = await getInformasiDocuments({ roleSet: new Set(['all']) });
        const shown = all.filter(d =>
            String(d.audience || 'umum').toLowerCase() !== 'none' &&
            Boolean(d.file_url) &&
            d.file_url !== '#' &&
            d.title !== 'Folder placeholder'
        );

        let docs: InformasiDoc[] = [];
        if (link.scope === 'file') {
            docs = shown.filter(d => d.id === link.doc_id);
        } else {
            // scope === 'folder': Cegah kebocoran berkas non-publik dalam folder bersama.
            // Hanya berkas ber-audience 'umum' yang boleh diakses publik tanpa login.
            // Berkas internal guru ('guru'), siswa ('siswa'), atau privat ('none') tidak boleh disertakan.
            docs = shown.filter(d => {
                const aud = String(d.audience || 'umum').toLowerCase();
                if (aud !== 'umum') return false;

                const parsed = parseInformasiCategory(d.category);
                const folderMatch = parsed.folder === link.folder;
                const divMatch = !link.division
                    || parsed.division.toLowerCase() === String(link.division).toLowerCase();
                return folderMatch && divMatch;
            });
            docs.sort((a, b) => a.title.localeCompare(b.title));
        }

        if (docs.length === 0) return null;

        if (countView) {
            prisma.informasi_share_links.update({
                where: { id: link.id },
                data: { view_count: link.view_count + 1 }
            }).catch(() => { /* abaikan */ });
        }

        return {
            scope: link.scope as ShareScope,
            label: link.label || (link.scope === 'file' ? docs[0].title : link.folder || 'Informasi'),
            division: link.division,
            folder: link.folder,
            docs,
        };
    } catch (err) {
        console.error('resolveShareToken error:', err);
        return null;
    }
}
