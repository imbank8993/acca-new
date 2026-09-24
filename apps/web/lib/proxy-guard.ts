import { NextResponse } from 'next/server';
import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import http from 'node:http';
import https from 'node:https';
import { nestFetch } from './nest-api';
const MAX_BYTES = 25 * 1024 * 1024;
export function isPublicAddress(address: string): boolean {
    const ip = address.toLowerCase().replace(/^\[|\]$/g, '');
    if (isIP(ip) === 4) {
        const [a, b] = ip.split('.').map(Number);
        return !(a === 0 || a === 10 || a === 127 || a >= 224 || (a === 169 && b === 254) ||
            (a === 172 && b >= 16 && b <= 31) || (a === 192 && (b === 168 || b === 0)) ||
            (a === 100 && b >= 64 && b <= 127) || (a === 198 && (b === 18 || b === 19)));
    }
    // Accept only global unicast IPv6; mapped/private/link-local addresses fail closed.
    return isIP(ip) === 6 && /^[23][0-9a-f]{3}:/.test(ip) && !ip.startsWith('2001:db8:');
}
export function isSafeProxyUrl(value: string): boolean {
    try {
        const u = new URL(value);
        const host = u.hostname.replace(/^\[|\]$/g, '');
        return ['https:', 'http:'].includes(u.protocol) && !u.username && !u.password &&
            (!u.port || ['80', '443'].includes(u.port)) &&
            (isIP(host) ? isPublicAddress(host) : host.includes('.') && !/\.(localhost|local|internal)\.?$/i.test(host));
    }
    catch {
        return false;
    }
}
export function isSafeContentType(type: string | null): boolean {
    const mime = (type || '').split(';')[0].trim().toLowerCase();
    return [
        'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/avif', 'image/bmp',
        'application/pdf', 'application/octet-stream', 'application/zip',
        'application/x-rar-compressed', 'application/vnd.rar', 'application/x-7z-compressed',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/msword',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.ms-powerpoint',
        'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        'text/plain', 'text/csv'
    ].includes(mime);
}
async function allowedHosts(): Promise<Set<string>> {
    const urls = [
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.R2_PUBLIC_BASE_URL,
        ...(process.env.FILE_PROXY_ALLOWED_HOSTS || '').split(',')
    ];
    try {
        const { status, body } = await nestFetch('/site-settings/file-storage-config?all=true');
        if (status === 200 && Array.isArray(body?.data)) {
            for (const c of body.data) {
                urls.push(c.hosting_url, c.cloudflare_public_url, c.cloudflare_cdn_domain);
            }
        }
    } catch {
        // Abaikan jika nestFetch gagal, tetap gunakan default hosts & env
    }
    const hosts = new Set<string>([
        'drive.google.com',
        'drive.usercontent.google.com',
        'lh3.googleusercontent.com',
        'tiny-field-c83e.imbank8993.workers.dev',
        'pub-9d76a587705d4820b095036b2064e29a.r2.dev',
        'file.icgowa.sch.id',
    ]);
    for (const value of urls) {
        if (value) {
            try {
                hosts.add(new URL(value.includes('://') ? value : `https://${value}`).hostname.toLowerCase());
            } catch { }
        }
    }
    return hosts;
}
/** Resolve once and pin the socket to that validated address (prevents DNS rebinding). */
export async function fetchSafeFile(value: string): Promise<Response> {
    const hosts = await allowedHosts();
    let url = new URL(value);
    const deadline = Date.now() + 15000;
    for (let hop = 0; hop <= 4; hop++) {
        if (!isSafeProxyUrl(url.href) || !hosts.has(url.hostname.toLowerCase()))
            throw new Error('Sumber berkas tidak diizinkan');
        const remaining = deadline - Date.now();
        if (remaining <= 0)
            throw new Error('Waktu unduh habis');
        const addresses = await Promise.race([
            lookup(url.hostname, { all: true, verbatim: true }),
            new Promise<never>((_, reject) => { const t = setTimeout(() => reject(new Error('DNS timeout')), remaining); t.unref(); }),
        ]);
        if (!addresses.length || addresses.some(a => !isPublicAddress(a.address)))
            throw new Error('Alamat jaringan tidak diizinkan');
        const chosen = addresses[0];
        const customLookup = (_h: string, opts: any, cb: any) => {
            if (typeof opts === 'function') {
                cb = opts;
                opts = {};
            }
            if (opts && opts.all) {
                cb(null, [{ address: chosen.address, family: chosen.family }]);
            } else {
                cb(null, chosen.address, chosen.family);
            }
        };
        const response = await new Promise<Response>((resolve, reject) => {
            const request = (url.protocol === 'https:' ? https : http).request(url, {
                method: 'GET',
                headers: { Accept: '*/*', 'Accept-Encoding': 'identity' },
                lookup: customLookup as any,
            }, incoming => {
                const headers = new Headers();
                for (const [k, v] of Object.entries(incoming.headers))
                    if (v !== undefined)
                        headers.set(k, Array.isArray(v) ? v.join(', ') : v);
                const status = incoming.statusCode || 502;
                if (status >= 300 && status < 400) {
                    incoming.destroy();
                    resolve(new Response(null, { status, headers }));
                    return;
                }
                const incomingType = headers.get('content-type');
                if (incomingType && !isSafeContentType(incomingType)) {
                    incoming.destroy();
                    reject(new Error('Jenis berkas tidak diizinkan'));
                    return;
                }
                if (Number(headers.get('content-length')) > MAX_BYTES) {
                    incoming.destroy();
                    reject(new Error('Berkas terlalu besar'));
                    return;
                }
                let size = 0;
                const chunks: Buffer[] = [];
                incoming.on('data', (chunk: Buffer) => {
                    size += chunk.length;
                    if (size > MAX_BYTES) {
                        request.destroy(new Error('Berkas terlalu besar'));
                    } else {
                        chunks.push(chunk);
                    }
                });
                incoming.on('error', reject);
                incoming.on('end', () => resolve(new Response(Buffer.concat(chunks), { status, headers })));
            });
            const timer = setTimeout(() => request.destroy(new Error('Waktu unduh habis')), Math.max(1, deadline - Date.now()));
            request.on('close', () => clearTimeout(timer));
            request.on('error', reject);
            request.end();
        });
        if (response.status >= 300 && response.status < 400) {
            const location = response.headers.get('location');
            if (!location)
                throw new Error('Redirect tidak valid');
            url = new URL(location, url);
            continue;
        }
        if (!response.ok)
            throw new Error('Berkas tidak dapat diunduh');
        return response;
    }
    throw new Error('Terlalu banyak redirect');
}
export function buildSafeProxyResponse(res: Response, blob: Blob): NextResponse {
    const type = res.headers.get('content-type') || 'application/octet-stream';
    if (!isSafeContentType(type))
        throw new Error('Jenis berkas tidak diizinkan');
    return new NextResponse(blob, { headers: { 'Content-Type': type, 'Cache-Control': 'private, max-age=3600',
            'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': "default-src 'none'; sandbox",
            'Content-Disposition': type.startsWith('image/') || type.startsWith('application/pdf') ? 'inline' : 'attachment' } });
}
