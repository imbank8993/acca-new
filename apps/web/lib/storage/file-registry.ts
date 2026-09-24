import { nestFetch } from '@/lib/nest-api';

export interface FileRegistryEntry {
    owner_auth_id?: string;
    file_url: string;
    file_name?: string | null;
    folder?: string | null;
    size_bytes: number;
    storage_type?: string | null;
}

export async function registerUpload(entry: FileRegistryEntry): Promise<void> {
    if (!entry.file_url) return;
    try {
        await nestFetch('/site-settings/file-registry/register', {
            method: 'POST',
            body: JSON.stringify(entry),
        });
    } catch (err) {
        console.error('[file-registry] Gagal mencatat upload via NestJS:', err);
    }
}

export async function unregisterUpload(fileUrl?: string | null): Promise<void> {
    if (!fileUrl) return;
    try {
        await nestFetch('/site-settings/file-registry/unregister', {
            method: 'POST',
            body: JSON.stringify({ fileUrl }),
        });
    } catch (err) {
        console.error('[file-registry] Gagal menghapus catatan file via NestJS:', err);
    }
}

