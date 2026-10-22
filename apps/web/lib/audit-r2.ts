import { S3Client } from '@aws-sdk/client-s3';
import { getCloudflareConfig } from './file-storage';

export async function auditR2() {
    const config = await getCloudflareConfig();
    const account = config?.accountId?.trim(), accessKeyId = config?.accessKeyId?.trim();
    const secretAccessKey = config?.secretAccessKey?.trim(), bucket = config?.bucketName?.trim();
    if (!account || !accessKeyId || !secretAccessKey || !bucket || !/^[a-zA-Z0-9]+$/.test(account)) throw Error('R2 unavailable');
    return { bucket, client: new S3Client({ region: 'auto', endpoint: `https://${account}.r2.cloudflarestorage.com`, credentials: { accessKeyId, secretAccessKey }, maxAttempts: 2 }) };
}

export function validR2Key(value: string) { return Buffer.byteLength(value, 'utf8') <= 1024 && !/[\x00-\x1f]/.test(value); }
