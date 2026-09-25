import { NextResponse } from 'next/server';
import { SignJWT } from 'jose';
import { cookies } from 'next/headers';
import { verifyAppToken } from '@/lib/app-jwt';
import { fetchUserAccessByAuthId, fetchUserAccessByUsername } from '@/lib/nest-api';

// Tanpa nilai cadangan: rahasia bersama yang ikut terbaca di repo bisa dipakai
// menempa token SSO ke aplikasi CBT. Bila env-nya kosong, SSO ditolak.
const SSO_SECRET = new TextEncoder().encode(process.env.CBT_SSO_SECRET || '');

export async function GET(req: Request) {
    if (!process.env.CBT_SSO_SECRET) {
        console.error('[sso/cbt] CBT_SSO_SECRET belum diset');
        return NextResponse.redirect(new URL('/dashboard?error=sso-misconfig', req.url));
    }

    try {
        const authHeader = req.headers.get('authorization');
        let tokenStr = authHeader?.replace('Bearer ', '');
        let refreshStr = req.headers.get('x-refresh-token') || '';

        // Fallback for plain-link cross-launch (e.g. opened from ACCA TOOLS):
        // read the Supabase session from cookies when no Bearer header is present.
        if (!tokenStr) {
            const cookieStore = await cookies();
            const decode = (v?: string) =>
                v ? (v.startsWith('base64-') ? Buffer.from(v.slice(7), 'base64url').toString() : v) : '';
            tokenStr = decode(cookieStore.get('acca_session')?.value);
            refreshStr = decode(cookieStore.get('acca_refresh_token')?.value);
        }

        if (!tokenStr) {
            if (req.headers.get('accept')?.includes('application/json')) {
                return NextResponse.json({ error: 'sso-no-session', details: 'No token' }, { status: 401 });
            }
            return NextResponse.redirect(new URL('/login?error=sso-no-session', req.url));
        }

        const claims = await verifyAppToken(tokenStr);
        if (!claims || !claims.authId) {
            if (req.headers.get('accept')?.includes('application/json')) {
                return NextResponse.json({ error: 'sso-no-session', details: 'No authUser' }, { status: 401 });
            }
            return NextResponse.redirect(new URL('/login?error=sso-no-session', req.url));
        }
        const authUser = { id: claims.authId, email: claims.email };

        let userAccess = await fetchUserAccessByAuthId(authUser.id);
        if (!userAccess && authUser.email) {
            const usernameFromEmail = authUser.email.split('@')[0];
            userAccess = await fetchUserAccessByUsername(usernameFromEmail);
        }

        if (!userAccess) {
            if (req.headers.get('accept')?.includes('application/json')) {
                return NextResponse.json({ 
                    error: 'sso-no-session', 
                    details: 'DB User not found via NestJS internal API' 
                }, { status: 401 });
            }
            return NextResponse.redirect(new URL('/login?error=sso-no-session', req.url));
        }

        const dbUser = userAccess.user;
        const access = userAccess.access;

        // Pengecekan Otorisasi Hak Akses CBT
        const hasCbtAccess = (access.pageIds && access.pageIds.includes('cbt-app')) ||
            access.roles.some((r: string) => r.toUpperCase() === 'ADMIN' || r.toUpperCase() === 'ADMINISTRATOR');

        if (!hasCbtAccess) {
            if (req.headers.get('accept')?.includes('application/json')) {
                return NextResponse.json({ error: 'sso-forbidden', details: 'Akses ke Aplikasi CBT tidak diizinkan untuk peran Anda.' }, { status: 403 });
            }
            return NextResponse.redirect(new URL('/dashboard?error=sso-forbidden', req.url));
        }

        // Role mapping
        let cbtRole = 'Siswa';
        const roles = access.roles || [];
        if (roles.some((r: string) => r.toUpperCase() === 'ADMIN' || r.toUpperCase() === 'ADMINISTRATOR')) cbtRole = 'Admin';
        else if (roles.includes('PROKTOR')) cbtRole = 'Proktor';
        else if (roles.includes('GURU')) cbtRole = 'Guru';
        else if (roles.some((r: string) => r.startsWith('OP_'))) cbtRole = 'Pengawas';

        const payload = {
            sub: authUser.id,
            email: dbUser.email || authUser.email || `${dbUser.username}@acca.icgowa.sch.id`,
            name: dbUser.nama_lengkap || dbUser.nama || dbUser.username,
            role: cbtRole,
            accessToken: tokenStr,
            refreshToken: refreshStr
        };

        const token = await new SignJWT(payload)
            .setProtectedHeader({ alg: 'HS256' })
            .setIssuedAt()
            .setExpirationTime('5m')
            .sign(SSO_SECRET);

        let cbtUrl = process.env.NEXT_PUBLIC_CBT_URL || 'https://accav2-cbt.icgowa.sch.id';
        const hostHeader = req.headers.get('host') || '';
        
        // Jika diakses dari domain publik (bukan localhost)
        if (!hostHeader.includes('localhost')) {
            cbtUrl = process.env.NEXT_PUBLIC_CBT_URL && !process.env.NEXT_PUBLIC_CBT_URL.includes('localhost')
                ? process.env.NEXT_PUBLIC_CBT_URL
                : 'https://accav2-cbt.icgowa.sch.id';
        } else {
            cbtUrl = process.env.NEXT_PUBLIC_CBT_URL || 'http://localhost:3008';
        }

        const redirectUrl = `${cbtUrl}/api/auth/sso?token=${token}`;

        if (req.headers.get('accept')?.includes('application/json')) {
            return NextResponse.json({ url: redirectUrl });
        }

        return NextResponse.redirect(redirectUrl);
    } catch (error) {
        console.error('SSO Error in Accaku:', error);
        
        if (req.headers.get('accept')?.includes('application/json')) {
            return NextResponse.json({ error: 'sso-failed' }, { status: 500 });
        }
        
        return NextResponse.redirect(new URL('/dashboard?error=sso-failed', req.url));
    }
}
