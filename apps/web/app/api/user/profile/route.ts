import { NextRequest, NextResponse } from 'next/server';
import { deleteFile } from '@/lib/storage';
import { extractRequestToken } from '@/lib/app-jwt';
import { nestFetchAsUser } from '@/lib/nest-api';

// Profil & password sendiri disimpan di PostgreSQL VPS lewat NestJS.
// Password ditulis sebagai bcrypt ke auth_users — bukan plaintext seperti dulu.
export async function PUT(request: NextRequest) {
    try {
        const token = extractRequestToken(request);
        if (!token) {
            return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
        }

        const body = await request.json();
        const { username, nama, photoUrl, password, oldPassword, removeOldFileUrl, email } = body;

        const payload: Record<string, any> = {};
        if (username !== undefined) payload.username = username;
        if (email !== undefined) payload.email = email;
        if (nama !== undefined) payload.nama = nama;
        if (photoUrl === null || photoUrl) payload.foto_profil = photoUrl;
        if (password) {
            payload.password = password;
            payload.oldPassword = oldPassword;
        }

        const { status, body: result } = await nestFetchAsUser('/users/me', token, {
            method: 'PUT',
            body: JSON.stringify(payload),
        });

        if (status !== 200) {
            return NextResponse.json(
                { ok: false, error: result?.message || 'Gagal memperbarui profil' },
                { status }
            );
        }

        // Berkas lama baru dihapus setelah perubahan tersimpan, supaya foto tidak
        // hilang percuma ketika pembaruan datanya sendiri gagal.
        if (removeOldFileUrl) {
            try {
                await deleteFile(removeOldFileUrl);
            } catch (err) {
                console.error('Failed to delete old file:', err);
            }
        }

        return NextResponse.json({ ok: true, data: result?.data, message: 'Profil berhasil diperbarui' });
    } catch (error: any) {
        return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }
}
