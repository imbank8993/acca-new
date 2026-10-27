import { extractRequestToken } from './app-jwt';
import { nestFetchAsUser } from './nest-api';
import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';

export interface LogoutTarget { name: string; url: string }

function singleLogoutEnabled() {
    return process.env.SINGLE_LOGOUT_ENABLED === 'true' || (process.env.SINGLE_LOGOUT_ENABLED !== 'false' && process.env.NODE_ENV === 'production');
}

/** Endpoints clear their own host-only cookies; authentication cookies stay host-only. */
function logoutTargets(): LogoutTarget[] {
    if (!singleLogoutEnabled()) return [];
    const endpoint = (base: string, path: string) => {
        const url = new URL(base);
        if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) throw new Error('Invalid logout origin');
        return new URL(path, url.origin).toString();
    };
    const wordpress = new URL(process.env.WP_SINGLE_LOGOUT_URL || 'https://icgowa.sch.id/?acca_single_logout=1');
    if (!['https:', 'http:'].includes(wordpress.protocol) || wordpress.username || wordpress.password) throw new Error('Invalid WordPress logout URL');
    return [
        { name: 'ACCA CBT', url: endpoint(process.env.CBT_URL || process.env.NEXT_PUBLIC_CBT_URL || 'https://acca-cbt.icgowa.sch.id', '/api/auth/single-logout') },
        { name: 'ACCA Tools', url: endpoint(process.env.NEXT_PUBLIC_TOOLS_URL || 'https://acca-tools.icgowa.sch.id', '/auth/single-logout') },
        { name: 'WordPress', url: wordpress.toString() },
    ];
}

export async function logoutResponse(request: NextRequest) {
    // A browser supplies Origin on cross-origin POST/DELETE. Reject CSRF before clearing anything.
    const origin = request.headers.get('origin');
    const ownOrigins = new Set([request.nextUrl.origin]);
    for (const value of [process.env.APP_PUBLIC_URL, process.env.NEXT_PUBLIC_BASE_URL, 'https://acca.icgowa.sch.id']) {
        if (value) { try { ownOrigins.add(new URL(value).origin); } catch { /* Invalid configuration is not trusted. */ } }
    }
    if ((origin && !ownOrigins.has(origin)) || request.headers.get('sec-fetch-site') === 'cross-site') {
        return NextResponse.json({ ok: false, error: 'Permintaan logout tidak diizinkan.' }, { status: 403 });
    }
    let targets: LogoutTarget[] = [], configurationError = false;
    try { targets = logoutTargets(); }
    catch { configurationError = true; console.error('[logout] Invalid integration logout configuration'); }
    const response = NextResponse.json({ ok: true, targets, configurationError, integrationDisabled: !singleLogoutEnabled() }, { headers: { 'Cache-Control': 'no-store' } });
    // Discover destinations without clearing ACCA or waking sibling tabs. The
    // coordinator finishes remote logout before committing the local logout.
    if (request.nextUrl.searchParams.get('phase') === 'prepare') return response;
    const token = extractRequestToken(request);
    if (token) await nestFetchAsUser('/users/presence/logout', token, { method: 'POST', signal: AbortSignal.timeout(5000) });
    const clear = { path: '/', expires: new Date(0), sameSite: 'lax' as const, httpOnly: true };
    const names = new Set(['acca_session', 'acca_refresh_token', 'bypass_access', 'sb-access-token.0', 'sb-refresh-token.0']);
    for (const cookie of request.cookies.getAll()) if (cookie.name.startsWith('sb-')) names.add(cookie.name);
    for (const name of names) response.cookies.set(name, '', clear);
    // Public event marker only: no tokens or identities. Notify already-open tabs on sibling hosts.
    const browserHost = origin ? new URL(origin).hostname : request.nextUrl.hostname;
    if (singleLogoutEnabled() && (browserHost === 'acca.icgowa.sch.id' || browserHost.endsWith('.icgowa.sch.id'))) {
        response.cookies.set('acca_logout_at', randomUUID(), { domain: 'icgowa.sch.id', path: '/', sameSite: 'lax', secure: true, maxAge: 86400 });
    }
    return response;
}
