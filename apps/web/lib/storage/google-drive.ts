import { prisma } from '../prisma';
import crypto from 'crypto';

interface GoogleDriveConfig {
    folder_id: string;
    service_account_email?: string;
}

function generateFileName(originalName: string): string {
    const timestamp = Date.now();
    const random = crypto.randomBytes(4).toString('hex');
    const cleanName = originalName.replace(/[^a-zA-Z0-9.-]/g, '_').replace(/\s+/g, '_');
    return `${timestamp}_${random}_${cleanName}`;
}

async function getGoogleDriveConfig(): Promise<GoogleDriveConfig | null> {
    try {
        const data = await prisma.file_storage_config.findFirst({
            where: {
                storage_type: 'google_drive',
                is_active: true
            },
            select: { google_drive_folder_id: true }
        });

        if (!data?.google_drive_folder_id) {
            return null;
        }

        return {
            folder_id: data.google_drive_folder_id,
            service_account_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || undefined
        };
    } catch (error) {
        console.error('getGoogleDriveConfig error:', error);
        return null;
    }
}

function getMimeType(fileName: string): string {
    const ext = fileName.split('.').pop()?.toLowerCase() || '';
    const mimeTypes: Record<string, string> = {
        'jpg': 'image/jpeg',
        'jpeg': 'image/jpeg',
        'png': 'image/png',
        'gif': 'image/gif',
        'pdf': 'application/pdf',
        'doc': 'application/msword',
        'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'xls': 'application/vnd.ms-excel',
        'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'txt': 'text/plain',
        'zip': 'application/zip',
    };
    return mimeTypes[ext] || 'application/octet-stream';
}

export async function uploadToGoogleDrive(
    file: Buffer | Blob,
    fileName: string,
    mimeType: string = 'application/octet-stream',
    _folder?: string
): Promise<{ file_url: string; file_id: string; file_name: string } | null> {
    try {
        const config = await getGoogleDriveConfig();
        if (!config) {
            console.error('Google Drive folder ID not configured');
            return null;
        }

        const serviceAccountEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
        const serviceAccountKey = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;

        if (!serviceAccountEmail || !serviceAccountKey) {
            console.error('Google Service Account not configured. Set GOOGLE_SERVICE_ACCOUNT_EMAIL and GOOGLE_SERVICE_ACCOUNT_KEY in env.');
            return null;
        }

        let serviceAccountKeyJson: any;
        try {
            serviceAccountKeyJson = JSON.parse(serviceAccountKey);
        } catch {
            console.error('Invalid GOOGLE_SERVICE_ACCOUNT_KEY - must be valid JSON');
            return null;
        }

        const token = await getServiceAccountToken(serviceAccountEmail, serviceAccountKeyJson);
        if (!token) {
            return null;
        }

        const uniqueFileName = generateFileName(fileName);
        const fileBuffer = Buffer.isBuffer(file) ? file : Buffer.from(await (file as Blob).arrayBuffer());

        const boundary = 'boundary_' + crypto.randomBytes(16).toString('hex');
        const metadata = JSON.stringify({
            name: uniqueFileName,
            parents: [config.folder_id]
        });

        const body = Buffer.concat([
            Buffer.from(`--${boundary}\r\n`),
            Buffer.from('Content-Type: application/json; charset=UTF-8\r\n\r\n'),
            Buffer.from(metadata + '\r\n'),
            Buffer.from(`--${boundary}\r\n`),
            Buffer.from(`Content-Type: ${mimeType || getMimeType(fileName)}\r\n\r\n`),
            fileBuffer,
            Buffer.from(`\r\n--${boundary}--\r\n`)
        ]);

        const response = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': `multipart/related; boundary=${boundary}`,
                'Content-Length': body.length.toString()
            },
            body
        });

        if (!response.ok) {
            const error = await response.text();
            console.error('Google Drive API error:', error);
            return null;
        }

        const result = await response.json();
        await makeGoogleDriveFilePublic(result.id);

        return {
            file_url: `https://drive.google.com/file/d/${result.id}/view`,
            file_id: result.id,
            file_name: uniqueFileName
        };
    } catch (error) {
        console.error('uploadToGoogleDrive error:', error);
        return null;
    }
}

async function getServiceAccountToken(email: string, key: any): Promise<string | null> {
    try {
        const now = Math.floor(Date.now() / 1000);

        const header = {
            alg: 'RS256',
            typ: 'JWT'
        };

        const claimSet = {
            iss: email,
            scope: 'https://www.googleapis.com/auth/drive.file',
            aud: 'https://oauth2.googleapis.com/token',
            exp: now + 3600,
            iat: now
        };

        const encodedHeader = Buffer.from(JSON.stringify(header)).toString('base64url');
        const encodedClaimSet = Buffer.from(JSON.stringify(claimSet)).toString('base64url');

        const signatureInput = `${encodedHeader}.${encodedClaimSet}`;

        const crypto = require('crypto');
        const sign = crypto.createSign('RSA-SHA256');
        sign.update(signatureInput);
        const signature = sign.sign(key.private_key, 'base64url');

        const jwt = `${signatureInput}.${signature}`;

        const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            },
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
        console.error('getServiceAccountToken error:', error);
        return null;
    }
}

export async function deleteFromGoogleDrive(fileId: string): Promise<boolean> {
    try {
        const serviceAccountEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
        const serviceAccountKey = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;

        if (!serviceAccountEmail || !serviceAccountKey) {
            return false;
        }

        const key = JSON.parse(serviceAccountKey);
        const token = await getServiceAccountToken(serviceAccountEmail, key);

        if (!token) {
            return false;
        }

        const response = await fetch(
            `https://www.googleapis.com/drive/v3/files/${fileId}`,
            {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            }
        );

        return response.ok || response.status === 404;
    } catch (error) {
        console.error('deleteFromGoogleDrive error:', error);
        return false;
    }
}

export async function makeGoogleDriveFilePublic(fileId: string): Promise<boolean> {
    try {
        const serviceAccountEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
        const serviceAccountKey = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;

        if (!serviceAccountEmail || !serviceAccountKey) {
            return false;
        }

        const key = JSON.parse(serviceAccountKey);
        const token = await getServiceAccountToken(serviceAccountEmail, key);

        if (!token) {
            return false;
        }

        const response = await fetch(
            `https://www.googleapis.com/drive/v3/files/${fileId}/permissions`,
            {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    role: 'reader',
                    type: 'anyone'
                })
            }
        );
        return response.ok;
    } catch (error) {
        console.error('makeGoogleDriveFilePublic error:', error);
        return false;
    }
}

export async function getGoogleDriveFolderUsage(folderId: string): Promise<{
    fileCount: number;
    usedBytes: number;
    message: string;
} | null> {
    try {
        const serviceAccountEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
        const serviceAccountKey = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;

        if (!serviceAccountEmail || !serviceAccountKey) {
            return null;
        }

        const key = JSON.parse(serviceAccountKey);
        const token = await getServiceAccountToken(serviceAccountEmail, key);

        if (!token) {
            return null;
        }

        const response = await fetch(
            `https://www.googleapis.com/drive/v3/files?q='${folderId}'+in+parents+and+trashed=false&fields=files(id,name,mimeType,size),files(name,mimeType)`,
            {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            }
        );

        if (!response.ok) {
            console.error('Google Drive usage API error:', await response.text());
            return null;
        }

        const result = await response.json();
        const files = result.files || [];

        let totalSize = 0;
        let fileCount = 0;

        for (const file of files) {
            if (file.mimeType !== 'application/vnd.google-apps.folder') {
                fileCount++;
                totalSize += parseInt(file.size || '0', 10);
            }
        }

        return {
            fileCount,
            usedBytes: totalSize,
            message: `Found ${fileCount} files in folder`
        };
    } catch (error) {
        console.error('getGoogleDriveFolderUsage error:', error);
        return null;
    }
}