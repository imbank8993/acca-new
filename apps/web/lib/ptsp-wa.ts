/**
 * lib/ptsp-wa.ts
 * Pemroses antrean WhatsApp PTSP (tabel ptsp_wa_log).
 *
 * Antrean diisi oleh:
 *  - backend PTSP (ptsp.icgowa.sch.id) → konfirmasi pengajuan yang belum terkirim langsung
 *    (provider Baileys, atau gagal kirim sehingga perlu dicoba ulang);
 *  - API acca-new (PtspService.updateTableData) → notifikasi perubahan status.
 *
 * Dipicu oleh: poller tiap 1 menit (instrumentation.ts), route /api/ptsp setelah status disimpan,
 * dan GET /api/ptsp/notify-wa (manual, wajib login).
 *
 * Pengiriman memakai sendWhatsApp('ptsp', …) sehingga mengikuti akun yang ditugaskan ke PTSP
 * di Pengaturan Umum → Akun WhatsApp, termasuk Baileys yang sesinya hanya hidup di proses ini.
 *
 * ⚠️ SERVER-ONLY.
 */
import { prisma } from './prisma'
import { sendWhatsApp } from './wa-sender'

/** Maksimal percobaan per pesan. */
const MAX_ATTEMPTS = 3
/** Pesan yang lebih tua dari ini tidak dikirim lagi (mencegah blast pesan usang). */
const MAX_AGE_HOURS = 24
/** Jeda minimal antar percobaan untuk pesan yang sama (sekaligus "lease" anti kirim ganda). */
const RETRY_DELAY_SECONDS = 120

type ClaimedRow = {
    id: bigint
    short_code: string
    no_wa: string
    message_sent: string
    retry_count: number
}

export interface PtspWaProcessResult {
    ok: boolean
    processed: number
    success: number
    failed: number
    errors: string[]
}

let running: Promise<PtspWaProcessResult> | null = null

/**
 * Proses pesan PTSP yang tertunda. Aman dipanggil berulang/bersamaan:
 * baris diklaim secara atomik (FOR UPDATE SKIP LOCKED + lease wa_sent_at),
 * sehingga satu pesan tidak terkirim dua kali.
 */
export function processPtspWaQueue(limit = 20): Promise<PtspWaProcessResult> {
    // Di dalam satu proses, gabungkan pemanggilan yang bersamaan.
    if (running) return running
    running = doProcess(Math.max(1, Math.min(100, limit))).finally(() => { running = null })
    return running
}

async function doProcess(limit: number): Promise<PtspWaProcessResult> {
    const result: PtspWaProcessResult = { ok: true, processed: 0, success: 0, failed: 0, errors: [] }

    const claimed = await prisma.$queryRawUnsafe<ClaimedRow[]>(
        `UPDATE ptsp_wa_log
            SET retry_count = COALESCE(retry_count, 0) + 1,
                wa_sent_at = now()
          WHERE id IN (
                SELECT id FROM ptsp_wa_log
                 WHERE wa_sent IS NOT TRUE
                   AND COALESCE(retry_count, 0) < $1
                   AND message_sent IS NOT NULL AND message_sent <> ''
                   AND no_wa IS NOT NULL AND no_wa <> '' AND no_wa !~ '^0+$'
                   AND created_at > now() - ($2 || ' hours')::interval
                   AND (wa_sent_at IS NULL OR wa_sent_at < now() - ($3 || ' seconds')::interval)
                 ORDER BY created_at ASC
                 LIMIT $4
                 FOR UPDATE SKIP LOCKED)
        RETURNING id, short_code, no_wa, message_sent, retry_count`,
        MAX_ATTEMPTS, String(MAX_AGE_HOURS), String(RETRY_DELAY_SECONDS), limit,
    )

    for (const row of claimed) {
        result.processed++
        let ok = false
        let detail = ''
        try {
            const res = await sendWhatsApp(row.message_sent, 'ptsp', undefined, row.no_wa)
            ok = res.ok
            detail = res.error || (res.ok ? 'Terkirim via acca-new' : 'Gagal tanpa keterangan')
        } catch (err: any) {
            detail = `Error: ${err?.message || String(err)}`
        }

        const attemptNote = `[acca-new percobaan ${row.retry_count}/${MAX_ATTEMPTS}] ${detail}`.slice(0, 2000)
        try {
            if (ok) {
                await prisma.$executeRawUnsafe(
                    `UPDATE ptsp_wa_log SET wa_sent = true, wa_sent_at = now(), wa_response = $2 WHERE id = $1`,
                    row.id, attemptNote,
                )
            } else {
                // wa_sent_at tetap berisi waktu percobaan terakhir → percobaan berikutnya setelah RETRY_DELAY.
                await prisma.$executeRawUnsafe(
                    `UPDATE ptsp_wa_log SET wa_sent = false, wa_response = $2 WHERE id = $1`,
                    row.id, attemptNote,
                )
            }
        } catch (err: any) {
            console.error('[PTSP-WA] Gagal memperbarui status antrean', row.short_code, err?.message || err)
        }

        if (ok) result.success++
        else {
            result.failed++
            result.errors.push(`${row.short_code}: ${detail}`)
        }
    }

    if (result.failed > 0) console.warn('[PTSP-WA]', JSON.stringify(result.errors.slice(0, 10)))
    return result
}
