import ExcelJS from 'exceljs';
import JSZip from 'jszip';
import { inflateRawSync } from 'node:zlib';
import * as XLSX from 'sheetjs';
import { SaxesParser } from 'saxes';
import { CertificateError } from './validation';

function checkWorkbook(bytes: Buffer) {
    const parser = new SaxesParser();
    let sheets = 0;
    parser.on('doctype', () => { throw new CertificateError('Deklarasi XML Excel tidak diizinkan'); });
    parser.on('opentag', node => {
        if (node.name.split(':').pop() !== 'sheet') return;
        const id = (node.attributes as Record<string, string>).sheetId;
        // ExcelJS stores worksheets in an array indexed by sheetId. A tiny file
        // must not be able to create an array spanning billions of positions.
        if (++sheets > 1000 || !/^[1-9]\d{0,3}$/.test(id || '') || Number(id) > 1000)
            throw new CertificateError('Jumlah atau ID lembar Excel terlalu besar');
    });
    parser.write(bytes.toString('utf8')).close();
}

function checkWorksheet(bytes: Buffer) {
    const parser = new SaxesParser();
    let rows = 0, cells = 0;
    const coordinate = (value: string) => {
        const match = /^([A-Z]{1,3})([1-9]\d{0,6})$/.exec(value);
        if (!match) throw new CertificateError('Koordinat sel Excel tidak valid');
        let column = 0;
        for (const letter of match[1]) column = column * 26 + letter.charCodeAt(0) - 64;
        if (column > 30) throw new CertificateError('Maksimal 30 kolom per lembar');
        if (Number(match[2]) > 501) throw new CertificateError('Excel melebihi 500 baris peserta');
    };
    parser.on('doctype', () => { throw new CertificateError('Deklarasi XML Excel tidak diizinkan'); });
    parser.on('opentag', node => {
        const name = node.name.split(':').pop(), attrs = node.attributes as Record<string, string>;
        if (name === 'row') {
            cells = 0;
            if (++rows > 501 || !/^[1-9]\d{0,2}$/.test(attrs.r || '') || Number(attrs.r) > 501)
                throw new CertificateError('Excel melebihi 500 baris peserta');
        }
        if (name === 'c') {
            if (++cells > 30) throw new CertificateError('Maksimal 30 kolom per lembar');
            if (attrs.r) coordinate(attrs.r);
        }
        if (['dimension', 'mergeCell', 'hyperlink'].includes(name || '') && attrs.ref) attrs.ref.split(':').forEach(coordinate);
        if (name === 'col' && (!/^[1-9]\d{0,4}$/.test(attrs.max || '') || Number(attrs.max) > 30))
            throw new CertificateError('Maksimal 30 kolom per lembar');
    });
    // Bound sparse coordinates and merge ranges before ExcelJS can allocate them.
    parser.write(bytes.toString('utf8')).close();
}

// Validate actual expanded bytes before the workbook parser, including archives
// with forged size metadata. Fail closed if JSZip's compressed entry shape changes.
async function checkArchive(buffer: Buffer) {
    if (buffer[0] !== 0x50 || buffer[1] !== 0x4b) throw new CertificateError('Berkas Excel tidak valid');
    const zip = await JSZip.loadAsync(buffer);
    const entries = Object.values(zip.files), max = 25 * 1024 * 1024;
    if (entries.length > 1000) throw new CertificateError('Isi Excel terlalu besar');
    let expanded = 0;
    for (const entry of entries) {
        if (entry.dir) continue;
        const data = (entry as any)._data;
        if (!data || !Number.isSafeInteger(data.uncompressedSize) || data.uncompressedSize < 0 || data.uncompressedSize > max - expanded)
            throw new CertificateError('Isi Excel terlalu besar');
        const compressed = Buffer.from(data.compressedContent);
        let bytes: Buffer;
        try {
            if (data.compression.magic === '\x08\x00') bytes = inflateRawSync(compressed, { maxOutputLength: Math.max(1, max - expanded) });
            else if (data.compression.magic === '\x00\x00') bytes = compressed;
            else throw new Error('Unsupported ZIP compression');
        } catch { throw new CertificateError('Isi Excel terlalu besar atau arsip tidak valid'); }
        if (bytes.length !== data.uncompressedSize || bytes.length > max - expanded) throw new CertificateError('Ukuran arsip Excel tidak valid');
        expanded += bytes.length;
        // Match every worksheet path accepted by ExcelJS, including paths with
        // a leading slash or prefix, so aliases cannot bypass the preflight.
        if (/xl\/worksheets\/sheet\d+\.xml/.test(entry.name)) checkWorksheet(bytes);
        if (entry.name.replace(/^\//, '') === 'xl/workbook.xml') checkWorkbook(bytes);
    }
}

export async function readParticipantExcel(file: File) {
    if (!file.size || file.size > 2 * 1024 * 1024 || !/\.(xlsx|xls)$/i.test(file.name)) throw new CertificateError('Gunakan Excel .xls atau .xlsx maksimal 2 MB');
    const buffer = Buffer.from(await file.arrayBuffer());
    if (/\.xls$/i.test(file.name)) {
        if (!buffer.subarray(0, 8).equals(Buffer.from('d0cf11e0a1b11ae1', 'hex'))) throw new CertificateError('Berkas Excel .xls tidak valid');
        const workbook = XLSX.read(buffer, { type: 'buffer', dense: true, sheetRows: 502, sheets: 0, cellFormula: true, cellHTML: false, bookVBA: false });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        if (!sheet?.['!ref']) throw new CertificateError('Excel tidak memiliki lembar data');
        const range = XLSX.utils.decode_range(sheet['!fullref'] || sheet['!ref']);
        if (range.e.r > 500) throw new CertificateError('Excel melebihi 500 baris peserta');
        if (range.e.c > 29) throw new CertificateError('Maksimal 30 kolom per lembar');
        // Inspect cells before converting to text so cached formula results
        // cannot bypass the same rules applied to XLSX workbooks.
        for (const row of (sheet['!data'] || sheet) as unknown as XLSX.CellObject[][]) for (const cell of row || [])
            if (cell?.f) throw new CertificateError('Gunakan nilai teks, bukan formula, pada data peserta');
        const rows = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1, raw: false, defval: '', blankrows: false });
        return participantTable(rows.map(row => row.map(value => String(value).trim())), workbook.SheetNames[0]);
    }
    const book = new ExcelJS.Workbook();
    await checkArchive(buffer);
    await book.xlsx.load(buffer as unknown as ExcelJS.Buffer);
    const sheet = book.worksheets[0];
    if (!sheet) throw new CertificateError('Excel tidak memiliki lembar data');
    if (sheet.rowCount > 501) throw new CertificateError('Excel melebihi 500 baris peserta. Bersihkan baris kosong atau pecah berkas.');
    if (sheet.columnCount > 30) throw new CertificateError('Maksimal 30 kolom per lembar');
    const raw: string[][] = [];
    sheet.eachRow(row => {
        const values = Array.from({ length: sheet.columnCount }, (_, index) => {
            const cell = row.getCell(index + 1);
            if (cell.type === ExcelJS.ValueType.Formula) throw new CertificateError('Gunakan nilai teks, bukan formula, pada data peserta');
            const value = cell.text.trim();
            if (value.length > 200) throw new CertificateError('Setiap sel maksimal 200 karakter');
            return value;
        });
        if (values.some(Boolean)) raw.push(values);
    });
    return participantTable(raw, sheet.name);
}

function participantTable(raw: string[][], sheet: string) {
    if (raw.length < 2 || raw.length > 501) throw new CertificateError('Excel harus berisi judul kolom dan 1–500 peserta (pecah berkas jika lebih)');
    if (raw.some(row => row.some(value => value.length > 200))) throw new CertificateError('Setiap sel maksimal 200 karakter');
    const headers = raw[0];
    if (headers.some(value => !value || value.length > 50 || ['__proto__', 'constructor', 'prototype'].includes(value)) || new Set(headers).size !== headers.length)
        throw new CertificateError('Judul kolom harus terisi, unik, dan maksimal 50 karakter');
    return { sheet, headers, rows: raw.slice(1) };
}

export function mapParticipantColumns(table: { headers: string[]; rows: string[][] }, mapping: unknown, ids: unknown) {
    const value = mapping as { name?: number; institution?: number | null; extras?: number[] } | null;
    const validColumn = (index: unknown): index is number => Number.isInteger(index) && Number(index) >= 0 && Number(index) < table.headers.length;
    if (!value || !validColumn(value.name) || (value.institution != null && !validColumn(value.institution)) || !Array.isArray(value.extras) || value.extras.length > 8 || !value.extras.every(validColumn))
        throw new CertificateError('Pemetaan kolom Excel tidak valid');
    const columns = [value.name, ...(value.institution == null ? [] : [value.institution]), ...value.extras];
    if (new Set(columns).size !== columns.length) throw new CertificateError('Pilih kolom yang berbeda untuk setiap isian');
    if (!Array.isArray(ids) || ids.length !== table.rows.length) throw new CertificateError('Jumlah peserta impor tidak sesuai');
    return table.rows.map((row, index) => ({ id: ids[index], name: row[value.name!] || '', institution: value.institution == null ? '' : row[value.institution] || '',
        identities: Object.fromEntries(value.extras!.map(column => [table.headers[column], row[column] || ''])) }));
}
