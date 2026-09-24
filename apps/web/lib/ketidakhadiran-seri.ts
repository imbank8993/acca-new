// Bentuk baris entri ketidakhadiran multi-hari, dipakai bersama oleh
// /api/ketidakhadiran/bulk (tambah) dan /api/ketidakhadiran/[id] (edit) supaya
// keduanya menghasilkan bentuk data yang sama persis.
//
// Dua mode rentang multi-hari:
// - Berulang Setiap Hari : tiap tanggal memakai jam yang sama (08.00–12.00 tiap
//                          hari) -> SATU BARIS PER TANGGAL, karena tiap hari
//                          memang kejadian terpisah.
// - Kontinu Non-Stop     : satu rentang tak terputus, mis. 1 Sep 08.00 → 3 Sep
//                          21.00 -> SATU BARIS SAJA: tgl_mulai/tgl_selesai
//                          memuat rentang penuh, waktu_mulai_real/
//                          waktu_selesai_real adalah batas awal & akhirnya,
//                          is_kontinu = true.
//   Penjabaran per hari (hari pertama 08.00 s.d. akhir hari, hari tengah 24 jam,
//   hari terakhir s.d. 21.00) dilakukan saat MEMBACA lewat
//   entryTimeWindowForDate() di lib/ketidakhadiran-jp.ts.
//
// Catatan kompatibilitas: data lama (dan database yang belum menjalankan
// migrasi 20260901) menyimpan entri kontinu sebagai satu baris per tanggal
// dengan jam sebelah — [08:00, null], [null, null], [null, 21:00]. Bentuk itu
// masih dibaca benar oleh entryTimeWindow(); untuk merapikannya jadi satu baris
// jalankan merge-ketidakhadiran-kontinu.js.
import { prisma } from '@/lib/prisma';

// Kolom is_kontinu & seri_id baru ada setelah migrasi
// 20260901_add_kontinu_to_ketidakhadiran.sql dijalankan. Dicek sekali per proses
// supaya simpan/edit tetap berfungsi (tanpa penanda seri) di database lama.
let kontinuColsCache: boolean | null = null;
export async function hasKontinuColumns(): Promise<boolean> {
    if (kontinuColsCache !== null) return kontinuColsCache;
    try {
        await prisma.ketidakhadiran.findFirst({
            select: { is_kontinu: true, seri_id: true }
        });
        kontinuColsCache = true;
    } catch (error: any) {
        kontinuColsCache = false;
        console.warn(
            '[KETIDAKHADIRAN] Kolom is_kontinu/seri_id belum ada — jalankan migrasi ' +
            '20260901_add_kontinu_to_ketidakhadiran.sql. Detail: ' + (error?.message || error)
        );
    }
    return kontinuColsCache;
}

// Potongan kolom penanda untuk ditempel ke akhir string .select(). Kosong bila
// migrasinya belum jalan, supaya query tetap berhasil di database lama.
export async function kolomSeriSelect(): Promise<string> {
    return (await hasKontinuColumns()) ? ', is_kontinu, seri_id' : '';
}

// Daftar tanggal YYYY-MM-DD dari tgl_mulai s.d. tgl_selesai (inklusif).
// Dihitung di UTC dari komponen tanggal, jadi tidak terpengaruh zona waktu
// server maupun pergeseran jam.
export function buildDateList(tglMulai: string, tglSelesai: string): string[] {
    const [y1, m1, d1] = tglMulai.split('-').map(Number);
    const [y2, m2, d2] = tglSelesai.split('-').map(Number);
    const first = Date.UTC(y1, m1 - 1, d1);
    const last = Date.UTC(y2, m2 - 1, d2);
    if (isNaN(first) || isNaN(last) || last < first) return [tglMulai];

    const out: string[] = [];
    for (let t = first; t <= last; t += 86400000) {
        out.push(new Date(t).toISOString().slice(0, 10));
    }
    return out;
}

export interface SplitOptions {
    tgl_mulai: string;
    tgl_selesai: string;
    waktu_mulai_real?: string | null;
    waktu_selesai_real?: string | null;
    is_kontinu?: boolean;
    seri_id?: string | null;
    /** false bila kolom penanda belum ada di database */
    simpanPenandaSeri: boolean;
}

// True bila rentang ini butuh penanganan seri (multi-hari berjam), yaitu:
// dipecah per tanggal untuk mode berulang, atau ditulis ulang jadi satu baris
// rentang penuh untuk mode kontinu. Jalur edit memakainya untuk memutuskan
// "tulis ulang seri" alih-alih UPDATE biasa.
export function needsSplit(opts: Pick<SplitOptions, 'tgl_mulai' | 'tgl_selesai' | 'waktu_mulai_real' | 'waktu_selesai_real'>): boolean {
    return !!(opts.waktu_mulai_real && opts.waktu_selesai_real && opts.tgl_mulai !== opts.tgl_selesai);
}

// Bangun baris-baris siap insert dari satu baris dasar (tanpa tanggal/jam).
export function buildSeriRows<T extends Record<string, any>>(baseRow: T, opts: SplitOptions): T[] {
    const {
        tgl_mulai, tgl_selesai, waktu_mulai_real, waktu_selesai_real,
        is_kontinu, seri_id, simpanPenandaSeri,
    } = opts;

    const penanda = (kontinu: boolean) => simpanPenandaSeri
        ? { is_kontinu: kontinu, seri_id: seri_id ?? null }
        : {};

    if (!needsSplit(opts)) {
        return [{
            ...baseRow,
            ...penanda(false),
            tgl_mulai,
            tgl_selesai,
            waktu_mulai_real: waktu_mulai_real || null,
            waktu_selesai_real: waktu_selesai_real || null,
        }];
    }

    if (is_kontinu) {
        // Satu rentang tak terputus = SATU baris. Penjabaran per harinya
        // dilakukan saat membaca (entryTimeWindowForDate), bukan saat menyimpan.
        if (simpanPenandaSeri) {
            return [{
                ...baseRow,
                ...penanda(true),
                tgl_mulai,
                tgl_selesai,
                waktu_mulai_real: waktu_mulai_real!,
                waktu_selesai_real: waktu_selesai_real!,
            }];
        }

        // Database belum punya kolom is_kontinu: tanpa penanda, satu baris
        // rentang tidak bisa dibedakan dari mode berulang. Jatuh balik ke
        // bentuk lama (satu baris per tanggal dengan jam sebelah) yang
        // maknanya tetap terbaca benar.
        return buildDateList(tgl_mulai, tgl_selesai).map((dayStr, idx, arr) => ({
            ...baseRow,
            tgl_mulai: dayStr,
            tgl_selesai: dayStr,
            waktu_mulai_real: idx === 0 ? waktu_mulai_real! : null,
            waktu_selesai_real: idx === arr.length - 1 ? waktu_selesai_real! : null,
        }));
    }

    const dateList = buildDateList(tgl_mulai, tgl_selesai);

    return dateList.map((dayStr) => ({
        ...baseRow,
        ...penanda(false),
        tgl_mulai: dayStr,
        tgl_selesai: dayStr,
        waktu_mulai_real: waktu_mulai_real!,
        waktu_selesai_real: waktu_selesai_real!,
    }));
}
