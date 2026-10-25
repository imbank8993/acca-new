import { NextRequest, NextResponse } from 'next/server';
import { nestFetchAsUser } from '@/lib/nest-api';
import { fetchSafeFile } from '@/lib/proxy-guard';

export const dynamic = 'force-dynamic';

/** Public preview of a verified, published letter. Storage URLs come only from its record. */
export async function GET(request: NextRequest) {
    const id = (request.nextUrl.searchParams.get('id') || '').replace(/^SRT-/i, '');
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
        return NextResponse.json({ error: 'ID surat tidak valid' }, { status: 400 });
    }
    try {
        const { status, body } = await nestFetchAsUser(`/surat/verify?letter_id=${encodeURIComponent(id)}`, '');
        const letter = body?.surat || body?.letter;
        if (status !== 200 || !body?.ok || !letter) {
            return NextResponse.json({ error: 'Surat tidak ditemukan' }, { status: status >= 500 ? 502 : 404 });
        }
        if (body.valid !== true || !['FINAL', 'ACTIVE', 'VALID'].includes(letter.status)) {
            return NextResponse.json({ error: 'Surat belum dipublikasikan' }, { status: 403 });
        }
        if (!letter.file_url) return NextResponse.json({ error: 'Berkas surat belum tersedia' }, { status: 404 });
        let fileUrl = letter.file_url;
        const storage = new URL(fileUrl);
        if (storage.hostname === 'drive.google.com') {
            const driveId = storage.pathname.match(/\/file\/d\/([\w-]+)/)?.[1] || storage.searchParams.get('id');
            if (driveId && /^[\w-]+$/.test(driveId)) fileUrl = `https://drive.google.com/uc?export=download&id=${driveId}`;
        }
        const upstream = await fetchSafeFile(fileUrl);
        if (!upstream.ok) return NextResponse.json({ error: 'Berkas surat gagal dimuat' }, { status: 502 });
        const bytes = await upstream.arrayBuffer();
        if (new TextDecoder().decode(bytes.slice(0, 5)) !== '%PDF-') {
            return NextResponse.json({ error: 'Berkas surat bukan PDF yang valid' }, { status: 422 });
        }
        const disposition = request.nextUrl.searchParams.get('download') === '1' ? 'attachment' : 'inline';
        return new NextResponse(bytes, { headers: {
            'Content-Type': 'application/pdf',
            'Content-Disposition': `${disposition}; filename="surat-${id}.pdf"`,
            'Cache-Control': 'private, no-store',
            'X-Content-Type-Options': 'nosniff',
            'X-Robots-Tag': 'noindex, nofollow',
        } });
    } catch {
        return NextResponse.json({ error: 'Pratinjau belum dapat dimuat. Silakan coba lagi.' }, { status: 502 });
    }
}
