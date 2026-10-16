import * as XLSX from 'xlsx';
import JSZip from 'jszip';
import { CertificateError } from './validation';

export async function readParticipantExcel(file: File) {
    if (!file.size || file.size > 2 * 1024 * 1024 || !/\.(xlsx|csv)$/i.test(file.name)) throw new CertificateError('Gunakan Excel .xlsx atau .csv maksimal 2 MB');
    const buffer = Buffer.from(await file.arrayBuffer());
    if (/\.xlsx$/i.test(file.name)) {
        if (buffer[0] !== 0x50 || buffer[1] !== 0x4b) throw new CertificateError('Berkas Excel tidak valid');
        const zip = await JSZip.loadAsync(buffer);
        const entries = Object.values(zip.files);
        const expanded = entries.reduce((sum, entry) => sum + Number((entry as any)._data?.uncompressedSize || 0), 0);
        if (entries.length > 1000 || expanded > 25 * 1024 * 1024) throw new CertificateError('Isi Excel terlalu besar');
    }
    const book = XLSX.read(buffer, { type: 'buffer', sheetRows: 502, cellFormula: false, cellHTML: false, cellNF: false, cellStyles: false, bookVBA: false });
    if (!book.SheetNames.length) throw new CertificateError('Excel tidak memiliki lembar data');
    const sheet = book.Sheets[book.SheetNames[0]];
    // sheetRows limits parser work; !fullref prevents silently truncating later rows.
    const fullRange = XLSX.utils.decode_range(sheet['!fullref'] || sheet['!ref'] || 'A1');
    if (fullRange.e.r - fullRange.s.r > 500) throw new CertificateError('Excel melebihi 500 baris peserta. Bersihkan baris kosong atau pecah berkas.');
    const range = XLSX.utils.decode_range(sheet['!ref'] || 'A1');
    if (range.e.c > 29) throw new CertificateError('Maksimal 30 kolom per lembar');
    const raw = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: '', blankrows: false, raw: false });
    if (raw.length < 2 || raw.length > 501) throw new CertificateError('Excel harus berisi judul kolom dan 1–500 peserta (pecah berkas jika lebih)');
    const headers = raw[0].map(value => String(value).trim());
    if (headers.some(value => !value || value.length > 50 || ['__proto__', 'constructor', 'prototype'].includes(value)) || new Set(headers).size !== headers.length)
        throw new CertificateError('Judul kolom harus terisi, unik, dan maksimal 50 karakter');
    const rows = raw.slice(1).map(row => headers.map((_, index) => {
        const value = String(row[index] ?? '').trim();
        if (value.length > 200) throw new CertificateError('Setiap sel maksimal 200 karakter');
        return value;
    }));
    return { sheet: book.SheetNames[0], headers, rows };
}
