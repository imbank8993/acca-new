import { prisma } from '@/lib/prisma';

export interface InformasiDoc {
    id: string;
    real_id?: string;
    title: string;
    category: string;
    file_url: string;
    file_name: string;
    file_size: number;
    show_on_landing: boolean;
    sort_order: number;
    created_at: string;
    audience?: string | null;
    folder_audience?: string | null;
    is_upload_doc?: boolean;
}

export const INFORMASI_DIVISIONS = ['Akademik', 'Kesiswaan', 'Keasramaan', 'Umum'] as const;

const ROLE_NAME_MAP: Record<string, string> = {
    AKADEMIK: 'Akademik',
    KESISWAAN: 'Kesiswaan',
    KEASRAMAAN: 'Keasramaan',
    HUMAS: 'Umum',
    SARPRAS: 'Umum',
    UMUM: 'Umum',
    WKM_AKADEMIK: 'Akademik',
    WKM_KESISWAAN: 'Kesiswaan',
    WKM_KEASRAMAAN: 'Keasramaan',
    WKM_HUMAS: 'Umum',
    UNGGAHAN: 'Dokumen Unggahan',
    'DOKUMEN UNGGAHAN': 'Dokumen Unggahan',
};

export function parseInformasiCategory(category: string): { division: string; folder: string } {
    const raw = category || '';
    const match = raw.match(/^\[([^\]]+)\]\s*(.+)$/);
    if (match) {
        const rawDiv = match[1].trim().toUpperCase();
        return { division: ROLE_NAME_MAP[rawDiv] || match[1].trim(), folder: match[2].trim() };
    }
    for (const div of INFORMASI_DIVISIONS) {
        if (raw.toUpperCase().startsWith(div.toUpperCase() + ' - ')) {
            return { division: div, folder: raw.substring(div.length + 3) };
        }
    }
    return { division: 'Akademik', folder: raw };
}

export function isVisibleTo(audience: string | null | undefined, roleSet: Set<string>): boolean {
    const aud = (audience || 'umum').toLowerCase();
    if (aud === 'none') return false;
    if (roleSet.has('all')) return true;
    if (aud === 'umum') return true;
    return roleSet.has(aud);
}

interface GetDocsOptions {
    category?: string | null;
    roleSet?: Set<string>;
    isAdminView?: boolean;
}

export async function getInformasiDocuments({
    category,
    roleSet = new Set<string>(),
    isAdminView = false,
}: GetDocsOptions): Promise<InformasiDoc[]> {
    const whereCondition: any = {};
    if (category) whereCondition.category = category;
    if (!isAdminView) {
        whereCondition.OR = [
            { show_on_landing: true },
            { show_on_landing: null }
        ];
    }

    const data = await prisma.informasi_akademik.findMany({
        where: whereCondition,
        orderBy: { sort_order: 'asc' }
    });

    let allData: InformasiDoc[] = data.map((d) => ({
        id: d.id,
        title: d.title,
        category: d.category,
        file_url: d.file_url,
        file_name: d.file_name,
        file_size: d.file_size ? Number(d.file_size) : 0,
        show_on_landing: d.show_on_landing ?? true,
        sort_order: d.sort_order,
        created_at: d.created_at ? d.created_at.toISOString() : new Date().toISOString(),
        audience: d.audience
    }));

    if (!isAdminView) {
        allData = allData.filter(d => isVisibleTo(d.audience, roleSet));
    }

    {
        const categories = await prisma.upload_categories.findMany({
            select: { id: true, name: true, audience: true }
        });

        if (categories && categories.length > 0) {
            const catIds = categories.map(c => c.id);
            const uploads = await prisma.uploaded_documents.findMany({
                where: { category_id: { in: catIds } }
            });

            if (uploads) {
                const catMap = categories.reduce((acc: any, c: any) => {
                    acc[c.id] = c;
                    return acc;
                }, {} as any);

                let mappedUploads: InformasiDoc[] = uploads.map((u: any) => {
                    const catAudience = catMap[u.category_id]?.audience || 'none';
                    const fileAudience = catAudience === 'none' ? 'none' : (u.audience || catAudience);
                    return {
                        id: `upload_${u.id}`,
                        real_id: u.id,
                        title: u.file_name,
                        category: `[Unggahan] ${u.category_name}`,
                        file_url: u.file_url,
                        file_name: u.file_name,
                        file_size: u.file_size ? Number(u.file_size) : 0,
                        show_on_landing: String(fileAudience).toLowerCase() === 'umum',
                        sort_order: 9999,
                        created_at: u.created_at ? u.created_at.toISOString() : new Date().toISOString(),
                        is_upload_doc: true,
                        audience: fileAudience,
                        folder_audience: catAudience,
                    };
                });

                if (!isAdminView) {
                    mappedUploads = mappedUploads.filter(u => isVisibleTo(u.audience, roleSet));
                }
                if (category) {
                    mappedUploads = mappedUploads.filter(u => u.category === category);
                }

                allData = [...allData, ...mappedUploads];
            }
        }
    }

    return allData;
}
