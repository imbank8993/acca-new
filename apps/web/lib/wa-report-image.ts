/**
 * lib/wa-report-image.ts
 * Alur kirim laporan sebagai GAMBAR ke grup WA:
 *   HTML → render PNG (Puppeteer) → upload ke storage → kirim URL ke provider WA.
 *
 * Caller (whatsapp-piket / whatsapp-group) memakai ini bila mode gambar aktif,
 * dan tetap punya fallback ke pengiriman teks bila hasilnya tidak ok.
 */

import { renderHtmlToImage } from './report-image'
import { uploadFile } from './storage/storage-handler'
import { sendWhatsAppImage } from './wa-sender'

export async function sendReportAsImage(
    feature: 'piket' | 'ketidakhadiran',
    html: string,
    fileName: string,
    caption: string,
    mentions?: string[]
): Promise<{ ok: boolean; error?: string }> {
    // 1. Render HTML → PNG buffer
    let buffer: Buffer
    try {
        buffer = await renderHtmlToImage(html)
    } catch (err: any) {
        console.error(`[WA Image/${feature}] Render failed:`, err)
        return { ok: false, error: `render failed: ${err?.message || err}` }
    }

    // 2. Upload ke storage aktif (Supabase / GDrive / R2) → dapat URL publik
    const uploaded = await uploadFile(buffer, fileName, 'wa-reports')
    if (!uploaded.ok || !uploaded.file_url) {
        console.error(`[WA Image/${feature}] Upload failed:`, uploaded.error)
        return { ok: false, error: `upload failed: ${uploaded.error || 'no url'}` }
    }

    // 3. Kirim gambar via provider WA (Fonnte dsb.)
    return sendWhatsAppImage(feature, uploaded.file_url, caption, undefined, mentions)
}
