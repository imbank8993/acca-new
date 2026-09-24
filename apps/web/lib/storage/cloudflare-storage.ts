/**
 * Cloudflare R2 Storage Utility
 * Handles file uploads/deletes to Cloudflare R2 (S3-compatible API)
 */

import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import * as crypto from 'crypto';
import { getMimeTypeFromFileName, DEFAULT_MIME } from './mime';

export interface CloudflareR2Config {
    accountId: string;
    accessKeyId: string;
    secretAccessKey: string;
    bucketName: string;
    publicUrl?: string;
    cdnDomain?: string;
}

// Create R2 S3 client
function createR2Client(config: CloudflareR2Config): S3Client {
    const endpoint = `https://${config.accountId}.r2.cloudflarestorage.com`;

    return new S3Client({
        region: 'auto',
        endpoint,
        credentials: {
            accessKeyId: config.accessKeyId,
            secretAccessKey: config.secretAccessKey,
        },
    });
}

// Generate unique filename
function generateFileName(originalName: string): string {
    const ext = originalName.split('.').pop() || '';
    const timestamp = Date.now();
    const random = crypto.randomBytes(4).toString('hex');
    const cleanName = originalName.replace(/[^a-zA-Z0-9.-]/g, '_').replace(/\s+/g, '_');
    return `${timestamp}_${random}_${cleanName}`;
}

// Upload file to Cloudflare R2
export async function uploadToCloudflareR2(
    file: Buffer | Blob,
    fileName: string,
    folder?: string,
    config?: CloudflareR2Config
): Promise<{ file_url: string; file_path: string; file_name: string } | null> {
    try {
        // Get config from database if not provided
        let r2Config = config;
        if (!r2Config) {
            const { getCloudflareConfig } = await import('../file-storage');
            const cloudflareConfig = await getCloudflareConfig();
            if (!cloudflareConfig || !cloudflareConfig.accountId || !cloudflareConfig.accessKeyId || !cloudflareConfig.secretAccessKey || !cloudflareConfig.bucketName) {
                throw new Error('Cloudflare R2 config not found');
            }
            r2Config = {
                accountId: cloudflareConfig.accountId,
                accessKeyId: cloudflareConfig.accessKeyId,
                secretAccessKey: cloudflareConfig.secretAccessKey,
                bucketName: cloudflareConfig.bucketName,
                publicUrl: cloudflareConfig.publicUrl || undefined,
                cdnDomain: cloudflareConfig.cdnDomain || undefined,
            };
        }

        const client = createR2Client(r2Config);

        // Generate unique filename
        const uniqueFileName = generateFileName(fileName);
        const key = folder ? `${folder}/${uniqueFileName}` : uniqueFileName;

        // Convert Blob to Buffer if needed
        let fileBuffer: Buffer;
        if (Buffer.isBuffer(file)) {
            fileBuffer = file;
        } else {
            const arrayBuffer = await file.arrayBuffer();
            fileBuffer = Buffer.from(arrayBuffer);
        }

        // Content type diturunkan dari nama file. Sebelumnya Buffer selalu diberi
        // application/octet-stream, sehingga PDF yang di-generate server (surat, laporan)
        // tersimpan di R2 dengan tipe generik dan tidak bisa dibuka inline di browser.
        const contentType = getMimeTypeFromFileName(fileName) !== DEFAULT_MIME
            ? getMimeTypeFromFileName(fileName)
            : (file instanceof Blob && file.type ? file.type : DEFAULT_MIME);

        // Upload using multipart upload for larger files
        const upload = new Upload({
            client,
            params: {
                Bucket: r2Config.bucketName,
                Key: key,
                Body: fileBuffer,
                ContentType: contentType,
                ContentDisposition: 'inline',
            },
            queueSize: 4,
            partSize: 5 * 1024 * 1024, // 5MB parts
            leavePartsOnError: false,
        });

        await upload.done();

        // Use Worker URL — format yang berfungsi untuk akses file
        const WORKER_URL = 'https://tiny-field-c83e.imbank8993.workers.dev';
        const fileUrl = `${WORKER_URL}/${key}`;

        return {
            file_url: fileUrl,
            file_path: key,
            file_name: uniqueFileName,
        };
    } catch (error: any) {
        console.error('uploadToCloudflareR2 error:', error);
        return null;
    }
}

// Delete file from Cloudflare R2
export async function deleteFromCloudflareR2(
    filePath: string,
    config?: CloudflareR2Config
): Promise<boolean> {
    try {
        let r2Config = config;
        if (!r2Config) {
            const { getCloudflareConfig } = await import('../file-storage');
            const cloudflareConfig = await getCloudflareConfig();
            if (!cloudflareConfig || !cloudflareConfig.accountId || !cloudflareConfig.accessKeyId || !cloudflareConfig.secretAccessKey || !cloudflareConfig.bucketName) {
                throw new Error('Cloudflare R2 config not found');
            }
            r2Config = {
                accountId: cloudflareConfig.accountId,
                accessKeyId: cloudflareConfig.accessKeyId,
                secretAccessKey: cloudflareConfig.secretAccessKey,
                bucketName: cloudflareConfig.bucketName,
                publicUrl: cloudflareConfig.publicUrl || undefined,
                cdnDomain: cloudflareConfig.cdnDomain || undefined,
            };
        }

        const client = createR2Client(r2Config);

        // Extract path from full URL if needed
        let key = filePath;
        if (filePath.startsWith('http')) {
            try {
                const url = new URL(filePath);
                // Decode %20 → spasi agar cocok dengan key di R2
                key = decodeURIComponent(url.pathname.replace(/^\//, ''));
            } catch {
                // If URL parsing fails, use as-is (might be just the key)
            }
        }

        const command = new DeleteObjectCommand({
            Bucket: r2Config.bucketName,
            Key: key,
        });

        await client.send(command);
        return true;
    } catch (error: any) {
        console.error('deleteFromCloudflareR2 error:', error);
        return false;
    }
}

// Check if a URL is a Cloudflare R2 URL
export function isCloudflareR2Url(url: string): boolean {
    if (!url) return false;
    // Check for R2.dev domain, R2 Cloudflare Storage, or R2 Worker URL
    return (
        url.includes('.r2.cloudflarestorage.com') ||
        url.includes('.r2.dev') ||
        url.includes('cloudflarestorage.com') ||
        url.includes('.workers.dev') ||
        url.includes('file.icgowa.sch.id')
    );
}