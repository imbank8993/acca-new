import { NextRequest, NextResponse } from 'next/server'

// Simple test endpoint
export async function GET(request: NextRequest) {
    return NextResponse.json({
        test: true,
        message: 'Test endpoint works',
        timestamp: new Date().toISOString()
    }, { status: 200 });
}