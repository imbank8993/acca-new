import { NextRequest, NextResponse } from 'next/server';
import { extractRequestToken } from '@/lib/app-jwt';
import { nestFetchAsUser } from '@/lib/nest-api';

export const dynamic = 'force-dynamic';

async function proxy(request: NextRequest, path: string, init?: RequestInit) {
    const token = extractRequestToken(request);
    if (!token) {
        return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }

    const { status, body } = await nestFetchAsUser(path, token, init);
    if (status !== 200 && status !== 201) {
        return NextResponse.json(
            { ok: false, error: body?.message || 'Permintaan gagal' },
            { status }
        );
    }
    return NextResponse.json(body);
}

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const query = new URLSearchParams();
    
    const aktif = searchParams.get('aktif');
    if (aktif !== null) query.set('aktif', aktif);
    
    const path = `/ekskul${query.toString() ? '?' + query.toString() : ''}`;
    return proxy(request, path);
}

export async function POST(request: NextRequest) {
    const body = await request.json();
    return proxy(request, '/ekskul', { method: 'POST', body: JSON.stringify(body) });
}

export async function DELETE(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) return NextResponse.json({ ok: false, error: 'ID is required' }, { status: 400 });

    // `confirm` diteruskan: menghapus ekskul ikut menghapus peserta, pembina,
    // pertemuan, absensi, dan laporannya lewat FK cascade, jadi API menolak
    // permintaan pertama dan menjelaskan apa yang akan hilang.
    const confirm = searchParams.get('confirm');
    const query = new URLSearchParams({ id });
    if (confirm) query.set('confirm', confirm);

    return proxy(request, `/ekskul?${query.toString()}`, { method: 'DELETE' });
}