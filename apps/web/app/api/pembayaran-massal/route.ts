import { NextRequest, NextResponse } from 'next/server';
import { extractRequestToken } from '@/lib/app-jwt';
import { nestFetchAsUser } from '@/lib/nest-api';
export const dynamic = 'force-dynamic';
export const maxDuration = 90;
export async function GET(req: NextRequest) {
    const token = extractRequestToken(req);
    if (!token) return NextResponse.json({ error: 'Silakan masuk kembali.' }, { status: 401 });
    const result = await nestFetchAsUser(req.nextUrl.searchParams.get('action') === 'evidence' ? '/pembayaran-massal/evidence?' + new URLSearchParams({ month: req.nextUrl.searchParams.get('month') || '0', year: req.nextUrl.searchParams.get('year') || '0' }).toString() : '/pembayaran-massal?' + req.nextUrl.searchParams.toString(), token);
    return NextResponse.json(result.body, { status: result.status });
}
export async function POST(req: NextRequest) {
    const token = extractRequestToken(req);
    if (!token) return NextResponse.json({ error: 'Silakan masuk kembali.' }, { status: 401 });
    let input: any;
    try { input = await req.json(); } catch { return NextResponse.json({ error: 'Data tidak valid.' }, { status: 400 }); }
    if (!['analyze', 'apply'].includes(input.action)) return NextResponse.json({ error: 'Tindakan tidak valid.' }, { status: 400 });
    const result = await nestFetchAsUser('/pembayaran-massal/' + input.action, token, { method: 'POST', body: JSON.stringify(input) });
    return NextResponse.json(result.body, { status: result.status });
}
