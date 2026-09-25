import { NextRequest, NextResponse } from 'next/server';
import { extractRequestToken } from '@/lib/app-jwt';
import { nestFetchAsUser } from '@/lib/nest-api';
import { getApiUser } from '@/lib/api-auth';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
    try {
        const token = extractRequestToken(req);
        const { searchParams } = new URL(req.url);
        const profilId = searchParams.get('profil_id');
        const query = profilId ? `?profil_id=${encodeURIComponent(profilId)}` : '';

        const { status, body } = await nestFetchAsUser(`/surat/config${query}`, token, {
            method: 'GET',
            cache: 'no-store',
        });

        return NextResponse.json(body || { ok: false, error: 'Failed to fetch config' }, { status });
    } catch (error: any) {
        console.error('Get Config Surat Error:', error);
        return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }
}

export async function PUT(req: NextRequest) {
    try {
        const user = await getApiUser(req);
        if (!user) {
            return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
        }
        if (!user.isAdmin) {
            return NextResponse.json({ ok: false, error: 'Hanya administrator yang diizinkan mengubah konfigurasi surat' }, { status: 403 });
        }

        const token = extractRequestToken(req);
        const body = await req.json();

        const { status, body: nestBody } = await nestFetchAsUser('/surat/config', token, {
            method: 'PUT',
            body: JSON.stringify(body),
            cache: 'no-store',
        });

        return NextResponse.json(nestBody || { ok: false, error: 'Failed to update config' }, { status });
    } catch (error: any) {
        console.error('Update Config Surat Error:', error);
        return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    try {
        const user = await getApiUser(req);
        if (!user) {
            return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
        }
        if (!user.isAdmin) {
            return NextResponse.json({ ok: false, error: 'Hanya administrator yang diizinkan membuat konfigurasi surat' }, { status: 403 });
        }

        const token = extractRequestToken(req);
        const body = await req.json();

        const { status, body: nestBody } = await nestFetchAsUser('/surat/config', token, {
            method: 'POST',
            body: JSON.stringify(body),
            cache: 'no-store',
        });

        return NextResponse.json(nestBody || { ok: false, error: 'Failed to create config' }, { status });
    } catch (error: any) {
        console.error('Create Config Surat Error:', error);
        return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }
}
