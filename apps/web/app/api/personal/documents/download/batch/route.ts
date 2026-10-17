import { NextRequest, NextResponse } from 'next/server';
import JSZip from 'jszip';
import { extractRequestToken, verifyAppSession } from '@/lib/app-jwt';
import { nestFetchAsUser } from '@/lib/nest-api';

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const idsStr = searchParams.get('ids');

        if (!idsStr) {
            return NextResponse.json({ ok: false, error: 'ID dokumen diperlukan' }, { status: 400 });
        }

        const token = extractRequestToken(request);
        const claims = token ? await verifyAppSession(token) : null;
        if (!claims?.sub) {
            return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
        }

        // Fetch documents metadata via NestJS
        const { body } = await nestFetchAsUser(`/personal/documents?ids=${idsStr}`, token!);
        const documents: any[] = body?.data || [];

        if (!documents.length) {
            return NextResponse.json({ ok: false, error: 'Dokumen tidak ditemukan' }, { status: 404 });
        }

        const zip = new JSZip();
        await Promise.all(documents.map(async (doc: any) => {
            try {
                const res = await fetch(doc.file_url);
                if (res.ok) {
                    zip.file(doc.judul, await res.arrayBuffer());
                }
            } catch (err) {
                console.error(`Failed to fetch file ${doc.judul}:`, err);
            }
        }));

        const content = await zip.generateAsync({ type: 'arraybuffer' });
        return new Response(content, {
            headers: {
                'Content-Type': 'application/zip',
                'Content-Disposition': `attachment; filename="batch_download_${Date.now()}.zip"`,
            },
        });
    } catch (error: any) {
        return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }
}
