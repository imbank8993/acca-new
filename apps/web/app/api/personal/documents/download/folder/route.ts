import { NextRequest, NextResponse } from 'next/server';
import JSZip from 'jszip';
import { extractRequestToken, verifyAppToken } from '@/lib/app-jwt';
import { nestFetchAsUser } from '@/lib/nest-api';

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const folderId = searchParams.get('folder_id');

        if (!folderId) {
            return NextResponse.json({ ok: false, error: 'folder_id diperlukan' }, { status: 400 });
        }

        const token = extractRequestToken(request);
        const claims = token ? await verifyAppToken(token) : null;
        if (!claims?.sub) {
            return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
        }

        // Fetch folder & documents via NestJS
        const [folderRes, docsRes] = await Promise.all([
            nestFetchAsUser(`/personal/folders?id=${folderId}`, token!),
            nestFetchAsUser(`/personal/documents?folder_id=${folderId}`, token!),
        ]);

        const folder = folderRes.body?.data?.[0];
        const documents: any[] = docsRes.body?.data || [];

        if (!folder) {
            return NextResponse.json({ ok: false, error: 'Folder tidak ditemukan' }, { status: 404 });
        }
        if (!documents.length) {
            return NextResponse.json({ ok: false, error: 'Folder kosong' }, { status: 404 });
        }

        const zip = new JSZip();
        const folderZip = zip.folder(folder.nama || 'folder');
        await Promise.all(documents.map(async (doc: any) => {
            try {
                const res = await fetch(doc.file_url);
                if (res.ok && folderZip) {
                    folderZip.file(doc.judul, await res.arrayBuffer());
                }
            } catch (err) {
                console.error(`Failed to fetch file ${doc.judul}:`, err);
            }
        }));

        const content = await zip.generateAsync({ type: 'arraybuffer' });
        const folderName = folder.nama ? folder.nama.replace(/[^a-zA-Z0-9_\-]/g, '_') : 'folder';
        return new Response(content, {
            headers: {
                'Content-Type': 'application/zip',
                'Content-Disposition': `attachment; filename="${folderName}_${Date.now()}.zip"`,
            },
        });
    } catch (error: any) {
        return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }
}
