import { NextRequest, NextResponse } from 'next/server';
import { POST as upload, DELETE as remove } from '../../upload/route';
import { getApiUser } from '@/lib/api-auth';
import { getStorageType } from '@/lib/file-storage';

export const runtime = 'nodejs';

// Preserve the legacy URL while using exactly the same authentication and ownership checks.
export const POST = upload;

export async function DELETE(request: NextRequest) {
    const url = new URL(request.url);
    url.searchParams.set('file_url', url.searchParams.get('url') || '');
    url.searchParams.delete('path');
    return remove(new NextRequest(url, { method: 'DELETE', headers: request.headers }));
}

export async function GET(request: NextRequest) {
    if (!await getApiUser(request)) return NextResponse.json({ok:false,error:'Unauthorized'},{status:401});
    return NextResponse.json({ok:true,storage_type:await getStorageType()});
}
