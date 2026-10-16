import { NextRequest, NextResponse } from 'next/server'
import { getApiUser } from '@/lib/api-auth'
import { bolehAksesFitur, PENGATURAN_DATA_ACCESS_KEYS } from '@/lib/feature-access-server'
import { BulkDataError, bulkFailure, searchBulkData } from '@/lib/bulk-data'

const headers = { 'Cache-Control': 'no-store' }

export async function GET(request: NextRequest) {
  try {
    const user = await getApiUser(request)
    if (!user) return NextResponse.json({ ok: false, error: 'Tidak terautentikasi' }, { status: 401, headers })
    if (!(await bolehAksesFitur(user, PENGATURAN_DATA_ACCESS_KEYS.ganti_massal))) throw new BulkDataError('Anda tidak berwenang memakai Ganti Data Massal.', 403)
    const value = request.nextUrl.searchParams.get('value') || ''
    return NextResponse.json(await searchBulkData(value, user.isAdmin), { headers })
  } catch (error) {
    const failure = bulkFailure(error)
    return NextResponse.json({ ok: false, error: failure.message }, { status: failure.status, headers })
  }
}
