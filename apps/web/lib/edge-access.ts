/**
 * PENEGAKAN AKSES HALAMAN DI EDGE (dipakai middleware.ts)
 *
 * Middleware berjalan di Edge runtime, jadi modul ini TIDAK boleh menyentuh
 * `lib/auth.ts` / Prisma / driver Postgres (semuanya menarik dependensi Node).
 * Resolusi aksesnya dilakukan backend NestJS di atas PostgreSQL VPS, dipanggil
 * lewat `fetch` biasa — satu-satunya cara akses data yang aman di Edge.
 *
 * Cache dua lapis:
 *   - FRESH_MS  : dianggap valid, dipakai langsung tanpa panggilan jaringan.
 *   - STALE_MS  : bila panggilan gagal (backend down), pakai hasil lama daripada
 *                 mengunci semua user di luar aplikasi.
 */

const NEST_API_URL = process.env.NEXT_PUBLIC_NEST_API_URL || 'http://localhost:3007/api'
const INTERNAL_API_KEY = process.env.INTERNAL_API_KEY || ''

const FRESH_MS = 30_000
const STALE_MS = 10 * 60_000

export interface AccessInfo {
    roles: string[]
    pages: Set<string>
    /** false bila baris users tidak ketemu — middleware memperlakukannya sebagai tanpa akses. */
    found: boolean
}

const _users = new Map<string, { at: number; info: AccessInfo }>()

/**
 * Halaman + role efektif untuk satu auth_id.
 * Mengembalikan null hanya bila panggilan gagal DAN tidak ada cache lama yang bisa dipakai.
 */
export async function getAccessForAuthId(authId: string): Promise<AccessInfo | null> {
    const cached = _users.get(authId)
    if (cached && Date.now() - cached.at < FRESH_MS) return cached.info

    try {
        const res = await fetch(
            `${NEST_API_URL}/access/internal/user/${encodeURIComponent(authId)}`,
            { headers: { 'x-internal-key': INTERNAL_API_KEY }, cache: 'no-store' }
        )

        if (res.status === 404) {
            const info: AccessInfo = { roles: [], pages: new Set(), found: false }
            _users.set(authId, { at: Date.now(), info })
            return info
        }
        if (!res.ok) throw new Error(`access/internal/user -> ${res.status}`)

        const data = await res.json()
        const info: AccessInfo = {
            roles: data?.access?.roles || [],
            pages: new Set<string>(data?.access?.pageIds || []),
            found: true,
        }
        _users.set(authId, { at: Date.now(), info })
        return info
    } catch (e) {
        // Sajikan hasil lama (masih dalam masa tenggang) daripada mengunci user
        // hanya karena satu panggilan gagal.
        if (cached && Date.now() - cached.at < STALE_MS) return cached.info
        console.error('[edge-access] gagal resolve akses:', (e as Error).message)
        return null
    }
}
