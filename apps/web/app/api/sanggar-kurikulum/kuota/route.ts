import { NextRequest, NextResponse } from 'next/server';
import { nestFetch } from '@/lib/nest-api';

export async function GET(req: NextRequest) {
    try {
        const { status, body } = await nestFetch('/sanggar/kuota');
        return NextResponse.json(body, {
            status,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET',
                'Cache-Control': 'no-store',
            }
        });
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

export async function OPTIONS() {
    return new NextResponse(null, {
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type',
        }
    });
}
