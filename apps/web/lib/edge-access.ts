/** Resolve current permissions with the user's session; stale grants never authorize navigation. */
const NEST_API_URL = process.env.NEXT_PUBLIC_NEST_API_URL || 'http://localhost:3007/api'

export interface AccessInfo {
    roles: string[]
    pages: Set<string>
    found: boolean
    mustChangePassword?: boolean
}

export async function getAccessForAuthId(authId: string, token: string): Promise<AccessInfo | null> {
    if (!authId || !token) return null
    try {
        const res = await fetch(`${NEST_API_URL}/access/me`, {
            headers: { authorization: `Bearer ${token}` }, cache: 'no-store',
            signal: AbortSignal.timeout(10000),
        })
        if (!res.ok) return null
        const data = await res.json()
        if (data?.user?.auth_id !== authId || data?.user?.aktif !== true || !Array.isArray(data?.access?.pageIds)) return null
        return { roles: data.access.roles || [], pages: new Set(data.access.pageIds), found: true, mustChangePassword: data.user.must_change_password === true }
    } catch (e) {
        console.error('[edge-access] gagal resolve akses:', (e as Error).message)
        return null
    }
}
