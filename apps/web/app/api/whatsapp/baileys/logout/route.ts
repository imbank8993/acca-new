/**
 * POST /api/whatsapp/baileys/logout
 * Memutus koneksi Baileys & menghapus sesi. Perlu scan QR ulang untuk memakainya lagi.
 */
import { NextResponse } from 'next/server'
import { logoutBaileys } from '@/lib/baileys'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST() {
    try {
        await logoutBaileys()
        return NextResponse.json({ ok: true })
    } catch (err: any) {
        return NextResponse.json({ ok: false, error: err?.message || 'Gagal logout Baileys' }, { status: 500 })
    }
}
