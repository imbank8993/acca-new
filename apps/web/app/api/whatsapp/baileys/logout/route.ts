/**
 * POST /api/whatsapp/baileys/logout
 * Memutus koneksi Baileys & menghapus sesi. Perlu scan QR ulang untuk memakainya lagi.
 */
import { NextRequest, NextResponse } from 'next/server'
import { logoutBaileys } from '@/lib/baileys'
import { getApiUser } from '@/lib/api-auth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
    try {
        const user = await getApiUser(request)
        if (!user?.isAdmin) return NextResponse.json({ ok: false, error: 'Hanya Admin yang dapat memutus sesi Baileys.' }, { status: user ? 403 : 401 })
        const body = await request.json().catch(() => ({}))
        await logoutBaileys(body.accountId || 'default')
        return NextResponse.json({ ok: true })
    } catch (err: any) {
        return NextResponse.json({ ok: false, error: err?.message || 'Gagal logout Baileys' }, { status: 500 })
    }
}
