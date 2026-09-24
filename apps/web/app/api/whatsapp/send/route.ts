/**
 * POST /api/whatsapp/send
 * Server-side proxy untuk WA API — baca konfigurasi per fitur dari database.
 *
 * Body: { message, feature?, target?, token? }
 *   - message: teks WA yang akan dikirim
 *   - feature: 'piket' | 'ketidakhadiran' | 'ptsp' (opsional, auto-detect dari target/token)
 *   - target: (optional) override target
 *   - token: (optional) override token
 *
 * Keamanan: wajib sesi yang sah. Override `target`/`token` khusus Admin —
 * lihat catatan di POST.
 */
import { NextRequest, NextResponse } from 'next/server'
import { nestFetch } from '@/lib/nest-api'
import { getApiUser } from '@/lib/api-auth'

async function getSetting(key: string): Promise<string | null> {
    const { status, body } = await nestFetch(`/site-settings?key=${encodeURIComponent(key)}`)
    if (status === 200 && body?.data) {
        return body.data.value ?? null
    }
    return null
}

function normalizeTarget(target: string): string {
    const cleaned = target.replace(/[\s\-+]/g, '')
    if (cleaned.startsWith('62')) return '0' + cleaned.slice(2)
    if (cleaned.startsWith('8')) return '0' + cleaned
    return cleaned
}

/**
 * Endpoint ini mengirim WhatsApp memakai kredensial madrasah. Sebelumnya tidak
 * memeriksa apa pun: siapa saja di internet bisa POST ke sini, dan karena
 * `target` serta `token` boleh datang dari body, pesannya bisa diarahkan ke
 * nomor mana pun — memakai kuota (dan nama) madrasah, atau memakai token
 * kiriman pemanggil. Middleware tidak menolong: matcher-nya sengaja tidak
 * mencocokkan `/api`.
 *
 * Dua lapis sekarang: sesi wajib untuk semua pemanggil, dan override
 * `target`/`token` hanya dilayani untuk Admin. Pengguna biasa hanya bisa
 * memicu pengiriman ke tujuan yang sudah dikonfigurasi per fitur di database.
 */
export async function POST(request: NextRequest) {
    try {
        const user = await getApiUser(request)
        if (!user) {
            return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 })
        }

        const body = await request.json()
        const { message, feature, target: targetOverride, token: tokenOverride } = body

        if (!message) {
            return NextResponse.json({ ok: false, error: 'Message is required' }, { status: 400 })
        }

        if (!user.isAdmin && (targetOverride || tokenOverride)) {
            return NextResponse.json(
                { ok: false, error: 'Hanya Admin yang boleh menentukan target atau token pengiriman' },
                { status: 403 },
            )
        }

        // Ambil config dari DB
        let token = user.isAdmin ? tokenOverride : undefined
        let target = user.isAdmin ? targetOverride : undefined
        let provider = 'fonnte'

        if (feature) {
            const tokenKey = `wa_token_${feature}`
            const targetKey = `wa_target_${feature}`

            if (!token) token = await getSetting(tokenKey)
            if (!target) target = await getSetting(targetKey)
        }

        // Fallback ke config default jika tidak ada override
        if (!token) token = await getSetting('wa_api_token')
        if (!target) {
            target = await getSetting('wa_target_piket') ||
                    await getSetting('wa_target_ketidakhadiran') ||
                    await getSetting('wa_target_ptsp')
        }

        // Dapatkan provider dari settings
        if (feature) {
             provider = await getSetting(`wa_provider_${feature}`) || await getSetting('wa_provider') || 'fonnte'
        } else {
             provider = await getSetting('wa_provider') || 'fonnte'
        }

        if (!target) {
            return NextResponse.json({ ok: false, error: 'No target configured' }, { status: 400 })
        }

        // Fallback jika bukan baileys dan tidak ada token
        if (provider !== 'baileys' && !token) {
             return NextResponse.json({ ok: false, error: 'No API token configured' }, { status: 400 })
        }

        let isSuccess = false
        let detail = ''

        if (provider === 'watzap') {
             const res = await fetch('https://www.watzap.me/api/send', {
                 method: 'POST',
                 headers: { 'Authorization': token, 'Content-Type': 'application/json' },
                 body: JSON.stringify({ number: normalizeTarget(target), message }),
             })
             const data = await res.json()
             isSuccess = data.success === true
             detail = data.message || ''
        } else if (provider === 'ultramsg') {
             const res = await fetch(`https://api.ultramsg.com/instance/${token}/messages/chat`, {
                 method: 'POST',
                 headers: { 'Content-Type': 'application/json' },
                 body: JSON.stringify({ token, to: normalizeTarget(target), body: message }),
             })
             const data = await res.json()
             isSuccess = data.sent === true || data.success === true
             detail = data.message || ''
        } else if (provider === 'baileys') {
             // Langsung gunakan library internal Baileys
             const { baileysSendText } = await import('@/lib/baileys')
             const r = await baileysSendText(normalizeTarget(target), message)
             isSuccess = r.ok
             detail = r.ok ? 'Sent via Baileys' : (r.error || 'Baileys failed')
        } else {
             // Default fonnte
             const res = await fetch('https://api.fonnte.com/send', {
                 method: 'POST',
                 headers: { 'Authorization': token, 'Content-Type': 'application/json' },
                 body: JSON.stringify({ target: normalizeTarget(target), message }),
             })
             const data = await res.json()
             isSuccess = data.status === true ||
                 (typeof data.detail === 'string' &&
                     (data.detail.toLowerCase().includes('kirim') ||
                         data.detail.toLowerCase().includes('sent') ||
                         data.detail.toLowerCase().includes('pending')))
             detail = data.detail || ''
        }

        const response = NextResponse.json({
            ok: true,
            success: isSuccess,
            detail: detail,
            target,
            feature: feature || 'default',
            provider
        })

        response.headers.set('Access-Control-Allow-Origin', '*')
        response.headers.set('Access-Control-Allow-Methods', 'POST, OPTIONS')
        response.headers.set('Access-Control-Allow-Headers', 'Content-Type')

        return response

    } catch (err: any) {
        console.error('[WA Proxy] Error:', err)
        const response = NextResponse.json({
            ok: false,
            error: err.message || 'Proxy error'
        }, { status: 500 })
        response.headers.set('Access-Control-Allow-Origin', '*')
        return response
    }
}

export async function OPTIONS() {
    const response = new NextResponse(null, { status: 204 })
    response.headers.set('Access-Control-Allow-Origin', '*')
    response.headers.set('Access-Control-Allow-Methods', 'POST, OPTIONS')
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type')
    return response
}
