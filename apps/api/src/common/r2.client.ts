import { createHash, createHmac } from 'node:crypto';

/**
 * Klien S3 minimal untuk Cloudflare R2 (PUT & DELETE objek).
 *
 * Sengaja TIDAK memakai `@aws-sdk/client-s3`: paket itu hanya dideklarasikan di
 * apps/web (kebetulan ter-hoist ke node_modules root), dan menambahkannya ke
 * apps/api berarti menarik puluhan paket transitif hanya untuk dua operasi.
 * R2 menerima AWS Signature V4 biasa, dan `StorageService` sendiri sudah
 * berbicara dengan storage lewat `fetch` mentah — jadi menandatangani request
 * di sini konsisten dengan kode sekitarnya.
 *
 * Hanya single-part upload. Cukup untuk semua pemakai saat ini (batas foto
 * agenda 5MB); kalau nanti ada berkas ratusan MB, barulah multipart diperlukan.
 */

export interface R2Config {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
}

const SERVICE = 's3';
const REGION = 'auto';

function sha256Hex(data: string | Buffer): string {
  return createHash('sha256').update(data).digest('hex');
}

function hmac(key: string | Buffer, data: string): Buffer {
  return createHmac('sha256', key).update(data).digest();
}

/**
 * URI-encode sesuai aturan AWS: hanya A-Za-z0-9-._~ yang dibiarkan.
 * `encodeURIComponent` meloloskan `!'()*` padahal AWS mewajibkannya ter-encode —
 * kalau tidak, tanda tangan tidak cocok untuk nama berkas yang memuat karakter itu.
 */
function uriEncode(input: string, encodeSlash: boolean): string {
  let out = '';
  for (const ch of input) {
    if (/[A-Za-z0-9\-._~]/.test(ch)) {
      out += ch;
    } else if (ch === '/') {
      out += encodeSlash ? '%2F' : '/';
    } else {
      for (const byte of Buffer.from(ch, 'utf8')) {
        out += '%' + byte.toString(16).toUpperCase().padStart(2, '0');
      }
    }
  }
  return out;
}

function signingKey(secret: string, dateStamp: string): Buffer {
  const kDate = hmac(`AWS4${secret}`, dateStamp);
  const kRegion = hmac(kDate, REGION);
  const kService = hmac(kRegion, SERVICE);
  return hmac(kService, 'aws4_request');
}

/** Kirim satu request S3 bertanda tangan SigV4 ke R2. */
async function signedRequest(
  cfg: R2Config,
  method: 'PUT' | 'DELETE',
  key: string,
  body: Buffer | undefined,
  contentType?: string,
): Promise<{ error: Error | null }> {
  const host = `${cfg.accountId}.r2.cloudflarestorage.com`;
  const canonicalUri = `/${uriEncode(cfg.bucket, false)}/${uriEncode(key, false)}`;

  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, ''); // 20260916T101530Z
  const dateStamp = amzDate.slice(0, 8);
  const payloadHash = sha256Hex(body ?? '');

  // Header yang ditandatangani harus urut abjad dan sama persis dengan yang dikirim.
  const headers: Record<string, string> = {
    host,
    'x-amz-content-sha256': payloadHash,
    'x-amz-date': amzDate,
  };
  if (contentType) headers['content-type'] = contentType;

  const signedHeaderNames = Object.keys(headers).sort();
  const canonicalHeaders = signedHeaderNames.map((h) => `${h}:${headers[h].trim()}\n`).join('');
  const signedHeaders = signedHeaderNames.join(';');

  const canonicalRequest = [
    method,
    canonicalUri,
    '', // query string kosong
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join('\n');

  const scope = `${dateStamp}/${REGION}/${SERVICE}/aws4_request`;
  const stringToSign = [
    'AWS4-HMAC-SHA256',
    amzDate,
    scope,
    sha256Hex(canonicalRequest),
  ].join('\n');

  const signature = hmac(signingKey(cfg.secretAccessKey, dateStamp), stringToSign).toString('hex');

  const authorization =
    `AWS4-HMAC-SHA256 Credential=${cfg.accessKeyId}/${scope}, ` +
    `SignedHeaders=${signedHeaders}, Signature=${signature}`;

  try {
    const res = await fetch(`https://${host}${canonicalUri}`, {
      method,
      headers: { ...headers, Authorization: authorization },
      body: body as any,
    });

    // DELETE objek yang tidak ada dijawab 204 oleh S3/R2 — bukan kegagalan.
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      return { error: new Error(text || `${method} ${key} gagal dengan status ${res.status}`) };
    }
    return { error: null };
  } catch (err) {
    return { error: err as Error };
  }
}

export function r2PutObject(
  cfg: R2Config,
  key: string,
  body: Buffer,
  contentType: string,
): Promise<{ error: Error | null }> {
  return signedRequest(cfg, 'PUT', key, body, contentType);
}

export function r2DeleteObject(cfg: R2Config, key: string): Promise<{ error: Error | null }> {
  return signedRequest(cfg, 'DELETE', key, undefined);
}
