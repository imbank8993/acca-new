import { NextResponse } from 'next/server';

/**
 * Tabel Bank Data dibuat lewat migrasi MANUAL (Dashboard → SQL Editor), jadi
 * deploy kode selalu bisa mendahului tabelnya. Tanpa penerjemahan ini yang
 * sampai ke layar cuma "Could not find the table 'public.bank_data_...' in the
 * schema cache" — pesan yang tidak menuntun siapa pun ke tindakan yang benar.
 */
export function tabelBelumAda(e: any): boolean {
    const pesan = String(e?.message || e || '');
    return /bank_data/.test(pesan) && /(schema cache|does not exist|relation)/i.test(pesan);
}

export function responseMigrasiBelumJalan() {
    return NextResponse.json({
        ok: false,
        error: 'Tabel Bank Data belum ada. Jalankan migrasi '
            + 'supabase/migrations/20260907_bank_data_init.sql lewat Supabase Dashboard → SQL Editor.',
        kode: 'MIGRASI_BELUM_JALAN',
    }, { status: 503 });
}
