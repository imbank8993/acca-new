import { NextRequest, NextResponse } from 'next/server';
import { ListObjectsV2Command } from '@aws-sdk/client-s3';
import { requireAuditAdmin } from '@/lib/audit-admin';
import { auditR2, validR2Key } from '@/lib/audit-r2';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
    const denied = await requireAuditAdmin(request); if (denied) return denied;
    let prefix = request.nextUrl.searchParams.get('prefix') || '';
    if (prefix && !prefix.endsWith('/')) prefix += '/';
    const cursor = request.nextUrl.searchParams.get('cursor') || undefined;
    if (!validR2Key(prefix) || (cursor && cursor.length > 4096)) return NextResponse.json({ ok: false, error: 'Folder tidak valid.' }, { status: 400 });
    try {
        const { bucket, client } = await auditR2();
        try {
            const result = await client.send(new ListObjectsV2Command({ Bucket: bucket, Prefix: prefix, Delimiter: '/', MaxKeys: 100, ContinuationToken: cursor }), { abortSignal: AbortSignal.timeout(15000) });
            return NextResponse.json({ ok: true, bucket, prefix,
                folders: (result.CommonPrefixes || []).flatMap(item => item.Prefix ? [{ key: item.Prefix, name: item.Prefix.slice(prefix.length).replace(/\/$/, '') }] : []),
                files: (result.Contents || []).filter(item => item.Key && item.Key !== prefix && !item.Key.endsWith('/')).map(item => ({ key: item.Key, name: item.Key!.slice(prefix.length), size: item.Size || 0, modified: item.LastModified?.toISOString() || null })),
                nextCursor: result.NextContinuationToken || null,
            }, { headers: { 'Cache-Control': 'private, no-store' } });
        } finally { client.destroy(); }
    } catch {
        return NextResponse.json({ ok: false, error: 'Daftar dokumen Cloudflare belum dapat dimuat. Periksa konfigurasi penyimpanan atau coba lagi.' }, { status: 503 });
    }
}
