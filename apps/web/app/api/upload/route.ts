import { NextRequest, NextResponse } from 'next/server';
import https from 'https';
import crypto from 'crypto';
import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import { registerUpload, unregisterUpload } from '@/lib/storage/file-registry';
import { validatePrestasiUpload } from '@/lib/prestasi-upload';
import { getMimeTypeFromFileName } from '@/lib/storage/mime';

import { nestFetch } from '@/lib/nest-api';
import { extractRequestToken } from '@/lib/app-jwt';

// Masih dipakai HANYA untuk mengenali URL berkas lama yang tersimpan di Supabase
// Storage (lihat getStorageConfigForFile). Tidak ada lagi klien Supabase di sini:
// aplikasi tidak mengunggah maupun menghapus berkas di Supabase.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';

import { getApiUser } from '@/lib/api-auth';
import { nestFetchAsUser } from '@/lib/nest-api';

// Get file storage config from database (NestJS)
async function getFileStorageConfig() {
    const { status, body } = await nestFetch('/site-settings/file-storage-config');
    if (status === 200 && body?.data) {
        if (Array.isArray(body.data)) {
            return body.data.find((item: any) => item.is_active) || null;
        }
        return body.data;
    }
    return null;
}

async function getStorageConfigForFile(fileUrl: string) {
    const target = new URL(fileUrl);
    const { status, body } = await nestFetch('/site-settings/file-storage-config?all=true');
    if (status !== 200 || !Array.isArray(body?.data)) return null;
    const matchesBase = (base?: string) => {
        if (!base) return false;
        try {
            const parsed = new URL(base.includes('://') ? base : `https://${base}`);
            return target.origin === parsed.origin && target.pathname.startsWith(parsed.pathname.replace(/\/$/, '') + '/');
        } catch { return false; }
    };
    const matches = body.data.filter((config: any) => {
        if (config.storage_type === 'cloudflare') return matchesBase(config.cloudflare_public_url) || matchesBase(config.cloudflare_cdn_domain);
        if (config.storage_type === 'hosting') return matchesBase(config.hosting_url);
        if (config.storage_type === 'google_drive') return target.hostname === 'drive.google.com';
        if (config.storage_type === 'supabase') return matchesBase(supabaseUrl) && target.pathname.includes(`/public/${config.supabase_bucket}/`);
        return false;
    });
    // Ambiguous provider configuration must never delete from an arbitrary bucket.
    return matches.length === 1 ? matches[0] : null;
}

// ─── Upload Handlers ──────────────────────────────────────

// 1. Hosting (PHP) Upload Handler
async function uploadToHosting(formData: FormData, hostingUrl: string, phpUploadPath: string) {
    const targetUrl = new URL(`${hostingUrl.replace(/\/$/, '')}/${phpUploadPath}`);
    const boundary = '----NextJSUploadProxy' + Math.random().toString(36).substring(2);

    console.log('[uploadToHosting] ===== START =====');
    console.log('[uploadToHosting] Target URL:', targetUrl.toString());
    console.log('[uploadToHosting] Full hostname:', targetUrl.hostname);
    console.log('[uploadToHosting] Full path:', targetUrl.pathname + targetUrl.search);
    console.log('[uploadToHosting] Boundary:', boundary);

    // Collect all entries
    const entries: Array<[string, File | string]> = [];
    for (const [key, value] of formData.entries()) {
        entries.push([key, value]);
    }

    console.log('[uploadToHosting] Entries count:', entries.length);
    for (const [key, value] of entries) {
        if (value instanceof File) {
            console.log(`[uploadToHosting] Entry: ${key} = File(${value.name}, ${value.size}, ${value.type})`);
        } else {
            console.log(`[uploadToHosting] Entry: ${key} = "${value}"`);
        }
    }

    // Build multipart body manually
    const chunks: Buffer[] = [];
    for (const [key, value] of entries) {
        // Boundary for each part
        chunks.push(Buffer.from(`--${boundary}\r\n`));

        if (value instanceof File) {
            const arrayBuffer = await value.arrayBuffer();
            const fileBuffer = Buffer.from(arrayBuffer);

            // Content-Disposition header
            const disposition = `Content-Disposition: form-data; name="${key}"; filename="${value.name}"`;
            chunks.push(Buffer.from(disposition + '\r\n'));

            // Content-Type header
            const contentType = `Content-Type: ${value.type || 'application/octet-stream'}`;
            chunks.push(Buffer.from(contentType + '\r\n\r\n'));

            // File content
            chunks.push(fileBuffer);
            chunks.push(Buffer.from('\r\n'));
        } else {
            // Regular field
            chunks.push(Buffer.from(`Content-Disposition: form-data; name="${key}"\r\n\r\n`));
            chunks.push(Buffer.from(`${value}\r\n`));
        }
    }

    // Final boundary
    chunks.push(Buffer.from(`--${boundary}--\r\n`));
    const bodyBuffer = Buffer.concat(chunks);

    console.log('[uploadToHosting] Body built, size:', bodyBuffer.length);
    console.log('[uploadToHosting] Body hex preview:', bodyBuffer.slice(0, 200).toString('hex'));

    return new Promise<NextResponse>((resolve) => {
        const options = {
            hostname: targetUrl.hostname,
            path: targetUrl.pathname + targetUrl.search,
            method: 'POST',
            headers: {
                'Content-Type': `multipart/form-data; boundary=${boundary}`,
                'Content-Length': bodyBuffer.length,
            }
        };

        console.log('[uploadToHosting] Request options:', JSON.stringify(options, null, 2));

        const phpReq = https.request(options, (res) => {
            console.log('[uploadToHosting] ===== RESPONSE =====');
            console.log('[uploadToHosting] Status code:', res.statusCode);
            console.log('[uploadToHosting] Headers:', JSON.stringify(res.headers, null, 2));

            let resData = '';
            res.on('data', (chunk) => {
                resData += chunk;
            });
            res.on('end', () => {
                console.log('[uploadToHosting] Raw response length:', resData.length);
                console.log('[uploadToHosting] Raw response (first 1000 chars):', resData.substring(0, 1000));

                // Try to parse as JSON
                try {
                    const json = JSON.parse(resData);
                    console.log('[uploadToHosting] JSON parsed successfully:', JSON.stringify(json));
                    resolve(NextResponse.json(json, { status: res.statusCode }));
                } catch (parseErr) {
                    console.error('[uploadToHosting] JSON parse failed');
                    // Check if response contains PHP error
                    const isPhpError = resData.includes('<?php') ||
                                       resData.includes('<!DOCTYPE') ||
                                       resData.includes('<html') ||
                                       resData.includes('Parse error') ||
                                       resData.includes('Fatal error') ||
                                       resData.includes('Warning');

                    if (isPhpError) {
                        console.error('[uploadToHosting] Response is PHP/HTML error page');
                        resolve(NextResponse.json({
                            ok: false,
                            error: 'PHP handler mengembalikan error HTML',
                            details: resData.substring(0, 500)
                        }, { status: 502 }));
                    } else {
                        console.error('[uploadToHosting] Response is plain text:', resData.substring(0, 200));
                        resolve(NextResponse.json({
                            ok: false,
                            error: 'Hosting response bukan format JSON',
                            details: resData.substring(0, 300)
                        }, { status: 502 }));
                    }
                }
                console.log('[uploadToHosting] ===== END =====');
            });
        });

        phpReq.on('error', (err) => {
            console.error('[uploadToHosting] Request failed:', err.message);
            resolve(NextResponse.json({ ok: false, error: `Connection error: ${err.message}` }, { status: 500 }));
        });

        phpReq.write(bodyBuffer);
        phpReq.end();
    });
}

// 2. (Supabase Storage Upload Handler dihapus — unggahan baru hanya ke R2.
//     Klien Supabase masih dibuat di jalur DELETE untuk berkas lama.)

// 3. Google Drive Upload Handler
async function uploadToGoogleDrive(formData: FormData, folderId: string | null) {
    const serviceAccountEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
    const serviceAccountKey = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;

    if (!serviceAccountEmail || !serviceAccountKey) {
        return NextResponse.json({
            ok: false,
            error: 'Google Drive not configured. Set GOOGLE_SERVICE_ACCOUNT_EMAIL and GOOGLE_SERVICE_ACCOUNT_KEY in .env.local'
        }, { status: 500 });
    }

    if (!folderId) {
        return NextResponse.json({
            ok: false,
            error: 'Google Drive folder ID not configured. Set in Master Data → Penyimpanan File'
        }, { status: 500 });
    }

    const file = formData.get('file') as File;
    if (!file) {
        return NextResponse.json({ ok: false, error: 'No file provided' }, { status: 400 });
    }

    try {
        // Parse service account key
        let keyData: any;
        try {
            keyData = JSON.parse(serviceAccountKey);
        } catch {
            return NextResponse.json({ ok: false, error: 'Invalid GOOGLE_SERVICE_ACCOUNT_KEY JSON' }, { status: 500 });
        }

        // Get access token using JWT
        const accessToken = await getGoogleAccessToken(serviceAccountEmail, keyData);
        if (!accessToken) {
            return NextResponse.json({ ok: false, error: 'Failed to authenticate with Google Drive' }, { status: 500 });
        }

        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        // Generate unique filename
        const timestamp = Date.now();
        const random = crypto.randomBytes(4).toString('hex');
        const sanitizedName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_').replace(/\s+/g, '_');
        const uniqueFileName = `${timestamp}_${random}_${sanitizedName}`;

        // Create multipart upload request
        const boundary = 'boundary_' + crypto.randomBytes(16).toString('hex');
        const metadata = JSON.stringify({
            name: uniqueFileName,
            parents: [folderId]
        });

        const body = Buffer.concat([
            Buffer.from(`--${boundary}\r\n`),
            Buffer.from('Content-Type: application/json; charset=UTF-8\r\n\r\n'),
            Buffer.from(metadata + '\r\n'),
            Buffer.from(`--${boundary}\r\n`),
            Buffer.from(`Content-Type: ${file.type || 'application/octet-stream'}\r\n\r\n`),
            buffer,
            Buffer.from(`\r\n--${boundary}--\r\n`)
        ]);

        // Upload to Google Drive API
        const response = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': `multipart/related; boundary=${boundary}`,
                'Content-Length': body.length.toString()
            },
            body
        });

        if (!response.ok) {
            const error = await response.text();
            console.error('Google Drive API error:', error);
            return NextResponse.json({ ok: false, error: 'Failed to upload to Google Drive: ' + error }, { status: 500 });
        }

        const result = await response.json();

        // Make file public
        await makeFilePublic(result.id, accessToken);

        return NextResponse.json({
            ok: true,
            publicUrl: `https://drive.google.com/file/d/${result.id}/view`,
            fileName: uniqueFileName,
            fileId: result.id,
            fileSize: file.size
        });

    } catch (e: any) {
        console.error('Google Drive upload error:', e);
        return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
    }
}

// 4. Cloudflare R2 Upload Handler
async function uploadToCloudflareR2(
    formData: FormData,
    config: {
        cloudflare_account_id: string;
        cloudflare_access_key_id: string;
        cloudflare_secret_access_key: string;
        cloudflare_bucket_name: string;
        cloudflare_public_url?: string | null;
        cloudflare_cdn_domain?: string | null;
    }
) {
    try {
        const file = formData.get('file') as File;
        const folder = formData.get('folder') as string || 'general';

        if (!file) {
            return NextResponse.json({ ok: false, error: 'No file provided' }, { status: 400 });
        }

        const client = new S3Client({
            region: 'auto',
            endpoint: `https://${config.cloudflare_account_id}.r2.cloudflarestorage.com`,
            credentials: {
                accessKeyId: config.cloudflare_access_key_id,
                secretAccessKey: config.cloudflare_secret_access_key,
            },
        });

        // Generate unique filename
        const timestamp = Date.now();
        const random = crypto.randomBytes(4).toString('hex');
        const sanitizedName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_').replace(/\s+/g, '_');
        const uniqueFileName = `${timestamp}_${random}_${sanitizedName}`;
        const key = `${folder}/${uniqueFileName}`;

        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        const upload = new Upload({
            client,
            params: {
                Bucket: config.cloudflare_bucket_name,
                Key: key,
                Body: buffer,
                ContentType: folder === 'tugas-siswa' ? getMimeTypeFromFileName(file.name) : file.type || 'application/octet-stream',
            },
            queueSize: 4,
            partSize: 5 * 1024 * 1024,
            leavePartsOnError: false,
        });

        await upload.done();

        // ── Hardcode Worker URL sebagai fallback utama untuk akses file ──
        const WORKER_URL = 'https://tiny-field-c83e.imbank8993.workers.dev';

        let publicUrl: string;
        if (config.cloudflare_cdn_domain && config.cloudflare_cdn_domain.trim()) {
            publicUrl = `${config.cloudflare_cdn_domain.replace(/\/$/, '')}/${key}`;
        } else {
            // Gunakan Worker URL — satu-satunya format yang berfungsi saat ini
            publicUrl = `${WORKER_URL}/${key}`;
        }

        return NextResponse.json({
            ok: true,
            publicUrl,
            fileName: key,
            fileSize: file.size,
            storageType: 'cloudflare'
        });
    } catch (e: any) {
        console.error('Cloudflare R2 upload error:', e);
        return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
    }
}

// Get Google OAuth access token using JWT
async function getGoogleAccessToken(serviceAccountEmail: string, keyData: any): Promise<string | null> {
    try {
        const now = Math.floor(Date.now() / 1000);

        const header = { alg: 'RS256', typ: 'JWT' };
        const claimSet = {
            iss: serviceAccountEmail,
            scope: 'https://www.googleapis.com/auth/drive.file',
            aud: 'https://oauth2.googleapis.com/token',
            exp: now + 3600,
            iat: now
        };

        const encodedHeader = Buffer.from(JSON.stringify(header)).toString('base64url');
        const encodedClaimSet = Buffer.from(JSON.stringify(claimSet)).toString('base64url');
        const signatureInput = `${encodedHeader}.${encodedClaimSet}`;

        // Sign with RSA-SHA256
        const crypto = require('crypto');
        const sign = crypto.createSign('RSA-SHA256');
        sign.update(signatureInput);
        const signature = sign.sign(keyData.private_key, 'base64url');
        const jwt = `${signatureInput}.${signature}`;

        // Exchange JWT for access token
        const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
                assertion: jwt
            })
        });

        if (!tokenResponse.ok) {
            const error = await tokenResponse.text();
            console.error('Token exchange error:', error);
            return null;
        }

        const tokenData = await tokenResponse.json();
        return tokenData.access_token;
    } catch (error) {
        console.error('getGoogleAccessToken error:', error);
        return null;
    }
}

// Make Google Drive file public
async function makeFilePublic(fileId: string, accessToken: string): Promise<boolean> {
    try {
        const response = await fetch(
            `https://www.googleapis.com/drive/v3/files/${fileId}/permissions`,
            {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ role: 'reader', type: 'anyone' })
            }
        );
        return response.ok;
    } catch {
        return false;
    }
}

// ─── Main Upload Handler ──────────────────────────────────
/**
 * Sesi wajib. Tanpa ini endpoint menerima berkas dari siapa pun di internet
 * dan menuliskannya ke penyimpanan madrasah (hosting/S3/Supabase) — sarana
 * gratis untuk menitipkan berkas apa pun di bawah domain sekolah. Middleware
 * tidak menutupinya karena matcher-nya memang tidak mencocokkan `/api`.
 *
 * Route lain yang mendelegasikan ke sini (surat/upload, surat/templates,
 * surat/sign-pdf, proxy/upload, e-supervisi/upload) meneruskan cookie
 * pemanggil, jadi pemeriksaan ini berlaku untuk mereka juga.
 */
export async function POST(req: NextRequest) {
    try {
        const token = extractRequestToken(req);
        if (!token) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
        
        const user = await getApiUser(req);
        if (!user) return NextResponse.json({ ok: false, error: 'Token tidak valid' }, { status: 401 });

        const formData = await req.formData();
        const file = formData.get('file');
        if (!(file instanceof File) || file.size <= 0 || file.size > 25 * 1024 * 1024) {
            return NextResponse.json({ ok: false, error: 'Berkas wajib diisi, maksimal 25 MB' }, { status: 400 });
        }

        // Sanitasi dan validasi ekstensi berkas
        const fileName = (file.name || '').trim();
        if (!fileName || fileName.includes('\0') || fileName.includes('/') || fileName.includes('\\')) {
            return NextResponse.json({ ok: false, error: 'Nama berkas tidak valid' }, { status: 400 });
        }

        const nameParts = fileName.toLowerCase().split('.').filter(Boolean);
        if (nameParts.length < 2) {
            return NextResponse.json({ ok: false, error: 'Berkas harus memiliki ekstensi yang valid' }, { status: 400 });
        }

        const ext = nameParts[nameParts.length - 1];

        // 1. Blacklist mutlak untuk skrip server dan berkas eksekutabel berbahaya (cegah RCE & malware)
        const DANGEROUS_EXTENSIONS = new Set([
            'php', 'phtml', 'php3', 'php4', 'php5', 'phps', 'phar', 'inc',
            'exe', 'bat', 'cmd', 'sh', 'bash', 'vbs', 'ps1', 'msi', 'jar',
            'com', 'scr', 'cgi', 'pl', 'py', 'jsp', 'asp', 'aspx', 'htaccess'
        ]);

        // Cegah trik double-extension (mis. payload.php.png atau exploit.exe.jpg)
        const hasDangerousExt = nameParts.some(part => DANGEROUS_EXTENSIONS.has(part));
        if (hasDangerousExt || DANGEROUS_EXTENSIONS.has(ext)) {
            return NextResponse.json({ ok: false, error: 'Format berkas terlarang demi keamanan sistem' }, { status: 400 });
        }

        // 2. Whitelist ekstensi yang sah untuk kebutuhan madrasah (dokumen, gambar, media, arsip, dan web)
        const ALLOWED_EXTENSIONS = new Set([
            // Dokumen kantor
            'pdf', 'doc', 'docx', 'xls', 'xlsx', 'xlsm', 'ppt', 'pptx', 'txt', 'csv', 'rtf', 'odt', 'ods', 'odp',
            // Gambar & grafis
            'jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'ico', 'svg', 'tiff', 'tif', 'avif',
            // Audio & Video
            'mp4', 'webm', 'mov', 'avi', 'mkv', 'mp3', 'wav', 'ogg', 'm4a', 'flac', 'aac',
            // Arsip kompresi
            'zip', 'rar', '7z', 'tar', 'gz',
            // Dokumen web (terisolasi dalam sandbox saat dirender)
            'html', 'htm'
        ]);

        if (!ALLOWED_EXTENSIONS.has(ext)) {
            return NextResponse.json({ ok: false, error: `Format berkas .${ext} tidak didukung` }, { status: 400 });
        }

        const rawFolder = String(formData.get('folder') || 'general').trim();
        if (
            rawFolder.includes('..') ||
            rawFolder.includes('\\') ||
            rawFolder.includes('\0') ||
            !/^[a-zA-Z0-9_/\s\-().&,']+$/.test(rawFolder)
        ) {
            return NextResponse.json({ ok: false, error: 'Folder tidak valid' }, { status: 400 });
        }
        const folder = rawFolder.replace(/\/+/g, '/').replace(/^\/|\/$/g, '') || 'general';
        formData.set('folder', folder);

        if (folder === 'tugas-siswa') {
            const permission = await nestFetchAsUser('/tugas-siswa/upload-access', token);
            if (permission.status !== 200 || !permission.body?.ok) return NextResponse.json({ ok: false, error: 'Anda tidak memiliki izin mengunggah lampiran tugas' }, { status: permission.status === 401 ? 401 : 403 });
            if (file.size > 10 * 1024 * 1024 || !new Set(['pdf','doc','docx','xls','xlsx','ppt','pptx','txt','csv','jpg','jpeg','png','webp','zip']).has(ext)) {
                return NextResponse.json({ ok: false, error: 'Format lampiran tidak didukung atau ukuran melebihi 10 MB' }, { status: 400 });
            }
        }

        if (folder === 'prestasi' && !await validatePrestasiUpload(file)) {
            return NextResponse.json({ ok: false, error: 'Sertifikat harus berupa PDF, JPG, atau PNG yang valid, maksimal 10 MB' }, { status: 400 });
        }

        if (folder === 'laporan_keuangan') {
            const signature = Buffer.from(await file.slice(0, 5).arrayBuffer()).toString('ascii');
            if (ext !== 'pdf' || signature !== '%PDF-') {
                return NextResponse.json({ ok: false, error: 'Laporan keuangan harus berupa berkas PDF yang valid' }, { status: 400 });
            }
        }

        // Get storage config
        const config = await getFileStorageConfig();

        if (!config) {
            return NextResponse.json({
                ok: false,
                error: 'Konfigurasi penyimpanan file belum diset. Silakan configure di Master Data → Penyimpanan File.'
            }, { status: 500 });
        }

        console.log(`[Upload] Storage type: ${config.storage_type}`);

        let response: NextResponse;
        switch (config.storage_type) {
            case 'hosting':
                return NextResponse.json({
                    ok: false,
                    error: 'Penyimpanan Server Hosting sudah tidak digunakan lagi untuk unggahan baru. '
                        + 'Gunakan Cloudflare R2 di Pengaturan → Penyimpanan File.'
                }, { status: 400 });

            /**
             * Supabase, Google Drive, dan Server Hosting sudah tidak dipakai oleh aplikasi
             * untuk unggahan baru: satu-satunya storage aktif adalah Cloudflare R2.
             */
            case 'supabase':
                return NextResponse.json({
                    ok: false,
                    error: 'Penyimpanan Supabase sudah tidak dipakai untuk unggahan baru. '
                        + 'Aktifkan Cloudflare R2 di Pengaturan → Penyimpanan File.'
                }, { status: 400 });

            case 'google_drive':
                return NextResponse.json({
                    ok: false,
                    error: 'Penyimpanan Google Drive sudah tidak digunakan lagi untuk unggahan baru. '
                        + 'Gunakan Cloudflare R2 di Pengaturan → Penyimpanan File.'
                }, { status: 400 });

            case 'cloudflare':
                if (!config.cloudflare_account_id || !config.cloudflare_access_key_id || !config.cloudflare_secret_access_key || !config.cloudflare_bucket_name) {
                    return NextResponse.json({
                        ok: false,
                        error: 'Cloudflare R2 not fully configured. Please check account ID, credentials, and bucket name.'
                    }, { status: 500 });
                }
                response = await uploadToCloudflareR2(formData, config);
                break;

            default:
                return NextResponse.json({
                    ok: false,
                    error: `Unknown storage type: ${config.storage_type}`
                }, { status: 400 });
        }

        const requiresRegistry = folder === 'laporan_keuangan' || folder === 'bukti_keuangan' || folder === 'prestasi' || folder === 'tugas-siswa';
        // Unggahan yang memerlukan verifikasi pemilik wajib tercatat.
        try {
            const uploadedFile = formData.get('file');
            const json = await response.clone().json();
            const fileUrl = json?.publicUrl || json?.url || json?.file_url;
            if (json?.ok && fileUrl && uploadedFile instanceof File) {
                await registerUpload({
                    file_url: fileUrl,
                    owner_auth_id: user.authId,
                    file_name: json.fileName || uploadedFile.name,
                    folder: (formData.get('folder') as string) || 'general',
                    size_bytes: json.fileSize || uploadedFile.size,
                    storage_type: config.storage_type,
                }, requiresRegistry);
            } else if (requiresRegistry && response.ok) {
                throw new Error('Respons unggahan tidak memuat URL berkas');
            }
        } catch (regErr) {
            console.error('[Upload] Gagal mencatat ke registry:', regErr);
            if (requiresRegistry) {
                return NextResponse.json({ ok: false, error: 'Berkas belum dapat digunakan karena pencatatan kepemilikannya gagal. Silakan coba unggah kembali.' }, { status: 503 });
            }
        }

        return response;
    } catch (error: any) {
        console.error('[Upload] Error:', error);
        return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }
}

// ─── Main Delete Handler ──────────────────────────────────
export async function DELETE(req: NextRequest) {
    try {
        const token = extractRequestToken(req);
        if (!token) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
        
        const user = await getApiUser(req);
        if (!user) return NextResponse.json({ ok: false, error: 'Token tidak valid' }, { status: 401 });

        const { searchParams } = new URL(req.url);
        const fileUrl = searchParams.get('file_url');

        if (!fileUrl) {
            return NextResponse.json({ ok: false, error: 'URL file tidak dikirim' }, { status: 400 });
        }

        const authorization = await nestFetchAsUser('/site-settings/file-registry/can-delete?url=' + encodeURIComponent(fileUrl), token);
        if (authorization.status !== 200 || !authorization.body?.allowed) return NextResponse.json({ok:false,error:'Berkas bukan milik Anda atau kepemilikannya belum tercatat'},{status:403});

        // Match the original provider so switching storage cannot delete from the wrong bucket.
        const config = await getStorageConfigForFile(fileUrl);
        if (!config) {
            return NextResponse.json({ ok: false, error: 'Konfigurasi penyimpanan tidak ditemukan di sistem' }, { status: 500 });
        }

        console.log(`[Delete File] Storage: ${config.storage_type}, Target URL: ${fileUrl}`);

        switch (config.storage_type) {
            /**
             * Berkas lama di Server Hosting, Supabase Storage, dan Google Drive TIDAK dihapus oleh aplikasi.
             *
             * Catatannya tetap dicabut dari registry supaya perhitungan kapasitas
             * dan alur hapus di halaman pemanggil berjalan lancar tanpa error network.
             * Berkas fisiknya ditinggal untuk dibersihkan manual jika diperlukan.
             */
            case 'hosting': {
                console.warn(`[Delete File] Server Hosting: berkas fisik TIDAK dihapus (dilewati, manual cleanup jika diperlukan) → ${fileUrl}`);
                await unregisterUpload(fileUrl);
                return NextResponse.json({
                    ok: true,
                    manualCleanup: true,
                    message: 'Catatan berkas dihapus. Berkas fisik di server hosting dilewati '
                        + 'dan dapat dibersihkan secara manual jika diperlukan.',
                });
            }

            case 'supabase': {
                console.warn(`[Delete File] Supabase: berkas fisik TIDAK dihapus, perlu dibersihkan manual → ${fileUrl}`);
                await unregisterUpload(fileUrl);
                return NextResponse.json({
                    ok: true,
                    manualCleanup: true,
                    message: 'Catatan berkas dihapus. Berkas fisiknya masih ada di Supabase Storage '
                        + 'dan perlu dihapus manual dari dashboard Supabase.',
                });
            }

            case 'google_drive': {
                console.warn(`[Delete File] Google Drive: berkas fisik TIDAK dihapus (dilewati, manual cleanup jika diperlukan) → ${fileUrl}`);
                await unregisterUpload(fileUrl);
                return NextResponse.json({
                    ok: true,
                    manualCleanup: true,
                    message: 'Catatan berkas dihapus. Berkas fisik di Google Drive dilewati '
                        + 'dan dapat dibersihkan secara manual jika diperlukan.',
                });
            }

            case 'cloudflare': {
                if (!config.cloudflare_account_id || !config.cloudflare_access_key_id || !config.cloudflare_secret_access_key || !config.cloudflare_bucket_name) {
                    throw new Error('Cloudflare R2 not fully configured for delete');
                }
                const client = new S3Client({
                    region: 'auto',
                    endpoint: `https://${config.cloudflare_account_id}.r2.cloudflarestorage.com`,
                    credentials: {
                        accessKeyId: config.cloudflare_access_key_id,
                        secretAccessKey: config.cloudflare_secret_access_key,
                    },
                });

                // Extract object key from URL (path after hostname)
                const url = new URL(fileUrl);
                const bases = [config.cloudflare_public_url, config.cloudflare_cdn_domain].filter(Boolean);
                const base = bases.map((b: string) => new URL(b.includes('://') ? b : `https://${b}`))
                    .find((b: URL) => b.origin === url.origin && url.pathname.startsWith(b.pathname.replace(/\/$/, '') + '/'));
                if (!base) throw new Error('URL tidak sesuai bucket penyimpanan');
                const key = decodeURIComponent(url.pathname.slice(base.pathname.replace(/\/$/, '').length + 1));

                const cmd = new DeleteObjectCommand({
                    Bucket: config.cloudflare_bucket_name,
                    Key: key,
                });
                await client.send(cmd);
                await unregisterUpload(fileUrl);
                return NextResponse.json({ ok: true, message: 'File berhasil dihapus dari Cloudflare R2' });
            }

            default:
                return NextResponse.json({ ok: false, error: `Storage type ${config.storage_type} tidak mendukung hapus sinkronisasi` }, { status: 400 });
        }

    } catch (error: any) {
        console.error('[Delete File Main API Catch]', error);
        return NextResponse.json({ ok: false, error: error.message || 'Terjadi kegagalan sistem penghapusan' }, { status: 500 });
    }
}
