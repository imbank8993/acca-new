import { NextRequest, NextResponse } from 'next/server';
import { fetchSafeFile, buildSafeProxyResponse, isSafeProxyUrl } from '@/lib/proxy-guard';
import { ensureAbsoluteUrl } from '@/lib/url';
export const runtime = 'nodejs';
export async function GET(request: NextRequest) {
    const raw = request.nextUrl.searchParams.get('url');
    const url = raw ? ensureAbsoluteUrl(raw) : '';
    if (!isSafeProxyUrl(url)) return NextResponse.json({ ok:false,error:'URL berkas tidak valid' },{status:400});
    try {
        const response = await fetchSafeFile(url);
        return buildSafeProxyResponse(response, await response.blob());
    } catch {
        return NextResponse.json({ok:false,error:'Berkas tidak dapat diproksi: periksa sumber, jenis, dan ukuran berkas'},{status:400});
    }
}
