import ExcelJS from 'exceljs';
import JSZip from 'jszip';
import { inflateRawSync } from 'node:zlib';
import { Readable } from 'node:stream';
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
    if (!file.size || file.size > 2 * 1024 * 1024 || !/\.(xlsx|csv)$/i.test(file.name)) throw new CertificateError('Gunakan Excel .xlsx atau .csv maksimal 2 MB');
    const buffer = Buffer.from(await file.arrayBuffer());
    const book = new ExcelJS.Workbook();
    if (/\.xlsx$/i.test(file.name)) {
        await checkArchive(buffer);
        await book.xlsx.load(buffer as unknown as ExcelJS.Buffer);
    } else {
        const firstLine = buffer.toString('utf8').split(/\r?\n/, 1)[0];
        await book.csv.read(Readable.from([buffer]), {
            sheetName: 'Peserta', map: (value: string) => value,
            parserOptions: { maxRows: 502, ignoreEmpty: true, delimiter: !firstLine.includes(',') && firstLine.includes(';') ? ';' : ',' },
        });
    }
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
    if (raw.length < 2 || raw.length > 501) throw new CertificateError('Excel harus berisi judul kolom dan 1–500 peserta (pecah berkas jika lebih)');
    const headers = raw[0];
    if (headers.some(value => !value || value.length > 50 || ['__proto__', 'constructor', 'prototype'].includes(value)) || new Set(headers).size !== headers.length)
        throw new CertificateError('Judul kolom harus terisi, unik, dan maksimal 50 karakter');
    return { sheet: sheet.name, headers, rows: raw.slice(1) };
}
