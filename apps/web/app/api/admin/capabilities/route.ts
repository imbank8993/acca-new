import { NextRequest, NextResponse } from 'next/server'
import { getApiUser, unauthorizedResponse, forbiddenResponse } from '@/lib/api-auth'
import { capabilitiesByPage, isKnownCapability } from '@/lib/capabilities'
import { extractRequestToken } from '@/lib/app-jwt'
import { nestFetchAsUser } from '@/lib/nest-api'

/**
 * Pengaturan kapabilitas (Pengaturan Users → Akses Fungsi).
 *
 * Data role_capabilities / user_capabilities kini di PostgreSQL VPS lewat NestJS.
 * Gerbang admin tetap dicek di sini (dan sekali lagi di backend), karena
 * middleware hanya memeriksa ADA/tidaknya token, bukan role.
 */
async function requireAdmin(req: NextRequest) {
  const user = await getApiUser(req)
  if (!user) return { denied: unauthorizedResponse() }
  if (!user.isAdmin) return { denied: forbiddenResponse('Hanya Admin yang dapat mengatur kapabilitas') }
  return { denied: null as null }
}

/** Teruskan ke NestJS lalu terjemahkan hasilnya ke bentuk respons route ini. */
async function proxy(req: NextRequest, path: string, init?: RequestInit) {
  const { status, body } = await nestFetchAsUser(path, extractRequestToken(req), init)
  return { ok: status === 200, status, body }
}

/**
 * GET /api/admin/capabilities            → katalog + peta kapabilitas per role
 * GET /api/admin/capabilities?role=GURU  → kapabilitas satu role
 * GET /api/admin/capabilities?userId=12  → grant/revoke satu user
 */
export async function GET(req: NextRequest) {
  const { denied } = await requireAdmin(req)
  if (denied) return denied

  try {
    const role = req.nextUrl.searchParams.get('role')
    const userId = req.nextUrl.searchParams.get('userId')
    const capability = req.nextUrl.searchParams.get('capability')

    if (capability) {
      if (!isKnownCapability(capability)) {
        return NextResponse.json({ ok: false, error: 'capability tidak dikenal' }, { status: 400 })
      }
      const holders = await proxy(req, `/access/capability-holders?key=${encodeURIComponent(capability)}`)
      if (!holders.ok) {
        return NextResponse.json({ ok: false, error: holders.body?.message || 'Gagal memuat' }, { status: holders.status })
      }
      return NextResponse.json({ ok: true, capability, ...holders.body })
    }

    if (userId) {
      const overrides = await proxy(req, `/access/user-capabilities/${encodeURIComponent(userId)}`)
      if (!overrides.ok) {
        return NextResponse.json({ ok: false, error: overrides.body?.message || 'Gagal memuat' }, { status: overrides.status })
      }
      return NextResponse.json({ ok: true, userId, ...overrides.body })
    }

    const roleCaps = await proxy(req, '/access/role-capabilities')
    if (!roleCaps.ok) {
      return NextResponse.json({ ok: false, error: roleCaps.body?.message || 'Gagal memuat' }, { status: roleCaps.status })
    }
    // null = tabel belum ada; utk UI perlakukan seperti kosong.
    const map = roleCaps.body?.map ?? {}
    if (role) {
      const R = role.toUpperCase()
      return NextResponse.json({ ok: true, role: R, capabilityKeys: map[R] || [] })
    }
    // Katalog ikut dikirim supaya UI tidak perlu menduplikasi label & grup.
    return NextResponse.json({ ok: true, catalog: capabilitiesByPage(), map })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || 'Gagal memuat kapabilitas' }, { status: 500 })
  }
}

/**
 * PUT /api/admin/capabilities
 *   { role, capabilityKeys: string[] }  → ganti paket kapabilitas sebuah role
 *   { userId, entries: [{ capability_key, mode, catatan? }] } → ganti pengecualian per user
 *   { capability, userIds: number[], mode? } → ganti daftar orang untuk satu fungsi
 */
export async function PUT(req: NextRequest) {
  const { denied } = await requireAdmin(req)
  if (denied) return denied

  try {
    const body = await req.json()

    if (body?.capability) {
      if (!isKnownCapability(body.capability)) {
        return NextResponse.json({ ok: false, error: 'capability tidak dikenal' }, { status: 400 })
      }
      if (!Array.isArray(body.userIds)) {
        return NextResponse.json({ ok: false, error: 'userIds wajib berupa array' }, { status: 400 })
      }
      const mode = body.mode === 'revoke' ? 'revoke' : 'grant'
      const saved = await proxy(req, `/access/capability-holders/${encodeURIComponent(body.capability)}`, {
        method: 'PUT',
        body: JSON.stringify({ userIds: body.userIds, mode, ...(body.roles !== undefined ? { roles: body.roles, revokedUserIds: body.revokedUserIds ?? [] } : {}) }),
      })
      if (!saved.ok) {
        return NextResponse.json({ ok: false, error: saved.body?.message || 'Gagal menyimpan' }, { status: saved.status })
      }
      return NextResponse.json({ ok: true })
    }

    if (body?.userId) {
      if (!Array.isArray(body.entries)) {
        return NextResponse.json({ ok: false, error: 'entries wajib berupa array' }, { status: 400 })
      }
      // Kunci di luar registry ditolak, bukan didiamkan: baris sampah di DB
      // akan diam-diam diabaikan saat resolusi dan bikin admin salah paham.
      const entries = body.entries.filter((e: any) => isKnownCapability(e?.capability_key))
      if (entries.length !== body.entries.length) {
        return NextResponse.json({ ok: false, error: 'Ada capability_key yang tidak dikenal' }, { status: 400 })
      }
      const saved = await proxy(req, `/access/user-capabilities/${encodeURIComponent(body.userId)}`, {
        method: 'PUT',
        body: JSON.stringify({ entries }),
      })
      if (!saved.ok) {
        return NextResponse.json({ ok: false, error: saved.body?.message || 'Gagal menyimpan' }, { status: saved.status })
      }
      return NextResponse.json({ ok: true })
    }

    if (!body?.role || !Array.isArray(body?.capabilityKeys)) {
      return NextResponse.json({ ok: false, error: 'role dan capabilityKeys wajib diisi' }, { status: 400 })
    }
    const keys = body.capabilityKeys.filter(Boolean)
    if (!keys.every(isKnownCapability)) {
      return NextResponse.json({ ok: false, error: 'Ada capability_key yang tidak dikenal' }, { status: 400 })
    }
    const saved = await proxy(req, `/access/role-capabilities/${encodeURIComponent(body.role)}`, {
      method: 'PUT',
      body: JSON.stringify({ capabilityKeys: keys }),
    })
    if (!saved.ok) {
      return NextResponse.json({ ok: false, error: saved.body?.message || 'Gagal menyimpan' }, { status: saved.status })
    }
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || 'Gagal menyimpan' }, { status: 500 })
  }
}
