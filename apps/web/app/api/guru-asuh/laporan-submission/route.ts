import { NextRequest, NextResponse } from 'next/server';
import { extractRequestToken } from '@/lib/app-jwt';
import { nestFetchAsUser } from '@/lib/nest-api';
import { notifGuruAsuhWa } from '@/lib/wa-guru-asuh';

export const dynamic = 'force-dynamic';

async function proxy(request: NextRequest, path: string, init?: RequestInit) {
    const token = extractRequestToken(request);
    if (!token) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });

    const { status, body } = await nestFetchAsUser(path, token, init);
    if (status !== 200 && status !== 201) {
        return NextResponse.json({ ok: false, error: body?.message || body?.error || 'Permintaan gagal' }, { status });
    }
    return NextResponse.json(body);
}

export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    return proxy(request, `/guru-asuh/laporan-submission${searchParams.toString() ? '?' + searchParams.toString() : ''}`);
}

export async function POST(request: NextRequest) {
    const body = await request.json();
    const token = extractRequestToken(request);
    if (!token) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });

    const { status, body: resBody } = await nestFetchAsUser('/guru-asuh/laporan-submission', token, {
        method: 'POST',
        body: JSON.stringify(body),
    });

    if (status !== 200 && status !== 201) {
        return NextResponse.json(
            { ok: false, error: resBody?.message || resBody?.error || 'Permintaan gagal' },
            { status }
        );
    }

    // Kirim notifikasi WhatsApp ke approver setelah pengajuan berhasil disimpan
    if (resBody?.ok && resBody?.data) {
        try {
            const { getApiUser } = await import('@/lib/api-auth');
            const userCaller = await getApiUser(request).catch(() => null);
            await notifGuruAsuhWa('diajukan', resBody.data, { ...body, userCaller });
        } catch (e: any) {
            console.error('[WA guru-asuh] Gagal mengirim notifikasi:', e?.message || e);
        }
    }

    return NextResponse.json(resBody);
}

export async function DELETE(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    return proxy(request, `/guru-asuh/laporan-submission?id=${encodeURIComponent(id || '')}`, { method: 'DELETE' });
}
