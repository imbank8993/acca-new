import { NextRequest, NextResponse } from 'next/server';
import { corsResponse, handleOptions } from '@/lib/cors';
import { uploadFile } from '@/lib/storage';

export async function POST(req: NextRequest) {
    try {
        const formData = await req.formData();
        const file = formData.get('file') as File;

        if (!file) {
            return NextResponse.json({ error: 'File tidak ditemukan' }, { status: 400 });
        }

        // Get buffer from file
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        // Check size (10MB)
        if (buffer.length > 10 * 1024 * 1024) {
            return NextResponse.json({ error: 'Ukuran file melebihi 10MB' }, { status: 400 });
        }

        // Upload using unified handler
        const result = await uploadFile(buffer, file.name, 'tugas-siswa');

        if (result.ok) {
            return corsResponse(NextResponse.json({
                ok: true,
                publicUrl: result.file_url,
                fileName: file.name
            }));
        } else {
            return corsResponse(NextResponse.json({
                ok: false,
                error: result.error || 'Upload gagal'
            }, { status: 500 }));
        }

    } catch (error: any) {
        console.error('Upload Error', error);
        return corsResponse(NextResponse.json({ ok: false, error: error.message }, { status: 500 }));
    }
}

export async function OPTIONS() {
    return handleOptions();
}