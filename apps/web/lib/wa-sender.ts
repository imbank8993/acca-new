/**
 * lib/wa-sender.ts
 * Abstraction layer untuk mengirim WhatsApp via konfigurasi database (site_settings).
 * Mendukung multi-target per fitur.
 *
 * Konfigurasi per fitur (site_settings):
 *
 * PIKET:
 * - wa_token_piket              → Token API
 * - wa_targets_piket            → JSON array [{id, name, code}, ...]
 * - wa_template_piket           → Template pesan utama
 * - wa_details_row_template_piket → Template baris data
 * - notif_wa_piket              → Toggle aktif/nonaktif
 *
 * KETIDAKHADIRAN:
 * - wa_token_ketidakhadiran     → Token API
 * - wa_targets_ketidakhadiran   → JSON array [{id, name, code}, ...]
 * - wa_template_ketidakhadiran → Template pesan utama
 * - wa_details_row_template_ketidakhadiran → Template baris data
 * - notif_wa_ketidakhadiran     → Toggle aktif/nonaktif
 *
 * PTSP:
 * - wa_token_ptsp               → Token API
 * - wa_targets_ptsp             → JSON array [{id, name, code}, ...]
 * - wa_template_ptsp           → Template pesan utama (bisa pakai status-specific)
 * - notif_wa_ptsp               → Toggle aktif/nonaktif
 */

import { prisma } from './prisma'

interface WATarget {
    id: string
    name: string
    code: string
}

interface WAConfig {
    provider: 'fonnte' | 'watzap' | 'ultramsg' | 'baileys'
    token: string
    targets: WATarget[]
    template?: string
    detailsRowTemplate?: string
}

interface WASettings {
    [key: string]: string
}

const CONFIG_CACHE: { data: WASettings | null; timestamp: number } = { data: null, timestamp: 0 }
const CACHE_TTL_MS = 5 * 60 * 1000 // 5 menit

async function getWASettings(): Promise<WASettings> {
    const now = Date.now()
    if (CONFIG_CACHE.data && (now - CONFIG_CACHE.timestamp) < CACHE_TTL_MS) {
        return CONFIG_CACHE.data
    }

    const data = await prisma.site_settings.findMany({
        select: { key: true, value: true }
    })

    const settings: WASettings = {}
    if (data) {
        data.forEach(row => { settings[row.key] = row.value ?? '' })
    }

    CONFIG_CACHE.data = settings
    CONFIG_CACHE.timestamp = now
    return settings
}

export function clearWAConfigCache() {
    CONFIG_CACHE.data = null
    CONFIG_CACHE.timestamp = 0
}

export async function isWAToggleEnabled(toggle: 'notif_wa_ptsp' | 'notif_wa_piket' | 'notif_wa_ketidakhadiran' | 'notif_wa_jadwal' | 'notif_wa_guru_asuh' | 'notif_wa_klinik'): Promise<boolean> {
    const settings = await getWASettings()
    if (toggle === 'notif_wa_guru_asuh' || toggle === 'notif_wa_klinik') {
        return settings[toggle] !== 'false'
    }
    return settings[toggle] === 'true'
}

/** Apakah fitur ini dikonfigurasi untuk mengirim laporan dalam bentuk gambar (bukan teks). */
export async function isWAImageMode(feature: 'piket' | 'ketidakhadiran'): Promise<boolean> {
    const settings = await getWASettings()
    return settings[`wa_as_image_${feature}`] === 'true'
}

interface TargetConfig {
    tokenKey: 'wa_token_piket' | 'wa_token_ketidakhadiran' | 'wa_token_ptsp' | 'wa_token_sanggar' | 'wa_token_jadwal' | 'wa_token_guru_asuh' | 'wa_token_klinik'
    targetsKey: 'wa_targets_piket' | 'wa_targets_ketidakhadiran' | 'wa_targets_ptsp' | 'wa_targets_sanggar' | 'wa_targets_jadwal' | 'wa_targets_guru_asuh' | 'wa_targets_klinik'
}

const TARGET_CONFIGS: Record<string, TargetConfig> = {
    piket: { tokenKey: 'wa_token_piket', targetsKey: 'wa_targets_piket' },
    ketidakhadiran: { tokenKey: 'wa_token_ketidakhadiran', targetsKey: 'wa_targets_ketidakhadiran' },
    ptsp: { tokenKey: 'wa_token_ptsp', targetsKey: 'wa_targets_ptsp' },
    // Sanggar: blast per-peserta. Tak pakai `targets` tetap (selalu overrideTarget
    // = nomor peserta), tapi tetap butuh token (wa_token_sanggar).
    sanggar: { tokenKey: 'wa_token_sanggar', targetsKey: 'wa_targets_sanggar' },
    // Jadwal: seperti sanggar, selalu per-orang (overrideTarget = no_hp guru),
    // bukan ke grup. Tukar jadwal hanya menyangkut pihak yang terlibat.
    jadwal: { tokenKey: 'wa_token_jadwal', targetsKey: 'wa_targets_jadwal' },
    // Guru Asuh: dikirim ke user yang ditunjuk sebagai approver
    guru_asuh: { tokenKey: 'wa_token_guru_asuh', targetsKey: 'wa_targets_guru_asuh' },
    // Klinik: dikirim ke user yang ditunjuk sebagai approver laporan klinik
    klinik: { tokenKey: 'wa_token_klinik', targetsKey: 'wa_targets_klinik' },
}

async function getWAConfig(feature: string): Promise<WAConfig | null> {
    const settings = await getWASettings()
    const config = TARGET_CONFIGS[feature]

    if (!config) {
        console.warn(`[WA] Unknown feature: ${feature}`)
        return null
    }

    // Provider per-fitur (wa_provider_<feature>), fallback ke global (wa_provider), lalu provider piket/fonnte.
    const provider = settings[`wa_provider_${feature}`] || settings.wa_provider || settings.wa_provider_piket || 'fonnte'
    const token = settings[config.tokenKey] || settings.wa_token || settings.wa_token_piket || settings.wa_token_ptsp || ''
    const template = settings[`wa_template_${feature}`]
    const detailsRowTemplate = settings[`wa_details_row_template_${feature}`]

    // Parse targets from JSON
    let targets: WATarget[] = []
    try {
        const targetsRaw = settings[config.targetsKey]
        if (targetsRaw) {
            targets = JSON.parse(targetsRaw)
        }
    } catch (e) {
        console.warn(`[WA] Failed to parse targets for ${feature}`)
    }

    // Baileys tak butuh token (pakai sesi WhatsApp Web); provider lain wajib token.
    if (!provider || (provider !== 'baileys' && !token)) {
        console.warn(`[WA] Missing config for ${feature}: provider=${!!provider}, token=${!!token}`)
        return null
    }

    return { provider: provider as WAConfig['provider'], token, targets, template, detailsRowTemplate }
}

async function getWATemplate(feature: string, status?: string): Promise<string | null> {
    const settings = await getWASettings()

    // Try status-specific template first (e.g., wa_template_ptsp_accepted)
    if (status) {
        const statusTemplate = settings[`wa_template_${feature}_${status}`]
        if (statusTemplate) return statusTemplate
    }

    // Fall back to generic template
    return settings[`wa_template_${feature}`] || null
}

/**
 * Isi sebuah template pesan: buang blok kondisional `{{#key}}...{{/key}}` yang datanya
 * kosong, lalu ganti placeholder `{{key}}`.
 *
 * Blok kondisional dulu supaya isi blok yang dibuang tidak sempat tersubstitusi.
 * Nilai disisipkan lewat fungsi replacer agar karakter `$` di dalam data (mis. `$&`)
 * tidak ditafsirkan sebagai pola pengganti oleh String.replace.
 *
 * Dipakai untuk template baris DAN template pesan utama. Sebelumnya blok kondisional
 * hanya diproses untuk template baris, sehingga template utama bawaan piket yang memakai
 * `{{#keterangan}}` mengirim penanda mentahnya apa adanya ke grup WA.
 */
function renderTemplate(template: string, data: Record<string, string>): string {
    let out = template.replace(
        /\{\{#(\w+)\}\}([\s\S]*?)\{\{\/\1\}\}/g,
        (_, key: string, content: string) => (data[key] ? content : '')
    )

    for (const [key, value] of Object.entries(data)) {
        out = out.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), () => value ?? '')
    }

    return out
}

function normalizeTarget(target: string): string {
    const cleaned = target.replace(/[\s\-+]/g, '')
    if (cleaned.startsWith('62')) return '0' + cleaned.slice(2)
    if (cleaned.startsWith('8')) return '0' + cleaned
    return cleaned
}

/** Hasil satu pengiriman ke satu target; `error` diisi agar sebab gagal bisa naik ke UI. */
type SendResult = { ok: boolean; error?: string }

/** Fonnte menganggap sukses bila status=true atau detail berisi kirim/sent/pending. */
function fonnteOk(data: any): boolean {
    return data?.status === true ||
        (typeof data?.detail === 'string' &&
            (data.detail.toLowerCase().includes('kirim') ||
                data.detail.toLowerCase().includes('sent') ||
                data.detail.toLowerCase().includes('pending')))
}

async function sendFonnte(token: string, target: string, message: string): Promise<SendResult> {
    try {
        const res = await fetch('https://api.fonnte.com/send', {
            method: 'POST',
            headers: {
                'Authorization': token,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ target: normalizeTarget(target), message }),
        })
        const data = await res.json()
        console.log('[WA/Fonnte] Response:', JSON.stringify(data))

        if (fonnteOk(data)) return { ok: true }
        return { ok: false, error: `Fonnte: ${data?.reason || data?.detail || JSON.stringify(data)}` }
    } catch (err: any) {
        console.error('[WA/Fonnte] Error:', err)
        return { ok: false, error: `Fonnte: ${err?.message || String(err)}` }
    }
}

async function sendWatzap(token: string, target: string, message: string): Promise<SendResult> {
    try {
        const res = await fetch('https://www.watzap.me/api/send', {
            method: 'POST',
            headers: {
                'Authorization': token,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ number: normalizeTarget(target), message }),
        })
        const data = await res.json()
        console.log('[WA/Watzap] Response:', JSON.stringify(data))
        if (data?.success === true) return { ok: true }
        return { ok: false, error: `Watzap: ${data?.message || JSON.stringify(data)}` }
    } catch (err: any) {
        console.error('[WA/Watzap] Error:', err)
        return { ok: false, error: `Watzap: ${err?.message || String(err)}` }
    }
}

async function sendUltramsg(token: string, target: string, message: string): Promise<SendResult> {
    try {
        const res = await fetch(`https://api.ultramsg.com/instance/${token}/messages/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                token,
                to: normalizeTarget(target),
                body: message,
            }),
        })
        const data = await res.json()
        console.log('[WA/Ultramsg] Response:', JSON.stringify(data))
        if (data?.sent === true || data?.success === true) return { ok: true }
        return { ok: false, error: `Ultramsg: ${data?.error || JSON.stringify(data)}` }
    } catch (err: any) {
        console.error('[WA/Ultramsg] Error:', err)
        return { ok: false, error: `Ultramsg: ${err?.message || String(err)}` }
    }
}

async function sendBaileysText(target: string, message: string, mentions?: string[]): Promise<SendResult> {
    try {
        const { baileysSendText } = await import('./baileys')
        const r = await baileysSendText(target, message, mentions)
        if (!r.ok) {
            console.error('[WA/Baileys] Error:', r.error)
            return { ok: false, error: `Baileys: ${r.error || 'unknown'}` }
        }
        return { ok: true }
    } catch (err: any) {
        console.error('[WA/Baileys] Error:', err)
        return { ok: false, error: `Baileys: ${err?.message || String(err)}` }
    }
}

// ─── Media (gambar) senders ──────────────────────────────────────────────

async function sendFonnteMedia(token: string, target: string, imageUrl: string, caption: string): Promise<SendResult> {
    try {
        const res = await fetch('https://api.fonnte.com/send', {
            method: 'POST',
            headers: {
                'Authorization': token,
                'Content-Type': 'application/json',
            },
            // Fonnte otomatis mengirim sebagai gambar bila parameter `url` ada.
            body: JSON.stringify({ target: normalizeTarget(target), url: imageUrl, message: caption }),
        })
        const data = await res.json()
        console.log('[WA/Fonnte:media] Response:', JSON.stringify(data))
        if (fonnteOk(data)) return { ok: true }
        return { ok: false, error: `Fonnte: ${data?.reason || data?.detail || JSON.stringify(data)}` }
    } catch (err: any) {
        console.error('[WA/Fonnte:media] Error:', err)
        return { ok: false, error: `Fonnte: ${err?.message || String(err)}` }
    }
}

async function sendWatzapMedia(token: string, target: string, imageUrl: string, caption: string): Promise<SendResult> {
    try {
        const res = await fetch('https://www.watzap.me/api/send_image_url', {
            method: 'POST',
            headers: { 'Authorization': token, 'Content-Type': 'application/json' },
            body: JSON.stringify({ number: normalizeTarget(target), url: imageUrl, caption }),
        })
        const data = await res.json()
        console.log('[WA/Watzap:media] Response:', JSON.stringify(data))
        if (data?.success === true) return { ok: true }
        return { ok: false, error: `Watzap: ${data?.message || JSON.stringify(data)}` }
    } catch (err: any) {
        console.error('[WA/Watzap:media] Error:', err)
        return { ok: false, error: `Watzap: ${err?.message || String(err)}` }
    }
}

async function sendUltramsgMedia(token: string, target: string, imageUrl: string, caption: string): Promise<SendResult> {
    try {
        const res = await fetch(`https://api.ultramsg.com/instance/${token}/messages/image`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token, to: normalizeTarget(target), image: imageUrl, caption }),
        })
        const data = await res.json()
        console.log('[WA/Ultramsg:media] Response:', JSON.stringify(data))
        if (data?.sent === true || data?.success === true) return { ok: true }
        return { ok: false, error: `Ultramsg: ${data?.error || JSON.stringify(data)}` }
    } catch (err: any) {
        console.error('[WA/Ultramsg:media] Error:', err)
        return { ok: false, error: `Ultramsg: ${err?.message || String(err)}` }
    }
}

async function sendBaileysMedia(target: string, imageUrl: string, caption: string, mentions?: string[]): Promise<SendResult> {
    try {
        const { baileysSendImage } = await import('./baileys')
        const r = await baileysSendImage(target, imageUrl, caption, mentions)
        if (!r.ok) {
            console.error('[WA/Baileys:media] Error:', r.error)
            return { ok: false, error: `Baileys: ${r.error || 'unknown'}` }
        }
        return { ok: true }
    } catch (err: any) {
        console.error('[WA/Baileys:media] Error:', err)
        return { ok: false, error: `Baileys: ${err?.message || String(err)}` }
    }
}

/**
 * Kirim gambar (URL publik) ke semua target terkonfigurasi untuk sebuah fitur.
 * `caption` adalah teks pendamping ringkas agar tetap bisa dicari di WhatsApp.
 */
export async function sendWhatsAppImage(
    feature: 'piket' | 'ketidakhadiran' | 'ptsp',
    imageUrl: string,
    caption: string,
    overrideTarget?: string,
    mentions?: string[]
): Promise<{ ok: boolean; error?: string }> {
    const config = await getWAConfig(feature)
    if (!config) {
        return { ok: false, error: 'WA config not available' }
    }

    let validTargets: Array<{ code: string }> = []
    if (overrideTarget && overrideTarget.trim()) {
        validTargets = [{ code: overrideTarget.trim() }]
    } else {
        validTargets = config.targets.filter(t => t.code.trim())
    }

    if (validTargets.length === 0) {
        return { ok: false, error: 'No valid targets configured' }
    }

    let successCount = 0
    const errors: string[] = []

    for (const target of validTargets) {
        let result: SendResult = { ok: false, error: `Provider tidak dikenali: ${config.provider}` }
        switch (config.provider) {
            case 'fonnte':
                result = await sendFonnteMedia(config.token, target.code, imageUrl, caption)
                break
            case 'watzap':
                result = await sendWatzapMedia(config.token, target.code, imageUrl, caption)
                break
            case 'ultramsg':
                result = await sendUltramsgMedia(config.token, target.code, imageUrl, caption)
                break
            case 'baileys':
                result = await sendBaileysMedia(target.code, imageUrl, caption, mentions)
                break
        }
        if (result.ok) successCount++
        else errors.push(`${target.code} → ${result.error || 'unknown'}`)
    }

    if (successCount > 0 && errors.length === 0) {
        return { ok: true }
    } else if (successCount > 0) {
        return { ok: true, error: `Terkirim ke ${successCount} target, gagal ${errors.length}: ${errors.join('; ')}` }
    } else {
        return { ok: false, error: `Gagal kirim gambar ke semua ${validTargets.length} target: ${errors.join('; ')}` }
    }
}

export async function sendWhatsApp(
    message: string,
    feature: 'piket' | 'ketidakhadiran' | 'ptsp' | 'sanggar' | 'jadwal' | 'guru_asuh' | 'klinik',
    data?: Record<string, string>,
    overrideTarget?: string,
    mentions?: string[]
): Promise<{ ok: boolean; error?: string }> {
    const config = await getWAConfig(feature)

    if (!config) {
        return { ok: false, error: 'WA config not available' }
    }

    // Filter valid targets: Gunakan overrideTarget jika disuplai, jika tidak gunakan config.targets
    let validTargets: Array<{ code: string }> = [];
    if (overrideTarget && overrideTarget.trim()) {
        validTargets = [{ code: overrideTarget.trim() }];
    } else {
        validTargets = config.targets.filter(t => t.code.trim());
    }

    if (validTargets.length === 0) {
        return { ok: false, error: 'No valid targets configured' }
    }

    let finalMessage = message

    // Check for status-specific template (e.g., for PTSP accepted/rejected/completed)
    const status = data?.status
    let templateToUse = status ? await getWATemplate(feature, status) : null
    templateToUse = templateToUse || config.template || null

    if (templateToUse && templateToUse.trim()) {
        finalMessage = renderTemplate(templateToUse, data || {})
    }

    if (mentions && mentions.length > 0) {
        const tags = mentions.map(m => '@' + m.split('@')[0]).join(' ')
        finalMessage += `\n\nCC: ${tags}`
    }

    return dispatchText(config, validTargets, finalMessage, mentions)
}

/** Kirim satu pesan teks ke semua target dengan provider terkonfigurasi. */
async function dispatchText(
    config: WAConfig,
    validTargets: Array<{ code: string }>,
    finalMessage: string,
    mentions?: string[]
): Promise<{ ok: boolean; error?: string }> {
    let successCount = 0
    const errors: string[] = []

    for (const target of validTargets) {
        let result: SendResult = { ok: false, error: `Provider tidak dikenali: ${config.provider}` }
        switch (config.provider) {
            case 'fonnte':
                result = await sendFonnte(config.token, target.code, finalMessage)
                break
            case 'watzap':
                result = await sendWatzap(config.token, target.code, finalMessage)
                break
            case 'ultramsg':
                result = await sendUltramsg(config.token, target.code, finalMessage)
                break
            case 'baileys':
                result = await sendBaileysText(target.code, finalMessage, mentions)
                break
        }

        if (result.ok) successCount++
        else errors.push(`${target.code} → ${result.error || 'unknown'}`)
    }

    if (successCount > 0 && errors.length === 0) {
        return { ok: true }
    } else if (successCount > 0) {
        return { ok: true, error: `Terkirim ke ${successCount} target, gagal ${errors.length}: ${errors.join('; ')}` }
    } else {
        return { ok: false, error: `Gagal kirim ke semua ${validTargets.length} target: ${errors.join('; ')}` }
    }
}

export async function sendWhatsAppWithTemplate(
    feature: 'piket' | 'ketidakhadiran' | 'ptsp',
    data: Record<string, string>,
    overrideTarget?: string,
    mentions?: string[]
): Promise<{ ok: boolean; error?: string }> {
    return sendWhatsApp('', feature, data, overrideTarget, mentions)
}

/**
 * Teks yang ditempel di akhir pesan HANYA bila template belum memakai placeholder
 * `{{<key>}}`-nya. Dipakai untuk hal yang wajib sampai ke penerima tapi belum tentu
 * ada di template tersimpan — mis. link galeri dokumentasi piket atau penanda
 * "Bagian 1/2". Admin yang menaruh placeholder-nya sendiri tidak akan kena dobel.
 */
export interface WAAutoAppend { key: string; text: string }

/**
 * Susun teks pesan final (template utama + baris detail) TANPA mengirimnya.
 *
 * Dipisah dari pengiriman supaya pratinjau di UI memakai jalur yang persis sama
 * dengan yang dikirim. Sebelumnya halaman Ketidakhadiran menyusun pratinjaunya
 * sendiri dengan string manual, sehingga apa yang dilihat petugas bisa berbeda
 * dari apa yang diterima grup begitu template di site_settings diubah.
 */
export async function buildWhatsAppDetailsMessage(
    feature: 'piket' | 'ketidakhadiran',
    data: Record<string, string>,
    rows: Record<string, string>[],
    defaultTemplates?: { template?: string; rowTemplate?: string },
    mentions?: string[],
    autoAppend?: WAAutoAppend
): Promise<{ ok: boolean; message?: string; error?: string }> {
    const config = await getWAConfig(feature)

    if (!config) {
        return { ok: false, error: 'WA config not available' }
    }

    const rowTemplate = config.detailsRowTemplate || defaultTemplates?.rowTemplate || getDefaultRowTemplate(feature)

    // Format each row using the row template
    const detailsText = rows.map(row => renderTemplate(rowTemplate, row)).join('\n')

    const finalData = {
        ...data,
        details: detailsText,
    }

    // Get template
    const templateToUse = config.template || defaultTemplates?.template || getDefaultTemplate(feature)

    // Format message from template
    let finalMessage = templateToUse && templateToUse.trim()
        ? renderTemplate(templateToUse, finalData)
        : JSON.stringify(finalData)

    if (autoAppend && autoAppend.text && !templateToUse.includes(`{{${autoAppend.key}}}`)) {
        finalMessage += autoAppend.text
    }

    if (mentions && mentions.length > 0) {
        const tags = mentions.map(m => '@' + m.split('@')[0]).join(' ')
        finalMessage += `\n\nCC: ${tags}`
    }

    return { ok: true, message: finalMessage }
}

export async function sendWhatsAppWithDetails(
    feature: 'piket' | 'ketidakhadiran',
    data: Record<string, string>,
    rows: Record<string, string>[],
    defaultTemplates?: { template?: string; rowTemplate?: string },
    mentions?: string[],
    autoAppend?: WAAutoAppend
): Promise<{ ok: boolean; error?: string }> {
    const config = await getWAConfig(feature)

    if (!config) {
        return { ok: false, error: 'WA config not available' }
    }

    const validTargets = config.targets.filter(t => t.code.trim())

    if (validTargets.length === 0) {
        return { ok: false, error: 'No valid targets configured' }
    }

    const built = await buildWhatsAppDetailsMessage(feature, data, rows, defaultTemplates, mentions, autoAppend)
    if (!built.ok || !built.message) {
        return { ok: false, error: built.error || 'Gagal menyusun pesan' }
    }

    return dispatchText(config, validTargets, built.message, mentions)
}

function getDefaultRowTemplate(feature: string): string {
    switch (feature) {
        case 'piket':
            return '{{nama_kelas}} | {{nama_guru}} | {{status_kehadiran}}'
        case 'ketidakhadiran':
            return '{{no}}. {{nama}} ({{kelas}}) - {{status}}'
        default:
            return '{{no}}. {{data}}'
    }
}

function getDefaultTemplate(feature: string): string {
    switch (feature) {
        case 'ketidakhadiran':
            return `📋 LAPORAN KETIDAKHADIRAN

🗓️ {{tanggal}}
👤 Petugas: {{petugas_nama}}
📁 Jenis: {{jenis}}

─────────────────────

{{details}}

─────────────────────
📊 Total: {{total}} siswa
_Dikirim dari Sistem ACCA_`
        case 'piket':
            return `📋 LAPORAN Piket

🗓️ {{hari}}, {{tanggal}}
👤 Guru Piket: {{nama_guru_piket}}
📁 Jam ke-: {{jam_ke}}

─────────────────────

{{details}}

{{#keterangan}}
📝 Catatan: {{keterangan}}
{{/keterangan}}
─────────────────────
_Dikirim dari Sistem ACCA_`
        default:
            return '{{data}}'
    }
}
