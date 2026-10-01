/**
 * apps/web/instrumentation.ts
 * Next.js Instrumentation Hook
 * Dijalankan otomatis satu kali saat server Next.js (Node.js runtime) melakukan proses booting/startup.
 */

export async function register() {
    // Pastikan hanya berjalan di server-side Node.js runtime (bukan edge runtime ataupun client browser)
    if (process.env.NEXT_RUNTIME === 'nodejs') {
        try {
            const { startBaileys } = await import('./lib/baileys')
            console.log('[Instrumentation] Inisialisasi otomatis koneksi Baileys WhatsApp saat server boot...')
            // Panggil tanpa memblokir startup server
            startBaileys().catch((err: any) => {
                console.error('[Instrumentation] Gagal auto-start Baileys:', err)
            })
        } catch (err) {
            console.error('[Instrumentation] Error loading Baileys module:', err)
        }
    }
}
