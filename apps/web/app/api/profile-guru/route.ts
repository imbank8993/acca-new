import { NextRequest, NextResponse } from 'next/server';
import { nestFetchAsUser } from '@/lib/nest-api';
import { extractRequestToken } from '@/lib/app-jwt';

export async function GET(request: NextRequest) {
    try {
        const token = extractRequestToken(request);
        const { status, body } = await nestFetchAsUser('/users/profile-guru', token);
        return NextResponse.json(body, { status });
    } catch (error: any) {
        return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }
}

export async function PUT(request: NextRequest) {
    try {
        const token = extractRequestToken(request);
        const bodyData = await request.json();
        // Diarahkan ke '/users/profile-guru', BUKAN '/users/me'.
        //
        // '/users/me' hanya mengenal kolom tabel `public_users`; seluruh kolom
        // master (alamat, no_hp, golongan, rekening, dst.) dibuang tanpa sisa
        // di sana, tidak ada operasi tulis yang terjadi, dan responsnya tetap
        // `ok: true` sehingga UI melaporkan "Berhasil" untuk perubahan yang tidak
        // pernah tersimpan.
        const { status, body } = await nestFetchAsUser('/users/profile-guru', token, {
            method: 'PUT',
            body: JSON.stringify(bodyData),
        });
        return NextResponse.json(body, { status });
    } catch (error: any) {
        return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    }
}

export async function OPTIONS() {
    return new NextResponse(null, { status: 200 });
}
