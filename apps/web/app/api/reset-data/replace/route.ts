import { NextRequest, NextResponse } from 'next/server'
import { getApiUser } from '@/lib/api-auth'
import { bolehAksesFitur, PENGATURAN_DATA_ACCESS_KEYS } from '@/lib/feature-access-server'
import { BulkDataError, bulkFailure, replaceBulkData } from '@/lib/bulk-data'

const headers = { 'Cache-Control': 'no-store' }

export async function POST(request: NextRequest) {
  try {
    const user = await getApiUser(request)
    if (!user) return NextResponse.json({ ok: false, error: 'Tidak terautentikasi' }, { status: 401, headers })
    if (!(await bolehAksesFitur(user, PENGATURAN_DATA_ACCESS_KEYS.ganti_massal))) throw new BulkDataError('Anda tidak berwenang memakai Ganti Data Massal.', 403)
    let body
    try { body = await request.json() } catch { throw new BulkDataError('Permintaan tidak valid.') }
    return NextResponse.json(await replaceBulkData(body?.rows, user.isAdmin, undefined, user), { headers })
  } catch (error) {
    const failure = bulkFailure(error)
    return NextResponse.json({ ok: false, error: failure.message }, { status: failure.status, headers })
  }
}
