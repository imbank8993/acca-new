import { NextRequest, NextResponse } from 'next/server';

// Delegate to the main upload API
// This route exists for backward compatibility with existing code
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
    // Forward to main upload handler
    const uploadUrl = new URL('/api/upload', request.url);

    const formData = await request.formData();
    const cookieHeader = request.headers.get('cookie') || '';

    const response = await fetch(uploadUrl.toString(), {
        method: 'POST',
        headers: {
            'Cookie': cookieHeader
        },
        body: formData
    });

    const result = await response.json();
    return NextResponse.json(result, { status: response.status });
}