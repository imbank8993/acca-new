import { NextRequest, NextResponse } from 'next/server';
import { extractRequestToken } from '@/lib/app-jwt';
import { nestFetchAsUser } from '@/lib/nest-api';

export const dynamic = 'force-dynamic';

async function proxy(req: NextRequest) {
    const token = extractRequestToken(req);
    const searchParams = req.nextUrl.searchParams;
    const url = '/klinik' + (searchParams.toString() ? '?' + searchParams.toString() : '');
    
    const options: any = { method: req.method };
    if (req.method !== 'GET' && req.method !== 'HEAD') {
        const text = await req.text();
        if (text) options.body = text;
    }

    const { status, body } = await nestFetchAsUser(url, token, options);
    return NextResponse.json(body || {}, { status });
}

export async function GET(request: NextRequest) { return proxy(request); }
export async function POST(request: NextRequest) { return proxy(request); }
export async function PATCH(request: NextRequest) { return proxy(request); }
export async function PUT(request: NextRequest) { return proxy(request); }
export async function DELETE(request: NextRequest) { return proxy(request); }
