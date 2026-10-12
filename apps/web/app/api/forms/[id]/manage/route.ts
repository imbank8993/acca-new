import { NextRequest, NextResponse } from 'next/server';
import { extractRequestToken } from '@/lib/app-jwt';
import { nestFetchAsUser } from '@/lib/nest-api';
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const token = extractRequestToken(request);
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { id } = await params;
    const { status, body } = await nestFetchAsUser(`/forms/${encodeURIComponent(id)}/manage`, token);
    return NextResponse.json(body, { status });
}
