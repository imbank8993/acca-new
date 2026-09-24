import { NextRequest, NextResponse } from 'next/server';
import { nestFetchAsUser } from '@/lib/nest-api';
import { extractRequestToken } from '@/lib/app-jwt';
import { corsResponse, handleOptions } from '@/lib/cors';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
    try {
        const token = extractRequestToken(request);
        if (!token) {
            return corsResponse(NextResponse.json({ error: 'Unauthorized' }, { status: 401 }));
        }

        const { status, body } = await nestFetchAsUser('/monitoring/users', token, { method: 'GET' });
        
        return corsResponse(NextResponse.json(body, { status }));
    } catch (error: any) {
        console.error('Error fetching users:', error);
        return corsResponse(NextResponse.json(
            { success: false, error: 'Failed to fetch users', details: error?.message || 'Unknown error' },
            { status: 500 }
        ));
    }
}

export async function OPTIONS() {
    return handleOptions();
}
