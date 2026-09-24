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
    
    const ekskul_id = searchParams.get('ekskul_id');
    const siswa_id = searchParams.get('siswa_id');
    const tahun_ajaran = searchParams.get('tahun_ajaran');
    const semester = searchParams.get('semester');
    const distinct = searchParams.get('distinct');

    if (ekskul_id) query.set('ekskul_id', ekskul_id);
    if (siswa_id) query.set('siswa_id', siswa_id);
    if (tahun_ajaran) query.set('tahun_ajaran', tahun_ajaran);
    if (semester) query.set('semester', semester);
    if (distinct) query.set('distinct', distinct);
    
    const path = `/ekskul/siswa${query.toString() ? '?' + query.toString() : ''}`;
    return proxy(request, path);
}

export async function POST(request: NextRequest) {
    const body = await request.json();
    return proxy(request, '/ekskul/siswa', { method: 'POST', body: JSON.stringify(body) });
}

export async function DELETE(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    
    if (!id) return NextResponse.json({ ok: false, error: 'ID is required' }, { status: 400 });
    
    return proxy(request, `/ekskul/siswa?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
}
