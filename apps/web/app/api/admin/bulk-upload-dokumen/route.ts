import { NextRequest, NextResponse } from 'next/server';
import { extractRequestToken } from '@/lib/app-jwt';
import { nestFetchAsUser } from '@/lib/nest-api';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
    try {
        const token = extractRequestToken(request);
        if (!token) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });

        // Forward multipart form data or json body
        const contentType = request.headers.get('content-type') || '';
        let requestBody: BodyInit;
        let isFormData = contentType.includes('multipart/form-data');

        if (isFormData) {
            requestBody = await request.formData();
        } else {
            const jsonText = await request.text();
            requestBody = jsonText;
        }

        const { status, body } = await nestFetchAsUser('/dokumen/bulk-upload', token, {
            method: 'POST',
            body: requestBody as any,
            duplex: 'half'
        } as any);

        return NextResponse.json(body, { status });
    } catch (error: any) {
        return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }
}