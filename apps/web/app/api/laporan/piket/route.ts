import { proxy } from '@/lib/nest-proxy';
import { NextRequest, NextResponse } from 'next/server';
import { extractRequestToken } from '@/lib/app-jwt';
import { nestFetchAsUser } from '@/lib/nest-api';
import { sendWhatsAppPiket } from '@/lib/whatsapp-piket';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
    const search = request.nextUrl.search;
    return proxy(request, '/laporan-piket' + search);
}

export async function POST(request: NextRequest) {
    const body = await request.json();
    const token = extractRequestToken(request);
    if (!token) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });

    const { status, body: resBody } = await nestFetchAsUser('/laporan-piket', token, {
        method: 'POST',
        body: JSON.stringify(body),
    });

    if (status !== 200 && status !== 201) {
        return NextResponse.json(
            { ok: false, error: resBody?.message || resBody?.error || 'Permintaan gagal' },
            { status }
        );
    }

    // Call WhatsApp logic here
    let waResult: { ok: boolean; status: string; error?: string } | null = null;
    try {
        const { details, guruPiket, keteranganTambahan, timestamp } = body;
        const piketDate = body.piketDate || body.tanggal || new Date().toISOString().split('T')[0];
        
        let jams: string[] = [];
        if (details && Array.isArray(details)) {
            jams = [...new Set(details.map((d: any) => String(d.jam_ke)))];
            jams.sort((a: string, b: string) => parseInt(a) - parseInt(b));
        }
        const jamDisplay = jams.length > 0 ? jams.join(', ') : (body.jamPiket ? String(body.jamPiket) : '');

        const waData = {
            piketId: resBody?.data?.id || 0,
            guruPiket,
            piketDate,
            jamPiket: jamDisplay,
            keteranganTambahan: keteranganTambahan || '',
            details,
            timestamp: timestamp || Date.now()
        };
        waResult = await sendWhatsAppPiket(waData);
    } catch (e: any) {
        console.error('WhatsApp Error:', e);
        waResult = { ok: false, status: 'failed', error: e?.message || 'Gagal mengirim notifikasi WhatsApp' };
    }

    return NextResponse.json({
        ...resBody,
        wa: waResult
    });
}

export async function PATCH(request: NextRequest) {
    const token = extractRequestToken(request);
    if (!token) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const { status, body: resBody } = await nestFetchAsUser('/laporan-piket', token, {
        method: 'PATCH',
        body: JSON.stringify(body),
    });
    return NextResponse.json(resBody, { status });
}

export async function DELETE(request: NextRequest) {
    const token = extractRequestToken(request);
    if (!token) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });

    const search = request.nextUrl.search;
    const { status, body: resBody } = await nestFetchAsUser('/laporan-piket' + search, token, {
        method: 'DELETE',
    });
    return NextResponse.json(resBody, { status });
}
