import { NextRequest, NextResponse } from 'next/server';
import { ensureAbsoluteUrl } from '@/lib/url';
import { getMimeTypeFromFileName, DEFAULT_MIME } from '@/lib/storage/mime';
import { resolveShareToken } from '@/lib/informasi/share';
import { fetchSafeFile, isSafeProxyUrl, isSafeContentType } from '@/lib/proxy-guard';

export const runtime = 'nodejs';

/**
 * Proxy berkas untuk halaman link publik /info-link/<token>.
 *
 * Mengapa tidak memakai /api/pdf-proxy: route itu ber-auth (middleware), jadi
 * pengunjung anonim selalu dapat 401 — dan membuka pdf-proxy untuk publik sama
 * saja menyediakan proxy terbuka ke URL sembarang.
 *
 * Di sini keamanan dijamin berlapis:
 * 1. Dokumen harus tercakup dalam token share publik yang aktif.
 * 2. URL berkas diverifikasi aman (bukan internal/private IP, no SSRF) via isSafeProxyUrl.
 * 3. Unduhan berkas dilakukan via fetchSafeFile (whitelist domain penyimpanan, DNS pinning anti-rebinding, batas ukuran).
 * 4. Header respons dilengkapi Sandbox CSP, nosniff, cache-control private, dan noindex.
 *
 * Bentuk URL: /api/informasi-akademik/share/file/<token>/<docId>/<nama-berkas>
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

        const share = await resolveShareToken(token, { countView: false });
        if (!share) {
            return NextResponse.json({ error: 'Link tidak berlaku' }, { status: 404 });
        }

        const doc = share.docs.find(d => d.id === docId);
        if (!doc || !doc.file_url || doc.file_url === '#') {
            return NextResponse.json({ error: 'Dokumen tidak ada dalam tautan ini' }, { status: 404 });
        }

        const absoluteUrl = ensureAbsoluteUrl(doc.file_url);
        if (!isSafeProxyUrl(absoluteUrl)) {
            return NextResponse.json({ error: 'URL berkas tidak valid' }, { status: 400 });
        }

        let upstream: Response;
        try {
            upstream = await fetchSafeFile(absoluteUrl);
        } catch (fetchErr: any) {
            console.error('fetchSafeFile failed for public share:', fetchErr.message);
            return NextResponse.json(
                { error: 'Berkas tidak dapat diproksi: periksa sumber, jenis, atau ukuran berkas' },
                { status: 400 }
            );
        }

        // Content-type sumber sering generik karena berkas lama diunggah tanpa tipe,
        // jadi dipulihkan dari nama berkas jika generik/kosong.
        const upstreamType = upstream.headers.get('content-type') || '';
        const byExt = getMimeTypeFromFileName(doc.file_name || absoluteUrl.split('?')[0]);
        let contentType = (!upstreamType || upstreamType.startsWith(DEFAULT_MIME)) && byExt !== DEFAULT_MIME
            ? byExt
            : (upstreamType || DEFAULT_MIME);

        if (!isSafeContentType(contentType)) {
            contentType = DEFAULT_MIME;
        }

        const buffer = await upstream.arrayBuffer();
        const isInline = contentType.startsWith('image/') || contentType === 'application/pdf';

        return new NextResponse(buffer, {
            status: 200,
            headers: {
                'Content-Type': contentType,
                'Content-Length': String(buffer.byteLength),
                'Content-Disposition': isInline ? 'inline' : 'attachment',
                // Berkas publik lewat token, tapi jangan sampai tersimpan di
                // cache bersama (proxy/CDN) di bawah URL bertoken.
                'Cache-Control': 'private, max-age=3600',
                'Content-Security-Policy': "default-src 'none'; sandbox",
                'X-Content-Type-Options': 'nosniff',
                'X-Robots-Tag': 'noindex, nofollow',
            },
        });
    } catch (error: any) {
        console.error('GET informasi share file error:', error);
        return NextResponse.json({ error: error.message || 'Terjadi kesalahan pada server' }, { status: 500 });
    }
}
