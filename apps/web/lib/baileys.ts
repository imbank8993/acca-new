/**
 * lib/baileys.ts
 * Manajer koneksi WhatsApp gratis (self-host) via Baileys (WhatsApp Web socket).
 *
 * Berbeda dari Fonnte/Watzap/UltraMsg yang berbasis HTTP:
 * - Setiap akun Baileys menjaga koneksi dan sesi WhatsApp Web sendiri.
 * - Sesi (kredensial) disimpan ke folder akun agar bertahan saat restart.
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

// Map di globalThis menjaga tiap akun bertahan lintas reload modul (dev HMR).
const g = globalThis as unknown as { __baileysInstances?: Record<string, BaileysState> }
function normalizeAccountId(accountId = 'default'): string {
    const id = String(accountId || 'default')
    if (!/^[a-zA-Z0-9_-]{1,80}$/.test(id)) throw new Error('ID akun WhatsApp tidak valid')
    return id
}
function store(accountId = 'default'): BaileysState {
    const id = normalizeAccountId(accountId)
    if (!g.__baileysInstances) g.__baileysInstances = {}
    if (!g.__baileysInstances[id]) {
        g.__baileysInstances[id] = {
            sock: null,
            starting: false,
            connection: 'close',
            qr: null,
            qrDataUrl: null,
            user: null,
            lastError: null,
        }
    }
    return g.__baileysInstances[id]
}

// Logger minimal agar tidak perlu dependency pino.
const silentLogger: any = {
    level: 'silent',
    trace() {}, debug() {}, info() {}, warn() {}, error() {}, fatal() {},
    child() { return silentLogger },
}

function authDir(accountId = 'default'): string {
    const root = process.env.BAILEYS_AUTH_DIR || path.join(process.cwd(), '.baileys_auth')
    const id = normalizeAccountId(accountId)
    return id === 'default' ? root : path.join(root, id)
}

/** Hapus semua isi folder sesi tanpa menghapus mount point volume Docker itu sendiri */
async function clearAuthDir(accountId = 'default'): Promise<void> {
    try {
        const fs = await import('fs')
        const dir = authDir(accountId)
        if (fs.existsSync(dir)) {
            const entries = fs.readdirSync(dir)
            for (const entry of entries) {
                const entryPath = path.join(dir, entry)
                // Folder root lama adalah sesi akun `default`; jangan hapus
                // subfolder sesi akun Baileys lain saat akun lama diputuskan.
                if (normalizeAccountId(accountId) === 'default' && fs.statSync(entryPath).isDirectory()) continue
                fs.rmSync(entryPath, { recursive: true, force: true })
            }
            console.log('[Baileys] Folder sesi dibersihkan.')
        }
    } catch (e) {
        console.error('[Baileys] Gagal membersihkan isi folder auth:', e)
    }
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
export async function startBaileys(accountId = 'default'): Promise<void> {
    const id = normalizeAccountId(accountId)
    const s = store(id)
    if (s.sock || s.starting) return
    s.starting = true
    s.lastError = null

    try {
        const mod: any = await import('@whiskeysockets/baileys')
        const makeWASocket = (typeof mod.default === 'function' ? mod.default : mod.makeWASocket)
        const { useMultiFileAuthState, fetchLatestBaileysVersion, DisconnectReason, Browsers } = mod

        const { state, saveCreds } = await useMultiFileAuthState(authDir(id))
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
                console.log(`[Baileys:${id}] Connected as`, s.user?.id)
            }

            if (connection === 'close') {
                const statusCode = lastDisconnect?.error?.output?.statusCode
                const loggedOut = statusCode === DisconnectReason?.loggedOut
                s.sock = null
                s.starting = false
                s.user = null
                s.lastError = lastDisconnect?.error?.message || null
                console.warn(`[Baileys:${id}] Connection closed. loggedOut=`, loggedOut, 'code=', statusCode)
                if (!loggedOut) {
                    // Reconnect otomatis (kecuali memang logout).
                    setTimeout(() => { startBaileys(id).catch(() => {}) }, 3000)
                } else {
                    // Sesi dicabut (401): kredensial di disk sudah mati. Bila dibiarkan,
                    // start berikutnya akan terus login→401 tanpa pernah memunculkan QR.
                    // Hapus agar start berikutnya (lazy-start dari polling status) masuk mode pairing QR.
                    await clearAuthDir(id)
                    console.warn(`[Baileys:${id}] Sesi dicabut — folder akun dibersihkan, silakan scan QR ulang.`)
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
export async function getBaileysStatus(accountId = 'default'): Promise<{
    connection: string
    connected: boolean
    qr: string | null
    user: { id: string; name?: string } | null
    error: string | null
}> {
    const id = normalizeAccountId(accountId)
    const s = store(id)
    // Lazy start bila belum ada socket dan belum tersambung.
    if (!s.sock && !s.starting) {
        await startBaileys(id)
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
export async function logoutBaileys(accountId = 'default'): Promise<void> {
    const id = normalizeAccountId(accountId)
    const s = store(id)
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
        // Hapus isi folder sesi agar benar-benar bersih.
        await clearAuthDir(id)
    }
}

async function waitForOpen(accountId = 'default', timeoutMs = 12000): Promise<boolean> {
    const id = normalizeAccountId(accountId)
    const s = store(id)
    if (s.connection === 'open' && s.sock) return true
    if (s.qrDataUrl || s.qr) return false
    await startBaileys(id)
    if (store(id).qrDataUrl || store(id).qr) return false
    const deadline = Date.now() + timeoutMs
    while (Date.now() < deadline) {
        if (store(id).connection === 'open' && store(id).sock) return true
        if (store(id).qrDataUrl || store(id).qr) return false
        await new Promise(r => setTimeout(r, 400))
    }
    return store(id).connection === 'open' && !!store(id).sock
}

/** Kirim teks ke satu target. */
export async function baileysSendText(target: string, text: string, mentions?: string[], accountId = 'default'): Promise<{ ok: boolean; error?: string }> {
    const ok = await waitForOpen(accountId)
    if (!ok) return { ok: false, error: store(accountId).lastError || 'Baileys belum tersambung (scan QR di pengaturan)' }
    try {
        await store(accountId).sock.sendMessage(toJid(target), { text, mentions })
        return { ok: true }
    } catch (err: any) {
        return { ok: false, error: err?.message || String(err) }
    }
}

/** Kirim gambar (dari URL) + caption ke satu target. */
export async function baileysSendImage(target: string, imageUrl: string, caption: string, mentions?: string[], accountId = 'default'): Promise<{ ok: boolean; error?: string }> {
    const ok = await waitForOpen(accountId)
    if (!ok) return { ok: false, error: store(accountId).lastError || 'Baileys belum tersambung (scan QR di pengaturan)' }
    try {
        await store(accountId).sock.sendMessage(toJid(target), { image: { url: imageUrl }, caption, mentions })
        return { ok: true }
    } catch (err: any) {
        return { ok: false, error: err?.message || String(err) }
    }
}

// Graceful shutdown: tutup koneksi socket secara rapi saat container dihentikan
if (typeof process !== 'undefined' && typeof process.once === 'function') {
    const handleShutdown = () => {
        for (const s of Object.values(g.__baileysInstances || {})) if (s.sock) {
            try {
                console.log('[Baileys] Menutup koneksi socket secara rapi (shutdown)...')
                s.sock.end(undefined)
            } catch { /* ignore */ }
        }
    }
    process.once('SIGTERM', handleShutdown)
    process.once('SIGINT', handleShutdown)
}

