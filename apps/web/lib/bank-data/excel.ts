import * as XLSX from 'xlsx-js-style';
import type { KolomDef } from './datasets';

/**
 * Perakit file Excel untuk Bank Data.
 *
 * Dijalankan di server (route runtime nodejs), bukan di browser seperti ekspor
 * per-halaman yang lain — datanya bisa puluhan ribu baris dan kolomnya sudah
 * disaring server, jadi tidak ada gunanya mengirim baris mentah ke klien untuk
 * dirakit ulang di sana.
 */

/** Nilai sel: boolean jadi Ya/Tidak, null jadi kosong, sisanya apa adanya. */
function nilaiSel(v: any, tipe: KolomDef['tipe']) {
    if (v === null || v === undefined) return '';
    if (tipe === 'boolean') return v ? 'Ya' : 'Tidak';
    if (tipe === 'angka') return typeof v === 'number' ? v : Number(v) || 0;
    return String(v);
}

const GAYA_HEADER = {
    font: { bold: true, color: { rgb: 'FFFFFF' } },
    fill: { fgColor: { rgb: '1E40AF' } },
    alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
    border: {
        top: { style: 'thin', color: { rgb: 'CBD5E1' } },
        bottom: { style: 'thin', color: { rgb: 'CBD5E1' } },
        left: { style: 'thin', color: { rgb: 'CBD5E1' } },
        right: { style: 'thin', color: { rgb: 'CBD5E1' } },
    },
} as const;

export function rakitExcel(
    kolom: KolomDef[],
    baris: Record<string, any>[],
    namaSheet: string,
): Buffer {
    const aoa: any[][] = [
        kolom.map(k => ({ v: k.label, t: 's', s: GAYA_HEADER })),
        ...baris.map(r => kolom.map(k => {
            const v = nilaiSel(r[k.key], k.tipe);
            return { v, t: typeof v === 'number' ? 'n' : 's' };
        })),
    ];

    const ws = XLSX.utils.aoa_to_sheet(aoa);

    // Lebar kolom mengikuti isi terpanjang (dibatasi 40) supaya file langsung
    // terbaca tanpa harus melebarkan kolom satu per satu.
    ws['!cols'] = kolom.map((k, i) => {
        let lebar = k.label.length;
        for (const r of baris) {
            const p = String(r[k.key] ?? '').length;
            if (p > lebar) lebar = p;
        }
        return { wch: Math.min(Math.max(lebar + 2, 10), 40) };
    });
    ws['!freeze'] = { xSplit: 0, ySplit: 1 };

    const wb = XLSX.utils.book_new();
    // Nama sheet Excel: maks 31 karakter, tanpa : \ / ? * [ ]
    XLSX.utils.book_append_sheet(wb, ws, namaSheet.replace(/[:\\/?*[\]]/g, '-').slice(0, 31));

    return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
}

/** Nama file unduhan yang aman untuk header Content-Disposition. */
export function namaFile(label: string): string {
    const tanggal = new Date().toISOString().slice(0, 10);
    const bersih = label.replace(/[^a-zA-Z0-9 _-]/g, '').trim().replace(/\s+/g, '-');
    return `${bersih || 'bank-data'}-${tanggal}.xlsx`;
}
