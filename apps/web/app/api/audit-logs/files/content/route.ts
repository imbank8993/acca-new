import { NextRequest, NextResponse } from 'next/server';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import { requireAuditAdmin } from '@/lib/audit-admin';
import { auditR2, validR2Key } from '@/lib/audit-r2';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
    const denied = await requireAuditAdmin(request); if (denied) return denied;
    const key = request.nextUrl.searchParams.get('key') || '';
    const range = request.headers.get('range') || undefined;
    if (!key || !validR2Key(key) || (range && !/^bytes=(?:\d+-\d*|-\d+)$/.test(range))) return NextResponse.json({ ok: false, error: 'Berkas tidak valid.' }, { status: 400 });
    let client: Awaited<ReturnType<typeof auditR2>>['client'] | undefined;
    try {
        const config = await auditR2(); client = config.client;
        const result = await client.send(new GetObjectCommand({ Bucket: config.bucket, Key: key, Range: range }), { abortSignal: request.signal });
        if (!result.Body) { client.destroy(); return NextResponse.json({ ok: false, error: 'Berkas tidak ditemukan.' }, { status: 404 }); }
        const mime = (result.ContentType || 'application/octet-stream').split(';')[0];
        const inline = ['application/pdf','image/png','image/jpeg','image/webp','image/gif','text/plain'].includes(mime) && request.nextUrl.searchParams.get('download') !== '1';
        const headers = new Headers({ 'Content-Type': mime, 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': "sandbox; default-src 'none'; frame-ancestors 'self'", 'Accept-Ranges': 'bytes',
            'Content-Disposition': `${inline ? 'inline' : 'attachment'}; filename*=UTF-8''${encodeURIComponent(key.split('/').pop() || 'dokumen').replace(/['()*]/g, char => '%' + char.charCodeAt(0).toString(16))}` });
        if (result.ContentLength !== undefined) headers.set('Content-Length', String(result.ContentLength));
        if (result.ContentRange) headers.set('Content-Range', result.ContentRange);
        const reader = result.Body.transformToWebStream().getReader();
        const connection = client;
        const stream = new ReadableStream({
            async pull(controller) { try { const chunk = await reader.read(); if (chunk.done) { controller.close(); connection.destroy(); } else controller.enqueue(chunk.value); } catch (error) { controller.error(error); connection.destroy(); } },
            async cancel() { try { await reader.cancel(); } finally { connection.destroy(); } },
        });
        return new Response(stream, { status: result.ContentRange ? 206 : 200, headers });
    } catch (error: any) {
        client?.destroy();
        const status = error?.$metadata?.httpStatusCode;
        return NextResponse.json({ ok: false, error: status === 416 ? 'Rentang berkas tidak tersedia.' : 'Berkas belum dapat dibuka.' }, { status: status === 404 || status === 416 ? status : 503, headers: { 'Cache-Control': 'private, no-store' } });
    }
}
