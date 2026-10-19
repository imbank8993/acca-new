/**
 * GET /api/whatsapp/baileys/status
 * Mengembalikan status koneksi Baileys (WhatsApp Web) + QR untuk pairing bila belum tersambung.
 * Route ini lazy-start koneksi bila belum berjalan.
 */
import { NextRequest, NextResponse } from 'next/server'
import { getBaileysStatus } from '@/lib/baileys'
import { getApiUser } from '@/lib/api-auth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
    try {
        const user = await getApiUser(request)
        if (!user?.isAdmin) return NextResponse.json({ ok: false, error: 'Hanya Admin yang dapat melihat sesi Baileys.' }, { status: user ? 403 : 401 })
        const status = await getBaileysStatus(request.nextUrl.searchParams.get('accountId') || 'default')
        return NextResponse.json({ ok: true, ...status })
    } catch (err: any) {
        return NextResponse.json({ ok: false, error: err?.message || 'Gagal membaca status Baileys' }, { status: 500 })
    }
}
