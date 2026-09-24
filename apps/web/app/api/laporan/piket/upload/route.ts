import { NextRequest, NextResponse } from 'next/server';
import { extractRequestToken } from '@/lib/app-jwt';
import { getApiUser } from '@/lib/api-auth';
import { POST as mainUploadPOST } from '@/app/api/upload/route';

export async function POST(req: NextRequest) {
    try {
        const token = extractRequestToken(req);
        if (!token) {
            return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
        }

        const user = await getApiUser(req);
        if (!user) {
            return NextResponse.json({ ok: false, error: 'Token tidak valid' }, { status: 401 });
        }

        return await mainUploadPOST(req);
    } catch (error: any) {
        console.error('Upload Error', error);
        return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }
}