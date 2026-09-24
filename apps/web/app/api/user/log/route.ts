import { NextRequest, NextResponse } from 'next/server';
import { logActivity } from '@/lib/logger';
import { corsResponse, handleOptions } from '@/lib/cors';
import { getAuthUserFromRequest } from '@/lib/app-jwt';

export async function POST(request: NextRequest) {
    try {
        const user = await getAuthUserFromRequest(request);

        if (!user) {
            return corsResponse(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }));
        }

        const body = await request.json();
        const { action, details } = body;

        if (!action) {
            return corsResponse(NextResponse.json({ error: 'Action is required' }, { status: 400 }));
        }

        // Parse user agent or IP if needed (NextRequest doesn't give easy IP in some envs, but we can try headers)
        const ip = request.headers.get('x-forwarded-for') || 'unknown';

        // Use the auth_id (user.id) to log. 
        // Note: logActivity expects the ID used in activity_logs.user_id. 
        // If activity_logs.user_id references auth.users, user.id is correct.
        // If it references public.users(id) [int], we need to fetch that first.
        // Based on my previous fix for heartbeat, it seems we are linking by auth_id in code, 
        // but the table definition I gave user: user_id UUID REFERENCES auth.users(id).
        // So user.id is correct.

        await logActivity(user.id, action, details, request);

        return corsResponse(NextResponse.json({ success: true }));

    } catch (error: any) {
        console.error('Log activity error:', error);
        return corsResponse(NextResponse.json({ error: 'Internal Server Error' }, { status: 500 }));
    }
}

export async function OPTIONS() {
    return handleOptions();
}
