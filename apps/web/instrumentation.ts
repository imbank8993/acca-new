/**
 * apps/web/instrumentation.ts
 * Next.js Instrumentation Hook
 * Dijalankan otomatis satu kali saat server Next.js (Node.js runtime) melakukan proses booting/startup.
 */

export async function register() {
    // Pastikan hanya berjalan di server-side Node.js runtime (bukan edge runtime ataupun client browser)
    if (process.env.NEXT_RUNTIME === 'nodejs' && process.env.DISABLE_WHATSAPP_AUTOSTART !== 'true') {
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

    // Pemroses antrean WhatsApp PTSP (ptsp_wa_log): konfirmasi pengajuan dari aplikasi PTSP
    // yang perlu dikirim lewat acca-new (akun Baileys / percobaan ulang). Berjalan tiap 1 menit;
    // aman bila ada beberapa proses karena tiap pesan diklaim secara atomik di database.
    if (process.env.NEXT_RUNTIME === 'nodejs' && process.env.DISABLE_PTSP_WA_POLLER !== 'true') {
        const g = globalThis as unknown as { __ptspWaPoller?: ReturnType<typeof setInterval> }
        if (!g.__ptspWaPoller) {
            const tick = async () => {
                try {
                    const { processPtspWaQueue } = await import('./lib/ptsp-wa')
                    const result = await processPtspWaQueue(20)
                    if (result.processed > 0) {
                        console.log(`[PTSP-WA] Antrean diproses: ${result.success} terkirim, ${result.failed} gagal`)
                    }
                } catch (err) {
                    console.error('[PTSP-WA] Gagal memproses antrean:', err)
                }
            }
            // Tunda putaran pertama agar koneksi Baileys sempat tersambung setelah boot.
            setTimeout(() => void tick(), 30_000).unref?.()
            g.__ptspWaPoller = setInterval(() => void tick(), 60_000)
            g.__ptspWaPoller.unref?.()
            console.log('[Instrumentation] Pemroses antrean WhatsApp PTSP aktif (tiap 1 menit).')
        }
    }
}
