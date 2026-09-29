/**
 * lib/baileys.ts
 * Manajer koneksi WhatsApp gratis (self-host) via Baileys (WhatsApp Web socket).
 *
 * Berbeda dari Fonnte/Watzap/UltraMsg yang berbasis HTTP:
 * - Baileys menjaga SATU koneksi socket ke WhatsApp Web (satu nomor yang di-pairing via QR).
 * - Sesi (kredensial) disimpan ke disk agar bertahan saat restart (useMultiFileAuthState).
 * - HANYA jalan pada proses Node yang hidup lama (VPS `next start`), TIDAK di serverless/edge.
 *   Jika di-deploy multi-worker (PM2 cluster), pastikan hanya satu worker yang memegang socket.
 *
 * Konfigurasi:
 * - BAILEYS_AUTH_DIR (opsional) → folder penyimpanan sesi. Default: <cwd>/.baileys_auth
 *
 * Risiko: nomor WhatsApp bisa terkena banned karena ini bukan API resmi. Gunakan nomor khusus.
 */

import path from 'path'
// @ts-ignore - paket 'qrcode' tidak menyertakan file deklarasi tipe
import QRCode from 'qrcode'

type AnySock = any

interface BaileysState {
    sock: AnySock | null
    starting: boolean
    connection: 'close' | 'connecting' | 'open'
    qr: string | null            // QR mentah terakhir dari Baileys
    qrDataUrl: string | null     // QR sebagai data URL (untuk UI)
    user: { id: string; name?: string } | null
    lastError: string | null
}

// Simpan singleton di globalThis agar bertahan lintas reload modul (dev HMR / instansi route).
const g = globalThis as unknown as { __baileys?: BaileysState }
function store(): BaileysState {
    if (!g.__baileys) {
        g.__baileys = {
            sock: null,
            starting: false,
            connection: 'close',
            qr: null,
            qrDataUrl: null,
            user: null,
            lastError: null,
        }
    }
    return g.__baileys
}

// Logger minimal agar tidak perlu dependency pino.
const silentLogger: any = {
    level: 'silent',
    trace() {}, debug() {}, info() {}, warn() {}, error() {}, fatal() {},
    child() { return silentLogger },
}

function authDir(): string {
    return process.env.BAILEYS_AUTH_DIR || path.join(process.cwd(), '.baileys_auth')
}

/** Ubah target (nomor / JID) menjadi JID WhatsApp yang valid. */
export function toJid(target: string): string {
    const t = String(target).trim()
    if (t.includes('@')) return t // sudah JID (grup: ...@g.us, personal: ...@s.whatsapp.net)
    let num = t.replace(/[^\d]/g, '')
    if (num.startsWith('0')) num = '62' + num.slice(1)
    if (num.startsWith('8')) num = '62' + num
    return `${num}@s.whatsapp.net`
}

/** Mulai / pastikan koneksi berjalan. Idempoten. */
export async function startBaileys(): Promise<void> {
    const s = store()
    if (s.sock || s.starting) return
    s.starting = true
    s.lastError = null

    try {
        const mod: any = await import('@whiskeysockets/baileys')
        const makeWASocket = (typeof mod.default === 'function' ? mod.default : mod.makeWASocket)
        const { useMultiFileAuthState, fetchLatestBaileysVersion, DisconnectReason, Browsers } = mod

        const { state, saveCreds } = await useMultiFileAuthState(authDir())
        let version: any
        try { ({ version } = await fetchLatestBaileysVersion()) } catch { version = undefined }

        const sock = makeWASocket({
            version,
            auth: state,
            printQRInTerminal: false,
            browser: Browsers?.appropriate ? Browsers.appropriate('Chrome') : ['ACCA', 'Chrome', '1.0'],
            logger: silentLogger,
            syncFullHistory: false,
            markOnlineOnConnect: false,
        })
        s.sock = sock
        s.connection = 'connecting'

        sock.ev.on('creds.update', saveCreds)

        sock.ev.on('connection.update', async (update: any) => {
            const { connection, lastDisconnect, qr } = update

            if (qr) {
                s.qr = qr
                try { s.qrDataUrl = await QRCode.toDataURL(qr, { margin: 1, width: 300 }) } catch { s.qrDataUrl = null }
            }

            if (connection) s.connection = connection

            if (connection === 'open') {
                s.qr = null
                s.qrDataUrl = null
                s.user = sock.user ? { id: sock.user.id, name: sock.user.name || sock.user.verifiedName } : null
                s.lastError = null
                console.log('[Baileys] Connected as', s.user?.id)
            }

            if (connection === 'close') {
                const statusCode = lastDisconnect?.error?.output?.statusCode
                const loggedOut = statusCode === DisconnectReason?.loggedOut
                s.sock = null
                s.starting = false
                s.user = null
                s.lastError = lastDisconnect?.error?.message || null
                console.warn('[Baileys] Connection closed. loggedOut=', loggedOut, 'code=', statusCode)
                if (!loggedOut) {
                    // Reconnect otomatis (kecuali memang logout).
                    setTimeout(() => { startBaileys().catch(() => {}) }, 3000)
                } else {
                    // Sesi dicabut (401): kredensial di disk sudah mati. Bila dibiarkan,
                    // start berikutnya akan terus login→401 tanpa pernah memunculkan QR.
                    // Hapus agar start berikutnya (lazy-start dari polling status) masuk mode pairing QR.
                    try {
                        const fs = await import('fs')
                        fs.rmSync(authDir(), { recursive: true, force: true })
                        console.warn('[Baileys] Sesi dicabut — folder auth dihapus, silakan scan QR ulang di pengaturan.')
                    } catch (e) {
                        console.error('[Baileys] Gagal menghapus folder auth:', e)
                    }
                    s.lastError = 'Sesi WhatsApp dicabut. Silakan scan QR ulang di pengaturan.'
                }
            }
        })
    } catch (err: any) {
        s.lastError = err?.message || String(err)
        console.error('[Baileys] Start error:', err)
    } finally {
        s.starting = false
    }
}

/** Status koneksi untuk UI (termasuk QR bila menunggu pairing). */
export async function getBaileysStatus(): Promise<{
    connection: string
    connected: boolean
    qr: string | null
    user: { id: string; name?: string } | null
    error: string | null
}> {
    const s = store()
    // Lazy start bila belum ada socket dan belum tersambung.
    if (!s.sock && !s.starting) {
        await startBaileys()
    }
    return {
        connection: s.connection,
        connected: s.connection === 'open',
        qr: s.qrDataUrl,
        user: s.user,
        error: s.lastError,
    }
}

/** Putuskan & hapus sesi (perlu scan QR ulang untuk pakai lagi). */
export async function logoutBaileys(): Promise<void> {
    const s = store()
    try {
        if (s.sock) {
            try { await s.sock.logout() } catch { /* ignore */ }
        }
    } finally {
        s.sock = null
        s.starting = false
        s.connection = 'close'
        s.user = null
        s.qr = null
        s.qrDataUrl = null
        // Hapus folder sesi agar benar-benar bersih.
        try {
            const fs = await import('fs')
            fs.rmSync(authDir(), { recursive: true, force: true })
        } catch { /* ignore */ }
    }
}

async function waitForOpen(timeoutMs = 12000): Promise<boolean> {
    const s = store()
    if (s.connection === 'open' && s.sock) return true
    if (s.qrDataUrl || s.qr) return false
    await startBaileys()
    if (store().qrDataUrl || store().qr) return false
    const deadline = Date.now() + timeoutMs
    while (Date.now() < deadline) {
        if (store().connection === 'open' && store().sock) return true
        if (store().qrDataUrl || store().qr) return false
        await new Promise(r => setTimeout(r, 400))
    }
    return store().connection === 'open' && !!store().sock
}

/** Kirim teks ke satu target. */
export async function baileysSendText(target: string, text: string, mentions?: string[]): Promise<{ ok: boolean; error?: string }> {
    const ok = await waitForOpen()
    if (!ok) return { ok: false, error: store().lastError || 'Baileys belum tersambung (scan QR di pengaturan)' }
    try {
        await store().sock.sendMessage(toJid(target), { text, mentions })
        return { ok: true }
    } catch (err: any) {
        return { ok: false, error: err?.message || String(err) }
    }
}

/** Kirim gambar (dari URL) + caption ke satu target. */
export async function baileysSendImage(target: string, imageUrl: string, caption: string, mentions?: string[]): Promise<{ ok: boolean; error?: string }> {
    const ok = await waitForOpen()
    if (!ok) return { ok: false, error: store().lastError || 'Baileys belum tersambung (scan QR di pengaturan)' }
    try {
        await store().sock.sendMessage(toJid(target), { image: { url: imageUrl }, caption, mentions })
        return { ok: true }
    } catch (err: any) {
        return { ok: false, error: err?.message || String(err) }
    }
}
