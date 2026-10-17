const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  toMinutes,
  entryTimeWindow,
  calcDailyAttendanceMinutes,
  dominantStatus,
  resolveTahunAjaranSemester,
} = require('../dist/src/wali-kelas/attendance-calc.js');

test('toMinutes handles null, undefined, and empty string', () => {
  assert.equal(toMinutes(null), null);
  assert.equal(toMinutes(undefined), null);
  assert.equal(toMinutes(''), null);
  assert.equal(toMinutes('   '), null);
});

test('toMinutes parses HH:mm and HH:mm:ss strings', () => {
  assert.equal(toMinutes('07:00'), 420);
  assert.equal(toMinutes('07:20'), 440);
  assert.equal(toMinutes('16:00'), 960);
  assert.equal(toMinutes('07:20:00'), 440);
});

test('toMinutes parses ISO strings with T', () => {
  assert.equal(toMinutes('1970-01-01T07:20:00.000Z'), 440);
  assert.equal(toMinutes('1970-01-01T11:40:00.000Z'), 700);
});

test('toMinutes parses JavaScript Date objects from Prisma @db.Time(6)', () => {
  const d1 = new Date('1970-01-01T07:20:00.000Z');
  assert.equal(toMinutes(d1), 440);

  const d2 = new Date('1970-01-01T16:00:00.000Z');
  assert.equal(toMinutes(d2), 960);
});

test('entryTimeWindow accepts Date objects without throwing', () => {
  const window = entryTimeWindow({
    waktu_mulai_real: new Date('1970-01-01T08:00:00.000Z'),
    waktu_selesai_real: new Date('1970-01-01T10:00:00.000Z'),
  });
  assert.deepEqual(window, { start: 480, end: 600 });
});

test('calcDailyAttendanceMinutes accurately accounts for Date-based ketidakhadiran without crashing', () => {
  const kh = [
    {
      jenis: 'SAKIT',
      waktu_mulai_real: new Date('1970-01-01T07:00:00.000Z'),
      waktu_selesai_real: new Date('1970-01-01T16:00:00.000Z'),
    },
  ];
  const minutes = calcDailyAttendanceMinutes(kh, [], '2026-10-12');
  assert.equal(minutes.SAKIT > 0, true);
  assert.equal(dominantStatus(minutes), 'SAKIT');
});

test('resolveTahunAjaranSemester correctly identifies academic year and semester', () => {
  const oct = resolveTahunAjaranSemester('2026-10');
  assert.equal(oct.tahunAjaran, '2026/2027');
  assert.equal(oct.semester, 1);
  assert.equal(oct.semesterStr, 'Ganjil');

  const feb = resolveTahunAjaranSemester('2027-02');
  assert.equal(feb.tahunAjaran, '2026/2027');
  assert.equal(feb.semester, 2);
  assert.equal(feb.semesterStr, 'Genap');
});
