/**
 * File Storage Configuration Utility
 * Gets the current file storage configuration from database via NestJS
 * Supports: Supabase Storage, Google Drive, Cloudflare R2
 */

const NEST_API_URL = process.env.NEXT_PUBLIC_NEST_API_URL || 'http://localhost:3001/api';

export type StorageType = 'supabase' | 'google_drive' | 'cloudflare';

export interface FileStorageConfig {
    id: string;
    storage_type: StorageType;
    hosting_url: string | null;
    php_upload_path: string | null;
    php_delete_path: string | null;
    supabase_bucket: string | null;
    google_drive_folder_id: string | null;
    cloudflare_account_id: string | null;
    cloudflare_access_key_id: string | null;
    cloudflare_secret_access_key: string | null;
    cloudflare_bucket_name: string | null;
    cloudflare_public_url: string | null;
    cloudflare_cdn_domain: string | null;
    is_active: boolean;
}

export interface UploadConfig {
    storageType: StorageType | null;
    // Supabase
    bucketName: string | null;
    // Google Drive
    googleDriveFolderId: string | null;
    // Cloudflare
    cloudflareConfig: {
        accountId: string | null;
        bucketName: string | null;
        publicUrl: string | null;
        cdnDomain: string | null;
    } | null;
}

// Env-based Cloudflare R2 Config Helper
export function getEnvCloudflareConfig() {
    const accountId = process.env.CLOUDFLARE_R2_ACCOUNT_ID || process.env.R2_ACCOUNT_ID || null;
    const accessKeyId = process.env.CLOUDFLARE_R2_ACCESS_KEY_ID || process.env.R2_ACCESS_KEY_ID || null;
    const secretAccessKey = process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY || process.env.R2_SECRET_ACCESS_KEY || null;
    const bucketName = process.env.CLOUDFLARE_R2_BUCKET_NAME || process.env.R2_BUCKET || null;
    const publicUrl = process.env.CLOUDFLARE_R2_PUBLIC_URL || process.env.R2_PUBLIC_BASE_URL || null;
    const cdnDomain = process.env.CLOUDFLARE_R2_CDN_DOMAIN || null;

    if (accountId || accessKeyId || secretAccessKey || bucketName || publicUrl) {
        return {
            accountId,
            accessKeyId,
            secretAccessKey,
            bucketName,
            publicUrl,
            cdnDomain,
        };
    }
    return null;
}

let configCache: FileStorageConfig | null = null;
let configCacheTime = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export async function getFileStorageConfig(): Promise<FileStorageConfig | null> {
    const envCf = getEnvCloudflareConfig();
    const driverEnv = (process.env.STORAGE_DRIVER || '').toLowerCase();

    // If driver is set to cloudflare/r2 or env CF config is present, return env-based config
    if (driverEnv === 'cloudflare' || driverEnv === 'r2' || envCf) {
        return {
            id: 'env-cloudflare',
            storage_type: 'cloudflare',
            hosting_url: envCf?.publicUrl || null,
            php_upload_path: null,
            php_delete_path: null,
            supabase_bucket: null,
            google_drive_folder_id: null,
            cloudflare_account_id: envCf?.accountId || null,
            cloudflare_access_key_id: envCf?.accessKeyId || null,
            cloudflare_secret_access_key: envCf?.secretAccessKey || null,
            cloudflare_bucket_name: envCf?.bucketName || null,
            cloudflare_public_url: envCf?.publicUrl || null,
            cloudflare_cdn_domain: envCf?.cdnDomain || null,
            is_active: true,
        };
    }

    if (configCache && (Date.now() - configCacheTime) < CACHE_TTL) {
        return configCache;
    }

    try {
        const res = await fetch(`${NEST_API_URL}/site-settings/file-storage-config`, { cache: 'no-store' });
        if (!res.ok) return null;
        const json = await res.json();
        if (!json.ok || !json.data) return null;

        configCache = json.data as FileStorageConfig;
        configCacheTime = Date.now();
        return configCache;
    } catch (e) {
        console.error('getFileStorageConfig exception:', e);
        return null;
    }
}

export function clearFileStorageConfigCache() {
    configCache = null;
    configCacheTime = 0;
}

// Check storage type
export async function getStorageType(): Promise<StorageType | null> {
    const config = await getFileStorageConfig();
    return config?.storage_type || 'cloudflare';
}

// Get Supabase bucket name
export async function getSupabaseBucket(): Promise<string | null> {
    const config = await getFileStorageConfig();
    return config?.supabase_bucket || null;
}

// Get Google Drive folder ID
export async function getGoogleDriveFolderId(): Promise<string | null> {
    const config = await getFileStorageConfig();
    return config?.google_drive_folder_id || null;
}

// Get the upload/hosting URL from active storage config
export async function getUploadUrl(): Promise<string | null> {
    const config = await getFileStorageConfig();
    return config?.hosting_url || null;
}

// Get complete upload configuration
export async function getUploadConfig(): Promise<UploadConfig> {
    const config = await getFileStorageConfig();

    if (!config) {
        const envCf = getEnvCloudflareConfig();
        return {
            storageType: 'cloudflare',
            bucketName: null,
            googleDriveFolderId: null,
            cloudflareConfig: envCf ? {
                accountId: envCf.accountId,
                bucketName: envCf.bucketName,
                publicUrl: envCf.publicUrl,
                cdnDomain: envCf.cdnDomain,
            } : null
        };
    }

    return {
        storageType: config.storage_type,
        bucketName: config.supabase_bucket,
        googleDriveFolderId: config.google_drive_folder_id,
        cloudflareConfig: config.storage_type === 'cloudflare' ? {
            accountId: config.cloudflare_account_id,
            bucketName: config.cloudflare_bucket_name,
            publicUrl: config.cloudflare_public_url,
            cdnDomain: config.cloudflare_cdn_domain,
        } : null
    };
}

// Helper to check storage type
export async function isSupabaseStorage(): Promise<boolean> {
    const config = await getFileStorageConfig();
    return config?.storage_type === 'supabase';
}

export async function isGoogleDriveStorage(): Promise<boolean> {
    const config = await getFileStorageConfig();
    return config?.storage_type === 'google_drive';
}

export async function isCloudflareStorage(): Promise<boolean> {
    const config = await getFileStorageConfig();
    return config?.storage_type === 'cloudflare';
}

export async function getCloudflareConfig(): Promise<{
    accountId: string | null;
    accessKeyId: string | null;
    secretAccessKey: string | null;
    bucketName: string | null;
    publicUrl: string | null;
    cdnDomain: string | null;
} | null> {
    const envCf = getEnvCloudflareConfig();
    if (envCf) return envCf;

    const config = await getFileStorageConfig();
    if (!config || config.storage_type !== 'cloudflare') return null;
    return {
        accountId: config.cloudflare_account_id,
        accessKeyId: config.cloudflare_access_key_id,
        secretAccessKey: config.cloudflare_secret_access_key,
        bucketName: config.cloudflare_bucket_name,
        publicUrl: config.cloudflare_public_url,
        cdnDomain: config.cloudflare_cdn_domain,
    };
}

// Get base URL for uploaded files (for constructing public URLs)
export async function getStorageBaseUrl(): Promise<string | null> {
    const config = await getFileStorageConfig();
    if (!config) return null;

    switch (config.storage_type) {
        case 'supabase':
            return process.env.NEXT_PUBLIC_SUPABASE_URL || null;
        case 'cloudflare':
            return config.cloudflare_public_url?.replace(/\/$/, '') || config.cloudflare_cdn_domain?.replace(/\/$/, '') || null;
        default:
            return null;
    }
}