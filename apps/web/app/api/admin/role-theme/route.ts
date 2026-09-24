import { NextRequest, NextResponse } from 'next/server'
import { extractRequestToken } from '@/lib/app-jwt'
import { nestFetchAsUser } from '@/lib/nest-api'

// Peta tema per role sekarang disimpan di system_config PostgreSQL VPS lewat NestJS.
const ALWAYS_ALLOWED_THEME_ROLES = ['ADMIN', 'ADMINISTRATOR']
type ThemeMode = 'ALL' | 'LIGHT' | 'DARK'

export const dynamic = 'force-dynamic'

async function loadThemeMap(req: NextRequest): Promise<Record<string, ThemeMode>> {
  const { status, body } = await nestFetchAsUser('/access/theme-roles', extractRequestToken(req))
  if (status !== 200) throw new Error(body?.message || 'Gagal memuat preferensi tema role')
  return body?.map || {}
}

async function saveThemeMap(req: NextRequest, map: Record<string, ThemeMode>) {
  const { status, body } = await nestFetchAsUser('/access/theme-roles', extractRequestToken(req), {
    method: 'PUT',
    body: JSON.stringify({ map }),
  })
  if (status !== 200) throw new Error(body?.message || 'Gagal menyimpan preferensi tema role')
  return body?.map as Record<string, ThemeMode>
}

/** Terapkan satu mode ke sejumlah role sekaligus, di atas peta yang berlaku. */
async function bulkSet(req: NextRequest, roles: string[], mode: ThemeMode) {
  const current = await loadThemeMap(req)
  const next = { ...current }
  roles.forEach(r => {
    const role = String(r || '').trim().toUpperCase()
    if (role && !ALWAYS_ALLOWED_THEME_ROLES.includes(role)) next[role] = mode
  })
  return saveThemeMap(req, next)
}

// GET /api/admin/role-theme
// Mengembalikan peta mode tema untuk setiap role
export async function GET(req: NextRequest) {
  try {
    const themeMap = await loadThemeMap(req)
    const allowedRoles = Object.keys(themeMap).filter(r => themeMap[r] === 'ALL')
    return NextResponse.json({
      ok: true,
      themeMap,
      allowedRoles,
      alwaysAllowed: ALWAYS_ALLOWED_THEME_ROLES
    })
  } catch (e: unknown) {
    const errMsg = e instanceof Error ? e.message : 'Gagal memuat preferensi tema role'
    return NextResponse.json({ ok: false, error: errMsg }, { status: 500 })
  }
}

// PUT /api/admin/role-theme
export async function PUT(req: NextRequest) {
  try {
    const body = await req.json()

    // 1. Simpan full map
    if (body?.themeMap && typeof body.themeMap === 'object' && !Array.isArray(body.themeMap)) {
      return NextResponse.json({ ok: true, themeMap: await saveThemeMap(req, body.themeMap) })
    }

    // 2. Bulk set mode to multiple roles
    if (Array.isArray(body?.roles) && body?.mode) {
      const mode = String(body.mode).toUpperCase() as ThemeMode
      return NextResponse.json({ ok: true, themeMap: await bulkSet(req, body.roles, mode) })
    }

    // 3. Single role set mode
    if (body?.role && body?.mode) {
      const mode = String(body.mode).toUpperCase() as ThemeMode
      return NextResponse.json({ ok: true, themeMap: await bulkSet(req, [body.role], mode) })
    }

    // 4. Legacy format: { roles: string[] } — role terpilih ALL, sisanya LIGHT
    if (Array.isArray(body?.roles)) {
      const currentMap = await loadThemeMap(req)
      const nextMap: Record<string, ThemeMode> = { ...currentMap }
      const upperSelected = new Set(body.roles.map((r: unknown) => String(r || '').toUpperCase()))

      Object.keys(nextMap).forEach(r => {
        if (!ALWAYS_ALLOWED_THEME_ROLES.includes(r)) {
          nextMap[r] = upperSelected.has(r) ? 'ALL' : 'LIGHT'
        }
      })
      upperSelected.forEach(r => {
        nextMap[r as string] = 'ALL'
      })

      return NextResponse.json({ ok: true, themeMap: await saveThemeMap(req, nextMap) })
    }

    return NextResponse.json({ ok: false, error: 'Format payload tidak valid' }, { status: 400 })
  } catch (e: unknown) {
    const errMsg = e instanceof Error ? e.message : 'Gagal menyimpan preferensi tema role'
    return NextResponse.json({ ok: false, error: errMsg }, { status: 500 })
  }
}
