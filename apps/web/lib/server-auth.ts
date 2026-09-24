import { cookies } from 'next/headers';
import { verifyAppToken, decodeSessionCookie } from '@/lib/app-jwt';
import { prisma } from './prisma';

export interface ServerUser {
    userId: number;
    username: string;
    roles: string[];
}

export async function getAuthenticatedUser(request: Request): Promise<ServerUser | null> {
    try {
        const authHeader = request.headers.get('authorization');
        let token = authHeader?.replace('Bearer ', '') || '';

        if (!token) {
            const cookieStore = await cookies();
            const encodedToken = cookieStore.get('acca_session')?.value || '';
            token = decodeSessionCookie(encodedToken);
        }

        const claims = token ? await verifyAppToken(token) : null;
        if (!claims) {
            return null;
        }

        let dbUser: any = null;
        if (claims.authId) {
            dbUser = await prisma.public_users.findFirst({
                where: { auth_id: claims.authId },
                select: { id: true, username: true, role: true }
            });
        }

        if (!dbUser && claims.username) {
            dbUser = await prisma.public_users.findFirst({
                where: { username: { equals: claims.username, mode: 'insensitive' } },
                select: { id: true, username: true, role: true }
            });
        }

        if (!dbUser) {
            return null;
        }

        const roles = typeof dbUser.roles === 'string'
            ? dbUser.roles.split(',').map((r: string) => r.trim().toUpperCase()).filter(Boolean)
            : Array.isArray(dbUser.roles) ? dbUser.roles : [];

        return { userId: Number(dbUser.id), username: dbUser.username, roles };
    } catch (err: any) {
        console.error('[server-auth] Error:', err);
        return null;
    }
}
