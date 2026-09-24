/**
 * Klien tipis ke backend NestJS untuk resolusi akses (role, halaman,
 * capabilities, tema). Sumber datanya PostgreSQL VPS, bukan Supabase lagi.
 */


const NEST_API_URL = process.env.NEXT_PUBLIC_NEST_API_URL || 'http://127.0.0.1:3007/api';
import type { NestAccess, NestUserAccess } from '@acca/shared';
export type { NestAccess, NestUserAccess };

async function getJson(path: string, headers: Record<string, string>, fetchOptions?: RequestInit): Promise<any | null> {
    try {
        const res = await fetch(`${NEST_API_URL}${path}`, { 
            headers, 
            cache: fetchOptions?.next ? undefined : 'no-store',
            ...fetchOptions 
        });
        if (!res.ok) return null;
        return await res.json();
    } catch (e) {
        console.error(`[nest-api] ${path} gagal:`, (e as Error).message);
        return null;
    }
}

function internalHeaders(): Record<string, string> {
    return { 'x-internal-key': process.env.INTERNAL_API_KEY || '' };
}

/** Server-only: resolve user mana pun lewat shared secret antar-service (cached 60s). */
export async function fetchUserAccessByAuthId(authId: string): Promise<NestUserAccess | null> {
    if (!authId) return null;
    return getJson(`/access/internal/user/${encodeURIComponent(authId)}`, internalHeaders(), { next: { revalidate: 60 } });
}

/** Server-only: resolve user mana pun berdasarkan username (cached 60s). */
export async function fetchUserAccessByUsername(username: string): Promise<NestUserAccess | null> {
    if (!username) return null;
    return getJson(`/access/internal/username/${encodeURIComponent(username)}`, internalHeaders(), { next: { revalidate: 60 } });
}

/** Resolve user pemilik token (dipakai dari browser maupun server). */
export async function fetchMyAccess(token: string): Promise<NestUserAccess | null> {
    if (!token) return null;
    return getJson('/access/me', { Authorization: `Bearer ${token}` });
}

/**
 * Teruskan permintaan ke NestJS atas nama user (token miliknya sendiri).
 * Dipakai route admin: otorisasi ADMIN ditegakkan backend, bukan di sini.
 */
export async function nestFetchAsUser(
    path: string,
    token: string,
    init: RequestInit = {},
): Promise<{ status: number; body: any }> {
    try {
        const res = await fetch(`${NEST_API_URL}${path}`, {
            ...init,
            headers: {
                ...(init.headers as Record<string, string>),
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
            },
            cache: 'no-store',
        });

        const body = await res.json().catch(() => null);
        return { status: res.status, body };
    } catch (e: any) {
        console.error(`[nest-api] nestFetchAsUser ${path} gagal:`, e?.message || e);
        return { status: 503, body: { ok: false, error: e?.message || 'Nest API unreachable' } };
    }
}

/**
 * Teruskan permintaan ke NestJS menggunakan internal service key (tanpa user token).
 * Dipakai oleh lib/storage/file-registry.ts dan sejenisnya untuk operasi server-to-server.
 */
export async function nestFetch(
    path: string,
    init: RequestInit = {},
): Promise<{ status: number; body: any }> {
    try {
        const res = await fetch(`${NEST_API_URL}${path}`, {
            ...init,
            headers: {
                ...(init.headers as Record<string, string>),
                'Content-Type': 'application/json',
                'x-internal-key': process.env.INTERNAL_API_KEY || '',
            },
            cache: 'no-store',
        });

        const body = await res.json().catch(() => null);
        return { status: res.status, body };
    } catch (e: any) {
        console.error(`[nest-api] nestFetch ${path} gagal:`, e?.message || e);
        return { status: 503, body: { ok: false, error: e?.message || 'Nest API unreachable' } };
    }
}
