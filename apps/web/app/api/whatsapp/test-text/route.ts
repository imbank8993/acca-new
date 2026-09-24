/**
 * API Route: Test kirim pesan TEKS ke WA via provider terpilih.
 * Mengembalikan RAW response provider agar admin bisa memverifikasi konfigurasi.
 * Dipakai tombol "Kirim Test" agar konsisten multi-provider (Fonnte/Watzap/UltraMsg)
 * dan menghindari masalah CORS bila memanggil API provider langsung dari browser.
 */
import { NextRequest, NextResponse } from 'next/server'

async function sendText(provider: string, token: string, target: string, message: string): Promise<{ ok: boolean; raw: any }> {
    try {
        if (provider === 'baileys') {
            const { baileysSendText } = await import('@/lib/baileys')
            const r = await baileysSendText(target, message)
            return { ok: r.ok, raw: r.ok ? { detail: 'terkirim via Baileys' } : { error: r.error } }
        }
        if (provider === 'watzap') {
            const res = await fetch('https://www.watzap.me/api/send', {
                method: 'POST',
                headers: { 'Authorization': token, 'Content-Type': 'application/json' },
                body: JSON.stringify({ number: target, message }),
            })
            const raw = await res.json().catch(() => null)
            return { ok: raw?.success === true, raw }
        }
        if (provider === 'ultramsg') {
            const res = await fetch(`https://api.ultramsg.com/instance/${token}/messages/chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token, to: target, body: message }),
            })
            const raw = await res.json().catch(() => null)
            return { ok: raw?.sent === true || raw?.success === true, raw }
        }
        // default: fonnte
        const res = await fetch('https://api.fonnte.com/send', {
            method: 'POST',
            headers: { 'Authorization': token, 'Content-Type': 'application/json' },
            body: JSON.stringify({ target, message }),
        })
        const raw = await res.json().catch(() => null)
        const ok = raw?.status === true ||
            (typeof raw?.detail === 'string' && /kirim|sent|pending/i.test(raw.detail))
        return { ok, raw }
    } catch (err: any) {
        return { ok: false, raw: { error: err?.message || String(err) } }
    }
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        const { label = 'WA', token, targets, provider = 'fonnte' } = body

        if ((provider !== 'baileys' && !token) || !Array.isArray(targets) || targets.length === 0) {
            return NextResponse.json({ ok: false, error: 'Token dan minimal satu target wajib diisi' }, { status: 400 })
        }

        const message = `🧪 *Test WhatsApp - ${label}*\n\nIni pesan uji coba dari Sistem ACCA melalui provider *${provider}*.\nJika Anda menerima pesan ini, konfigurasi sudah benar.`

        const results: Array<{ target: string; ok: boolean; raw: any }> = []
        for (const target of targets) {
            const r = await sendText(provider, token, String(target), message)
            results.push({ target: String(target), ...r })
        }

        const successCount = results.filter(r => r.ok).length
        return NextResponse.json({ ok: successCount > 0, successCount, total: results.length, results })
    } catch (err: any) {
        return NextResponse.json({ ok: false, error: err?.message || 'Terjadi kesalahan server' }, { status: 500 })
    }
}
