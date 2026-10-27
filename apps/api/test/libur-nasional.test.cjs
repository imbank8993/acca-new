const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

const moduleBox = { exports: {} };
vm.runInNewContext(ts.transpileModule(fs.readFileSync('apps/api/src/libur/libur-nasional.ts', 'utf8'), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
}).outputText, { module: moduleBox, exports: moduleBox.exports, Date });
const { parseIcsLibur, klasifikasi, rentangTanggalNasional } = moduleBox.exports;

const ICS = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'BEGIN:VEVENT',
    'DTSTART;VALUE=DATE:20270101',
    'DTEND;VALUE=DATE:20270102',
    'UID:20270101_tahunbaru@google.com',
    'SUMMARY:Tahun Baru Masehi',
    'DESCRIPTION:Hari libur nasional',
    'END:VEVENT',
    'BEGIN:VEVENT',
    'DTSTART;VALUE=DATE:20270421',
    'DTEND;VALUE=DATE:20270422',
    'UID:kartini@google.com',
    'SUMMARY:Hari Kartini',
    'DESCRIPTION:Peringatan\\nUntuk menyembunyikan peringatan\\, buka Setelan > Hari libur di In',
    ' donesia',
    'END:VEVENT',
    'BEGIN:VEVENT',
    'DTSTART;VALUE=DATE:20270310',
    'DTEND;VALUE=DATE:20270313',
    'UID:cuti@google.com',
    'SUMMARY:Cuti Bersama Idul Fitri',
    'END:VEVENT',
    'BEGIN:VEVENT',
    'DTSTART;VALUE=DATE:20271225',
    'DTEND;VALUE=DATE:20271226',
    'SUMMARY:Christmas Day',
    'DESCRIPTION:Public holiday',
    'END:VEVENT',
    'END:VCALENDAR',
].join('\r\n');

test('DTEND eksklusif dikoreksi jadi tanggal selesai inklusif', () => {
    const ev = parseIcsLibur(ICS);
    const tb = ev.find(e => e.keterangan === 'Tahun Baru Masehi');
    assert.equal(tb.tanggal_mulai, '2027-01-01');
    assert.equal(tb.tanggal_selesai, '2027-01-01');
    const cuti = ev.find(e => e.kategori === 'cuti_bersama');
    assert.equal(cuti.tanggal_selesai, '2027-03-12');
    assert.deepEqual([...rentangTanggalNasional(cuti.tanggal_mulai, cuti.tanggal_selesai)], ['2027-03-10', '2027-03-11', '2027-03-12']);
});

test('kategori: nasional, cuti bersama, peringatan (meski petunjuknya menyebut "libur")', () => {
    const ev = Object.fromEntries(parseIcsLibur(ICS).map(e => [e.keterangan, e.kategori]));
    assert.equal(ev['Tahun Baru Masehi'], 'nasional');
    assert.equal(ev['Cuti Bersama Idul Fitri'], 'cuti_bersama');
    assert.equal(ev['Hari Kartini'], 'peringatan');
    assert.equal(ev['Christmas Day'], 'nasional');
});

test('line folding & escape teks iCal', () => {
    const kartini = parseIcsLibur(ICS).find(e => e.keterangan === 'Hari Kartini');
    assert.match(kartini.deskripsi, /peringatan, buka Setelan > Hari libur di Indonesia$/);
    assert.equal(kartini.uid, 'kartini@google.com');
});

test('hasil terurut per tanggal; UID kosong diberi kunci pengganti', () => {
    const ev = parseIcsLibur(ICS);
    assert.deepEqual([...ev.map(e => e.tanggal_mulai)], ['2027-01-01', '2027-03-10', '2027-04-21', '2027-12-25']);
    assert.equal(ev[3].uid, '2027-12-25|Christmas Day');
});

test('deskripsi tak dikenal → lainnya (tidak dicentang otomatis)', () => {
    assert.equal(klasifikasi('Sesuatu', ''), 'lainnya');
    assert.equal(klasifikasi('Hari Ibu', 'Observance\nTo hide observances, go to Google Calendar Settings > Holidays in Indonesia'), 'peringatan');
});
