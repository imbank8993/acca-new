/**
 * lib/report-image.ts
 * Render HTML laporan menjadi gambar JPEG menggunakan Puppeteer (headless Chromium).
 * Dipakai untuk mengirim laporan piket / ketidakhadiran ke grup WA dalam bentuk gambar.
 *
 * Kenapa JPEG, bukan PNG/WebP:
 * - WebP adalah format STIKER di WhatsApp. Kita mengirim gambar lewat endpoint foto
 *   (Fonnte `url`, UltraMsg /messages/image, dst.); sebagian provider merutekan .webp
 *   jadi stiker, dan stiker TIDAK punya caption — caption itulah tempat link galeri
 *   dokumentasi. Jadi webp berisiko menghilangkan link sekaligus bikin tabel tampil kecil.
 * - JPEG selalu diperlakukan sebagai foto oleh semua provider, ukurannya lebih kecil
 *   dari PNG, dan WhatsApp toh mengompres ulang foto di sisinya.
 * - Tanpa alpha bukan masalah: `body` laporan punya background solid (#f8fafc), jadi
 *   area di luar sudut membulat #report tetap opak, bukan transparan → tidak jadi hitam.
 *
 * Catatan VPS (BT Panel / Node):
 * - Chromium yang dipakai Puppeteer perlu beberapa lib sistem. Bila render gagal dengan
 *   error "libX..." / "shared libraries", install dependency Chromium (lihat README/wa).
 * - Gunakan PUPPETEER_EXECUTABLE_PATH bila ingin memakai Chrome sistem, bukan bawaan Puppeteer.
 */

import type { Browser } from 'puppeteer'

/**
 * Ekstensi berkas gambar laporan — satu sumber untuk semua pemanggil.
 * MIME saat upload diturunkan dari ekstensi ini (lihat lib/storage/mime.ts),
 * jadi ekstensi dan format screenshot di bawah WAJIB sejalan.
 */
export const REPORT_IMAGE_EXT = 'jpg'

/**
 * Diukur pada laporan piket nyata (lebar 1000 @2x): PNG 193 KB (12 baris) / 304 KB (30 baris),
 * JPEG q92 148 KB / 337 KB — jadi q92 justru LEBIH BESAR dari PNG untuk laporan panjang,
 * karena tabel berwarna datar sangat efisien di PNG. q85 (118 KB / 267 KB) konsisten lebih
 * kecil di kedua ukuran dan pada deviceScaleFactor 2 teksnya masih tajam.
 */
const JPEG_QUALITY = 85

/**
 * Render sepotong HTML menjadi Buffer JPEG.
 * HTML sebaiknya memiliki elemen dengan id="report" sebagai area yang di-screenshot.
 * Jika tidak ada, seluruh halaman (fullPage) akan di-screenshot.
 */
export async function renderHtmlToImage(html: string, width = 1000): Promise<Buffer> {
    // Import dinamis agar tidak ikut ter-bundle pada runtime yang tak butuh (mis. edge).
    const puppeteer = (await import('puppeteer')).default

    let browser: Browser | null = null
    try {
        const { launchPuppeteerBrowser } = await import('./puppeteer-launcher')
        browser = await launchPuppeteerBrowser()

        const page = await browser.newPage()
        // deviceScaleFactor 2 → gambar tajam saat dibuka di WhatsApp.
        await page.setViewport({ width, height: 800, deviceScaleFactor: 2 })
        await page.setContent(html, { waitUntil: 'load', timeout: 30000 })

        const el = await page.$('#report')
        const shot = el
            ? await el.screenshot({ type: 'jpeg', quality: JPEG_QUALITY })
            : await page.screenshot({ type: 'jpeg', quality: JPEG_QUALITY, fullPage: true })

        return Buffer.from(shot)
    } finally {
        if (browser) {
            try { await browser.close() } catch { /* ignore */ }
        }
    }
}
