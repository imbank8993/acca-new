/**
 * GET /api/whatsapp/baileys/status
 * Mengembalikan status koneksi Baileys (WhatsApp Web) + QR untuk pairing bila belum tersambung.
 * Route ini lazy-start koneksi bila belum berjalan.
 */
import { NextResponse } from 'next/server'
import { getBaileysStatus } from '@/lib/baileys'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
    try {
        const status = await getBaileysStatus()
        return NextResponse.json({ ok: true, ...status })
    } catch (err: any) {
        return NextResponse.json({ ok: false, error: err?.message || 'Gagal membaca status Baileys' }, { status: 500 })
    }
}
