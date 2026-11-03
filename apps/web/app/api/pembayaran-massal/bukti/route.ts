import { NextRequest, NextResponse } from 'next/server';
import { extractRequestToken } from '@/lib/app-jwt';
export const dynamic = 'force-dynamic';
export async function GET(req: NextRequest) {
    const token = extractRequestToken(req);
    if (!token) return NextResponse.json({ error: 'Silakan masuk kembali.' }, { status: 401 });
    const id = req.nextUrl.searchParams.get('id') || '';
    if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: 'Bukti tidak valid.' }, { status: 400 });
    try {
        const base = process.env.NEXT_PUBLIC_NEST_API_URL || 'http://127.0.0.1:3007/api';
        const result = await fetch(`${base}/pembayaran-massal/bukti?id=${encodeURIComponent(id)}`, { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store', signal: AbortSignal.timeout(30000) });
        if (!result.ok) return NextResponse.json({ error: 'Bukti tidak tersedia atau akses ditolak.' }, { status: result.status });
        const mime = result.headers.get('content-type')?.split(';')[0] || '';
        if (!['image/png', 'image/jpeg', 'image/webp'].includes(mime)) return NextResponse.json({ error: 'Format bukti tidak valid.' }, { status: 502 });
        return new NextResponse(await result.arrayBuffer(), { headers: { 'Content-Type': mime, 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff', 'Content-Disposition': 'inline' } });
    } catch { return NextResponse.json({ error: 'Gagal memuat bukti.' }, { status: 502 }); }
}
