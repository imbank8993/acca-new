// Verifikasi token JWT yang diterbitkan backend NestJS (bukan Supabase Auth).
// Dipakai di middleware.ts (Edge) dan API routes (Node) - keduanya didukung `jose`.

import { jwtVerify } from 'jose';

const secret = new TextEncoder().encode(process.env.JWT_SECRET || '');

export interface AppJwtPayload {
    sub: string;
    authId: string | null;
    email: string | null;
    username: string | null;
    role: string | null;
    pageIds?: string[];
}

export async function verifyAppToken(token: string): Promise<AppJwtPayload | null> {
    if (!token) return null;
    try {
        const { payload } = await jwtVerify(token, secret);
        if (!payload.sub) return null;
        return {
            sub: String(payload.sub),
            authId: (payload as any).authId ?? null,
            email: (payload as any).email ?? null,
            username: (payload as any).username ?? null,
            role: (payload as any).role ?? null,
            pageIds: Array.isArray((payload as any).pageIds) ? (payload as any).pageIds : undefined,
        };
    } catch (e: any) {
        console.warn('[app-jwt] verifyAppToken failed:', e?.message || e);
        return null;
    }
}

export function encodeSessionCookie(token: string): string {
    const b64 = typeof Buffer !== 'undefined'
        ? Buffer.from(token).toString('base64url')
        : btoa(token).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
    return 'base64-' + b64;
}

export function decodeSessionCookie(raw: string): string {
    if (!raw) return '';
    const cleaned = decodeURIComponent(raw).trim();
    if (!cleaned.startsWith('base64-')) return cleaned;
    try {
        const b64 = cleaned.slice(7);
        return typeof Buffer !== 'undefined'
            ? Buffer.from(b64, 'base64url').toString('utf-8')
            : atob(b64.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (b64.length % 4)) % 4));
    } catch {
        return '';
    }
}

export function extractRequestToken(
    request: { headers: Headers; cookies?: { get: (name: string) => { value: string } | undefined } }
): string {
    // PREFER COOKIES: The browser sends acca_session automatically for all API routes.
    // If the frontend uses authFetch (Supabase), it injects the OLD Supabase token into the 
    // Authorization header which causes 401s! By checking cookies first, we safely bypass this.
    if (request.cookies) {
        const raw = request.cookies.get('acca_session')?.value || '';
        const cookieToken = decodeSessionCookie(raw);
        if (cookieToken) return cookieToken;
    }

    // Fallback: parse cookie header manually if cookies helper was missing or empty
    const cookieHeader = request.headers.get('cookie') || '';
    if (cookieHeader.includes('acca_session=')) {
        const match = cookieHeader.match(/acca_session=([^;]+)/);
        if (match && match[1]) {
            const cookieToken = decodeSessionCookie(match[1]);
            if (cookieToken) return cookieToken;
        }
    }

    const authHeader = request.headers.get('authorization') || '';
    if (authHeader.toLowerCase().startsWith('bearer ')) {
        const t = authHeader.slice(7).trim();
        if (t) return t;
    }

    return '';
}

export async function getAuthUserFromRequest(
    request: { headers: Headers; cookies?: { get: (name: string) => { value: string } | undefined } }
): Promise<{ id: string; email: string | null; user_metadata: Record<string, any> } | null> {
    const token = extractRequestToken(request);

    if (!token) return null;
    const claims = await verifyAppToken(token);
    if (!claims || (!claims.authId && !claims.sub)) return null;
    return {
        id: claims.authId || claims.sub,
        email: claims.email,
        user_metadata: { username: claims.username, role: claims.role },
    };
}
