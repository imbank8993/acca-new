import { NextRequest, NextResponse } from 'next/server';
import { extractRequestToken } from '@/lib/app-jwt';
import { nestFetchAsUser } from '@/lib/nest-api';
import { notify } from '@/lib/notify';

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const token = extractRequestToken(request);
    const body = await request.json();
    
    const { status, body: result } = await nestFetchAsUser(`/users/${id}/status`, token, {
        method: 'PUT',
        body: JSON.stringify(body)
    });

    // Handle notification locally in frontend if success
    // Using result.data.id and result.data.nama if they exist
    if (status === 200 && result?.ok && result.data) {
        try {
            await notify({
                type: body.aktif ? 'user_activated' : 'user_deactivated',
                title: body.aktif ? 'Akun diaktifkan' : 'Akun dinonaktifkan',
                message: `${result.data.nama} telah ${body.aktif ? 'diaktifkan' : 'dinonaktifkan'}`,
                link: '/dashboard?page=PengaturanUsers',
                recipient_role: 'ADMIN',
                source_table: 'users',
                source_id: String(result.data.id)
            });
        } catch (err) {
            console.error('Failed to notify:', err);
        }
    }

    return NextResponse.json(result, { status });
}
