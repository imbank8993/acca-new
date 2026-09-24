import { NextRequest, NextResponse } from 'next/server';
import { buildUserObject } from '@/lib/auth';
import { extractRequestToken } from '@/lib/app-jwt';
import { fetchUserAccessByAuthId, nestFetchAsUser } from '@/lib/nest-api';
import { deleteFile } from '@/lib/storage';

// Semua operasi baca/tulis pengguna dilayani NestJS di atas PostgreSQL VPS,
// termasuk kredensial (auth_users) — gerbang izinnya ditegakkan backend.

// GET /api/admin/users/[id] - Get single user
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const { status, body } = await nestFetchAsUser(
            `/users/${encodeURIComponent(id)}`,
            extractRequestToken(request)
        );
        if (status !== 200) {
            return NextResponse.json(
                { ok: false, error: body?.message || 'User not found' },
                { status: status === 404 ? 404 : status }
            );
        }

        return NextResponse.json({ ok: true, data: await buildUserObject(body.data.user, body.data.access) });
    } catch (error: any) {
        console.error('Error in GET /api/admin/users/[id]:', error);
        return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }
}

// PUT /api/admin/users/[id] - Update user data
export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const body = await request.json();
        const { username, nip, nama, nama_lengkap, divisi, email, password, role } = body;

        const payload: Record<string, any> = {};
        if (username !== undefined) payload.username = username;
        if (nip !== undefined) payload.nip = nip;
        if (nama !== undefined) payload.nama = nama;
        if (nama_lengkap !== undefined) payload.nama_lengkap = nama_lengkap;
        if (divisi !== undefined) payload.divisi = divisi;
        if (email !== undefined) payload.email = email;
        if (role !== undefined) payload.role = role;
        // '****' adalah penanda "password tidak diubah" dari form.
        if (password !== undefined && password !== '' && password !== '****') payload.password = password;

        if (Object.keys(payload).length === 0) {
            return NextResponse.json({ ok: false, error: 'No fields to update' }, { status: 400 });
        }

        const updated = await nestFetchAsUser(`/users/${encodeURIComponent(id)}`, extractRequestToken(request), {
            method: 'PUT',
            body: JSON.stringify(payload),
        });

        if (updated.status !== 200) {
            return NextResponse.json(
                { ok: false, error: updated.body?.message || 'Gagal memperbarui pengguna' },
                { status: updated.status }
            );
        }

        const saved = updated.body?.data;
        const access = saved?.auth_id ? (await fetchUserAccessByAuthId(saved.auth_id))?.access : undefined;

        return NextResponse.json({
            ok: true,
            data: await buildUserObject(saved, access),
            message: 'User updated successfully',
        });
    } catch (error: any) {
        console.error('Error in PUT /api/admin/users/[id]:', error);
        return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }
}

// DELETE /api/admin/users/[id] - Delete user
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await params;
        const { status, body: result } = await nestFetchAsUser(
            `/users/${encodeURIComponent(id)}`,
            extractRequestToken(request),
            { method: 'DELETE' }
        );

        if (status === 200 && result?.fotoProfil) {
            try { await deleteFile(result.fotoProfil); } catch (err) {
                console.error('Gagal hapus foto profil dari storage:', err);
            }
        }

        return NextResponse.json(result, { status });
    } catch (error: any) {
        console.error('Error in DELETE /api/admin/users/[id]:', error);
        return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }
}
