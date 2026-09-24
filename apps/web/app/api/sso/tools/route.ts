import { NextResponse } from 'next/server';
import { SignJWT } from 'jose';
import { cookies } from 'next/headers';
import { verifyAppToken, decodeSessionCookie } from '@/lib/app-jwt';

// Shared secret with ACCA TOOLS (Flask). MUST match TOOLS_SSO_SECRET there.
const SSO_SECRET = new TextEncoder().encode(process.env.TOOLS_SSO_SECRET || '');
const TOOLS_URL = (process.env.NEXT_PUBLIC_TOOLS_URL || 'https://acca-tools.icgowa.sch.id').replace(/\/$/, '');

/**
 * Baca sesi langsung dari cookie (server-side), supaya route ini bisa jadi
 * target redirect biasa untuk gerbang ACCA TOOLS.
 */
async function getSessionUser() {
    const cookieStore = await cookies();
    const encodedToken = cookieStore.get('acca_session')?.value;
    if (!encodedToken) return null;

    const accessToken = decodeSessionCookie(encodedToken);
    const claims = await verifyAppToken(accessToken);
    if (!claims) return null;

    return {
        id: claims.authId,
        email: claims.email || '',
        user_metadata: { username: claims.username, role: claims.role },
    };
}

export async function GET(req: Request) {
    if (!process.env.TOOLS_SSO_SECRET) {
        return NextResponse.redirect(new URL('/dashboard?error=tools-sso-misconfig', req.url));
    }

    try {
        const user = await getSessionUser();
        if (!user || !user.id) {
            // Not logged in → show the elegant "login at ACCA" page on acca-tools.
            return NextResponse.redirect(`${TOOLS_URL}/auth/denied`);
        }

        const meta = (user.user_metadata || {}) as Record<string, string>;
        const payload = {
            sub: user.id,
            email: user.email || '',
            name: meta.full_name || meta.name || user.email || 'User',
        };

        const token = await new SignJWT(payload)
            .setProtectedHeader({ alg: 'HS256' })
            .setIssuedAt()
            .setExpirationTime('2m')
            .sign(SSO_SECRET);

        return NextResponse.redirect(`${TOOLS_URL}/auth/sso?token=${token}`);
    } catch (error) {
        console.error('Tools SSO error:', error);
        return NextResponse.redirect(new URL('/dashboard?error=tools-sso-failed', req.url));
    }
}
