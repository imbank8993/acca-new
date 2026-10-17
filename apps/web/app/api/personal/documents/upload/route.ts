import { NextRequest, NextResponse } from 'next/server';
import { verifyAppSession, extractRequestToken } from '@/lib/app-jwt';
import { nestFetchAsUser } from '@/lib/nest-api';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
    try {
        const token = extractRequestToken(request);
        const claims = token ? await verifyAppSession(token) : null;

        if (!claims?.sub) {
            return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
        }

        const userId = parseInt(claims.sub, 10);
        const contentType = request.headers.get('content-type') || '';

        let fileInfo: {
            name: string;
            size: number;
            folderId: string | null;
            publicUrl: string;
        };

        if (contentType.includes('application/json')) {
            const body = await request.json();
            if (!body.publicUrl || !body.fileName) {
                return NextResponse.json({ ok: false, error: 'Missing metadata for direct upload' }, { status: 400 });
            }
            fileInfo = {
                name: body.fileName,
                size: body.fileSize || 0,
                folderId: body.folder_id || null,
                publicUrl: body.publicUrl
            };
        } else {
            const formData = await request.formData();
            const file = formData.get('file') as File;
            const folderId = formData.get('folder_id') as string | null;

            if (!file) {
                return NextResponse.json({ ok: false, error: 'File tidak ditemukan' }, { status: 400 });
            }

            // Skip physical upload, mock URL
            fileInfo = {
                name: file.name,
                size: file.size,
                folderId: folderId,
                publicUrl: `/uploads/mock/${Date.now()}_${file.name}`
            };
        }

        // Save metadata to personal_documents via NestJS
        const { status, body } = await nestFetchAsUser('/personal/documents', token!, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                user_id: userId,
                folder_id: fileInfo.folderId,
                judul: fileInfo.name,
                file_url: fileInfo.publicUrl,
                file_path: fileInfo.publicUrl,
                size: fileInfo.size,
                extension: fileInfo.name.split('.').pop()
            })
        });

        return NextResponse.json(body, { status });
    } catch (error: any) {
        console.error("Upload Error:", error);
        return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }
}