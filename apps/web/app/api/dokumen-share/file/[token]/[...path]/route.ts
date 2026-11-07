import { NextRequest, NextResponse } from 'next/server';
import { ensureAbsoluteUrl } from '@/lib/url';
import { getMimeTypeFromFileName, DEFAULT_MIME } from '@/lib/storage/mime';
import { resolveDokumenShareToken } from '@/lib/dokumen/share';
import { fetchSafeFile, isSafeProxyUrl, isSafeContentType } from '@/lib/proxy-guard';

export const runtime = 'nodejs';

/**
 * Proxy berkas untuk halaman link publik /dokumen-link/<token>.
 *
 * Sama dengan /api/informasi-akademik/share/file: pengunjung anonim tidak bisa
 * memakai /api/pdf-proxy yang ber-auth, dan route ini bukan proxy terbuka —
 * URL sumbernya diambil dari dokumen yang tercakup token aktif, lalu diunduh
 * lewat fetchSafeFile (whitelist domain, anti-SSRF, batas ukuran).
 *
 * Bentuk URL: /api/dokumen-share/file/<token>/<docId>/<nama-berkas>
 */
export async function GET(
    _request: NextRequest,
    { params }: { params: Promise<{ token: string; path: string[] }> }
) {
    try {
        const { token, path } = await params;
        const docId = decodeURIComponent(path?.[0] || '');
        if (!token || !docId) {
            return NextResponse.json({ error: 'Parameter tidak lengkap' }, { status: 400 });
        }

        const share = await resolveDokumenShareToken(token, { countView: false });
        const doc = share?.docs.find(d => d.id === docId);
        if (!share || !doc) {
            return NextResponse.json({ error: 'Link tidak berlaku' }, { status: 404 });
        }

        const absoluteUrl = ensureAbsoluteUrl(share.fileUrl);
        if (!isSafeProxyUrl(absoluteUrl)) {
            return NextResponse.json({ error: 'URL berkas tidak valid' }, { status: 400 });
        }

        let upstream: Response;
        try {
            upstream = await fetchSafeFile(absoluteUrl);
        } catch (fetchErr: any) {
            console.error('fetchSafeFile failed for dokumen share:', fetchErr.message);
            return NextResponse.json(
                { error: 'Berkas tidak dapat diproksi: periksa sumber, jenis, atau ukuran berkas' },
                { status: 400 }
            );
        }

        // Berkas lama sering tersimpan dengan content-type generik; pulihkan dari nama berkas.
        const upstreamType = upstream.headers.get('content-type') || '';
        const byExt = getMimeTypeFromFileName(doc.file_name || absoluteUrl.split('?')[0]);
        let contentType = (!upstreamType || upstreamType.startsWith(DEFAULT_MIME)) && byExt !== DEFAULT_MIME
            ? byExt
            : (upstreamType || DEFAULT_MIME);
        if (!isSafeContentType(contentType)) contentType = DEFAULT_MIME;

        const buffer = await upstream.arrayBuffer();
        const isInline = contentType.startsWith('image/') || contentType === 'application/pdf' || contentType.startsWith('text/html') || contentType === 'application/xhtml+xml';

        return new NextResponse(buffer, {
            status: 200,
            headers: {
                'Content-Type': contentType,
                'Content-Length': String(buffer.byteLength),
                'Content-Disposition': isInline ? 'inline' : 'attachment',
                'Cache-Control': 'private, max-age=3600',
                'Content-Security-Policy': "default-src 'none'; sandbox",
                'X-Content-Type-Options': 'nosniff',
                'X-Robots-Tag': 'noindex, nofollow',
            },
        });
    } catch (error: any) {
        console.error('GET dokumen share file error:', error);
        return NextResponse.json({ error: error.message || 'Terjadi kesalahan pada server' }, { status: 500 });
    }
}
