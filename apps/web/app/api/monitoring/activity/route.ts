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

        const { searchParams } = new URL(request.url);
        const query = searchParams.toString();
        const path = query ? `/monitoring/activity?${query}` : '/monitoring/activity';

        const { status, body } = await nestFetchAsUser(path, token, { method: 'GET' });
        
        return corsResponse(NextResponse.json(body, { status }));
    } catch (error: any) {
        console.error('Error fetching activity logs:', error);
        return corsResponse(NextResponse.json(
            { error: 'Failed to fetch logs', details: error.message },
            { status: 500 }
        ));
    }
}

export async function OPTIONS() {
    return handleOptions();
}
