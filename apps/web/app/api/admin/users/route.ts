import { NextRequest, NextResponse } from 'next/server';
import { buildUserObject } from '@/lib/auth';
import { notify } from '@/lib/notify';
import { getAuthUserFromRequest, extractRequestToken } from '@/lib/app-jwt';
import { nestFetchAsUser } from '@/lib/nest-api';

// Pengelolaan pengguna (daftar & pembuatan) kini sepenuhnya di PostgreSQL VPS
// lewat NestJS — termasuk kredensialnya, supaya user baru langsung bisa login.
// Gerbang izinnya ditegakkan backend (akses halaman `pengaturan-users`).

// GET /api/admin/users - List all users with filtering
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const query = new URLSearchParams();
        for (const key of ['aktif', 'role', 'search']) {
            const value = searchParams.get(key);
            if (value !== null) query.set(key, value);
        }

        const { status, body } = await nestFetchAsUser(
            `/users${query.toString() ? `?${query}` : ''}`,
            extractRequestToken(request)
        );
        if (status !== 200) {
            return NextResponse.json(
                { ok: false, error: body?.message || 'Gagal memuat pengguna' },
                { status }
            );
        }

        const users = await Promise.all(
            (body.data || []).map((row: any) => buildUserObject(row.user, row.access))
        );
        return NextResponse.json({ ok: true, data: users, count: users.length });
    } catch (error: any) {
        console.error('Error in GET /api/admin/users:', error);
        return NextResponse.json({ ok: false, error: 'Internal server error', details: error.message }, { status: 500 });
    }
}

// POST /api/admin/users - Create new user record
export async function POST(request: NextRequest) {
    try {
        const authUser = await getAuthUserFromRequest(request);
        if (!authUser) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });

        const body = await request.json();
        const { username, nip, nama, nama_lengkap, divisi, email, role, password } = body;

        const created = await nestFetchAsUser('/users', extractRequestToken(request), {
            method: 'POST',
            body: JSON.stringify({ username, nip, nama, nama_lengkap, divisi, email, role, password }),
        });

        if (created.status !== 200 && created.status !== 201) {
            return NextResponse.json(
                { ok: false, error: created.body?.message || 'Gagal membuat pengguna' },
                { status: created.status }
            );
        }

        const data = created.body?.data;

        await notify({
            type: 'user_baru',
            title: 'Akun baru terdaftar',
            message: `Pengguna baru: ${nama} (${role || 'GURU'})`,
            link: '/dashboard?page=PengaturanUsers',
            recipient_role: 'ADMIN',
            source_table: 'users',
            source_id: data?.id ? String(data.id) : undefined,
            created_by: authUser.id,
        });

        return NextResponse.json({ ok: true, data });
    } catch (error: any) {
        console.error('Error in POST /api/admin/users:', error);
        return NextResponse.json({ ok: false, error: 'Internal server error', details: error.message }, { status: 500 });
    }
}
