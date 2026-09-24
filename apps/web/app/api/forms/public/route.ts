import { NextResponse } from 'next/server';
import { nestFetchAsUser } from '@/lib/nest-api';

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function OPTIONS() {
    return NextResponse.json({}, { headers: corsHeaders });
}

export async function GET() {
    try {
        const { status, body } = await nestFetchAsUser('/forms/public', '');
        return NextResponse.json(body, { status, headers: corsHeaders });
    } catch (err: any) {
        console.error('Public forms API error:', err);
        return NextResponse.json(
            { ok: false, error: err.message, forms: [] },
            { status: 500, headers: corsHeaders }
        );
    }
}
