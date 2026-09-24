import { NextRequest, NextResponse } from 'next/server';
import { extractRequestToken } from '@/lib/app-jwt';
import { nestFetchAsUser } from '@/lib/nest-api';

/**
 * Impor massal pengguna.
 *
 * Semua penulisan (profil + kredensial) dilakukan NestJS di PostgreSQL VPS,
 * jadi user hasil impor langsung bisa login. Gerbang izinnya ditegakkan
 * backend lewat akses halaman `pengaturan-users`.
 */
export async function POST(request: NextRequest) {
    try {
        const token = extractRequestToken(request);
        if (!token) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });

        const { users } = await request.json();
        if (!users || !Array.isArray(users)) {
            return NextResponse.json({ ok: false, error: 'Invalid data format' }, { status: 400 });
        }

        // Baris duplikat dalam satu berkas dibuang lebih dulu (ambil yang pertama),
        // supaya satu username tidak diproses dua kali dalam impor yang sama.
        const seen = new Set<string>();
        const uniqueUsers = users.filter((u: any) => {
            const username = ((u.username || '').toString().trim()).toLowerCase();
            if (!username || seen.has(username)) return false;
            seen.add(username);
            return true;
        });

        const { status, body } = await nestFetchAsUser('/users/bulk', token, {
            method: 'POST',
            body: JSON.stringify({ users: uniqueUsers }),
        });

        if (status !== 200 && status !== 201) {
            return NextResponse.json(
                { ok: false, error: body?.message || 'Gagal memproses impor' },
                { status }
            );
        }

        const hasil = body?.hasil || { dibuat: 0, diperbarui: 0, gagal: [] };

        // `gagal` kini berisi `{ username, alasan }` — backend menolak baris yang
        // rolenya tidak ada di tabel `roles`, dan alasannya diteruskan apa adanya
        // supaya layar bisa menyebut baris mana yang ditolak, bukan hanya jumlahnya.
        const gagal: Array<{ username: string; alasan?: string }> = Array.isArray(hasil.gagal)
            ? hasil.gagal.map((g: unknown) =>
                typeof g === 'string' ? { username: g } : (g as { username: string; alasan?: string }))
            : [];

        let message = `Berhasil memproses ${uniqueUsers.length} user.`;
        if (hasil.dibuat > 0) message += ` ${hasil.dibuat} user baru dibuat.`;
        if (hasil.diperbarui > 0) message += ` ${hasil.diperbarui} user diperbarui.`;
        if (gagal.length > 0) message += ` ${gagal.length} baris ditolak.`;
        if (users.length > uniqueUsers.length) message += ` (${users.length - uniqueUsers.length} duplikat diabaikan)`;

        return NextResponse.json({
            ok: true,
            message,
            failedUsers: gagal.map((g) => ({
                username: g.username,
                error: g.alasan || 'Gagal diproses',
            })),
        });
    } catch (error: any) {
        return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }
}
