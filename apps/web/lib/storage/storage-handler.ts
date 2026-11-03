/**
 * Unified Storage Handler
 * Routes file operations to the appropriate storage backend
 */

import { getStorageType } from '../file-storage';
import { uploadToCloudflareR2, deleteFromCloudflareR2, isCloudflareR2Url } from './cloudflare-storage';
import { registerUpload, unregisterUpload } from './file-registry';

// Result types
export interface UploadResult {
    ok: boolean;
    file_url?: string;
    file_path?: string;
    file_name?: string;
    error?: string;
}

export interface DeleteResult {
    ok: boolean;
    error?: string;
    /** Catatan terhapus, tapi berkas fisiknya harus dibersihkan manual. */
    manualCleanup?: boolean;
    warning?: string;
}

// Upload file based on configured storage type
export async function uploadFile(
    file: Buffer | Blob,
    fileName: string,
    folder?: string,
    registry?: { owner_auth_id: string; required?: boolean }
): Promise<UploadResult> {
    const storageType = await getStorageType();

    if (!storageType) {
        return {
            ok: false,
            error: 'Konfigurasi penyimpanan file belum diset. Silakan configure di menu Master Data → Penyimpanan File.'
        };
    }

    let result: UploadResult;
    switch (storageType) {
        /**
         * Supabase Storage sudah tidak dipakai lagi — tidak mengunggah, tidak
         * menghapus. Satu-satunya jejak yang tersisa adalah PEMBACAAN: berkas
         * lama dibiarkan di sana dengan URL publiknya (121 berkas pada snapshot
         * 2026-09-10, di antaranya SELURUH `registrasi_sanggar.pas_foto`), dan
         * URL publik tidak butuh kode apa pun dari sisi kita.
         *
         * Kalau konfigurasi lama masih menunjuk 'supabase', permintaannya tidak
         * dialihkan diam-diam ke R2: itu akan menyebarkan berkas ke dua tempat
         * tanpa ada yang tahu. Lebih baik gagal dengan pesan yang menyebutkan
         * apa yang harus diubah.
         */
        case 'supabase':
            return {
                ok: false,
                error:
                    'Penyimpanan Supabase sudah tidak dipakai untuk unggahan baru. ' +
                    'Ubah penyimpanan aktif ke Cloudflare R2 di Pengaturan → Penyimpanan File.',
            };

        case 'hosting' as any:
            return {
                ok: false,
                error:
                    'Penyimpanan Server Hosting sudah tidak dipakai untuk unggahan baru. ' +
                    'Ubah penyimpanan aktif ke Cloudflare R2 di Pengaturan → Penyimpanan File.',
            };

        case 'cloudflare':
            result = await handleCloudflareUpload(file, fileName, folder);
            break;

        default:
            return { ok: false, error: 'Tipe penyimpanan tidak dikenali' };
    }

    // Catat ke registry untuk kalkulasi kapasitas penyimpanan
    if (result.ok && result.file_url) {
        await registerUpload({
            owner_auth_id: registry?.owner_auth_id,
            file_url: result.file_url,
            file_name: result.file_name || fileName,
            folder: folder || 'general',
            size_bytes: Buffer.isBuffer(file) ? file.length : file.size,
            storage_type: storageType,
        }, registry?.required === true);
    }

    return result;
}

// Detect storage type from file URL
function detectStorageType(fileUrl: string): 'supabase' | 'google_drive' | 'cloudflare' | 'hosting' | null {
    if (!fileUrl) return null;

    // Tautan Google Drive bukan penyimpanan ACCA (mis. tautan yang ditempel pengguna):
    // jangan pernah dihapus, cukup cabut catatannya.
    if (fileUrl.includes('drive.google.com') || fileUrl.includes('docs.google.com')) {
        return 'google_drive';
    }

    // Check Hosting URL
    if (fileUrl.includes('acca_handler.php') || fileUrl.includes('/uploads/')) {
        return 'hosting';
    }

    // Check Cloudflare R2 URL
    if (isCloudflareR2Url(fileUrl)) {
        return 'cloudflare';
    }

    // Check Supabase Storage URL
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    if (supabaseUrl && fileUrl.includes(supabaseUrl) && fileUrl.includes('/storage/')) {
        return 'supabase';
    }

    return null;
}

// Delete file based on URL pattern (not current storage type)
export async function deleteFile(fileUrl: string, filePath?: string): Promise<DeleteResult> {
    if (!fileUrl) {
        return { ok: false, error: 'File URL tidak ditemukan' };
    }

    const detectedType = detectStorageType(fileUrl);

    let result: DeleteResult;
    switch (detectedType) {
        /**
         * Berkas lama di Supabase dan Server Hosting, serta tautan Google Drive, tidak dihapus secara fisik.
         * Dijawab `ok` supaya pencabutan catatan registry dan alur hapus di
         * pemanggil tetap berjalan lancar tanpa terganggu.
         */
        case 'supabase':
            console.warn(`[deleteFile] Supabase: berkas fisik perlu dihapus manual → ${fileUrl}`);
            result = {
                ok: true,
                manualCleanup: true,
                warning: 'Berkas fisik masih ada di Supabase Storage dan perlu dihapus manual.',
            };
            break;

        case 'google_drive':
            console.warn(`[deleteFile] Tautan Google Drive dilewati → ${fileUrl}`);
            result = {
                ok: true,
                manualCleanup: true,
                warning: 'Tautan Google Drive bukan penyimpanan ACCA, berkasnya tidak dihapus.',
            };
            break;

        case 'hosting':
            console.warn(`[deleteFile] Server Hosting: berkas fisik dilewati → ${fileUrl}`);
            result = {
                ok: true,
                manualCleanup: true,
                warning: 'Berkas fisik di server hosting dilewati dan dapat dihapus manual jika diperlukan.',
            };
            break;

        case 'cloudflare':
            result = await handleCloudflareDelete(fileUrl);
            break;

        default:
            return { ok: false, error: 'Tipe penyimpanan tidak dikenali' };
    }

    // Hapus catatan registry agar kalkulasi kapasitas tetap akurat
    if (result.ok) {
        await unregisterUpload(fileUrl);
    }

    return result;
}

// `handleSupabaseUpload` dan `handleSupabaseDelete` dihapus — lihat catatan pada
// `case 'supabase'` di uploadFile() dan deleteFile().

// Handle Cloudflare R2 upload
async function handleCloudflareUpload(file: Buffer | Blob, fileName: string, folder?: string): Promise<UploadResult> {
    try {
        const result = await uploadToCloudflareR2(file, fileName, folder);

        if (!result) {
            return { ok: false, error: 'Gagal upload ke Cloudflare R2' };
        }

        return {
            ok: true,
            file_url: result.file_url,
            file_path: result.file_path,
            file_name: result.file_name
        };
    } catch (error: any) {
        console.error('handleCloudflareUpload error:', error);
        return { ok: false, error: error.message || 'Gagal upload ke Cloudflare R2' };
    }
}

// Handle Cloudflare R2 delete
async function handleCloudflareDelete(fileUrl: string): Promise<DeleteResult> {
    try {
        const success = await deleteFromCloudflareR2(fileUrl);
        return { ok: success, error: success ? undefined : 'Gagal hapus dari Cloudflare R2' };
    } catch (error: any) {
        console.error('handleCloudflareDelete error:', error);
        return { ok: false, error: error.message || 'Gagal hapus dari Cloudflare R2' };
    }
}

// Check if a URL is a Supabase Storage URL
export function isSupabaseStorageUrl(url: string): boolean {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
    return url.includes(supabaseUrl) && url.includes('/storage/');
}

// Get storage type name for display
export function getStorageTypeName(type: string): string {
    const names: Record<string, string> = {
        'supabase': 'Supabase Storage',
        'cloudflare': 'Cloudflare R2',
    };
    return names[type] || type;
}
