// Regresi: adapter DB mengembalikan BIGINT sebagai STRING. Kode lama mencampur
// Number(...) dengan id string dari DB di update_slot dan register, sehingga
// perbandingan tidak pernah cocok. DB palsu di sini meniru perilaku adapter:
// id string, parameter dibandingkan setelah String() (seperti cast ::bigint),
// dan unique (slot_id, siswa_id) pada klinik_peserta.
const test = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), vm = require('node:vm'), ts = require('typescript');
const SUMBER = process.env.KLINIK_SRC || 'apps/api/src/klinik/klinik.service.ts';
const mod = { exports: {} };
vm.runInNewContext(ts.transpileModule(fs.readFileSync(SUMBER, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, experimentalDecorators: true } }).outputText, {
    module: mod, exports: mod.exports, URLSearchParams, Date, console, Intl,
    require(name) { if (name === '@nestjs/common') return require(name); if (name === '../access/access.service') return { can: u => !!u.manage }; return {}; },
});

function buatDb(tabel) {
    const log = { insert: [], delete: [] };
    let urut = 100;
    const db = {
        from(nama) {
            const rows = tabel[nama] || (tabel[nama] = []);
            const filters = []; let mode = 'select', nilai, head = false;
            const cocok = () => rows.filter(r => filters.every(f => f(r)));
            const hasil = single => {
                if (mode === 'insert') {
                    const baru = (Array.isArray(nilai) ? nilai : [nilai]).map(r => ({ id: String(urut++), ...r }));
                    if (nama === 'klinik_peserta') {
                        for (const b of baru) {
                            if (rows.some(r => r.slot_id === b.slot_id && String(r.siswa_id) === String(b.siswa_id))) {
                                return { data: null, error: { message: 'duplicate key value violates unique constraint' } };
                            }
                        }
                    }
                    rows.push(...baru); log.insert.push([nama, baru.map(b => String(b.siswa_id ?? b.id))]);
                    return { data: single ? baru[0] : baru, error: null };
                }
                const c = cocok();
                if (mode === 'delete') { log.delete.push([nama, c.map(r => String(r.siswa_id ?? r.id))]); c.forEach(r => rows.splice(rows.indexOf(r), 1)); return { error: null }; }
                if (mode === 'update') { c.forEach(r => Object.assign(r, nilai)); return { data: single ? c[0] : c, error: null }; }
                return { data: head ? null : (single ? (c[0] ?? null) : c), error: null, count: c.length };
            };
            const q = new Proxy({}, {
                get(_, k) {
                    if (k === 'then') return (res, rej) => Promise.resolve(hasil(false)).then(res, rej);
                    if (k === 'single' || k === 'maybeSingle') return () => Promise.resolve(hasil(true));
                    if (k === 'select') return (_c, o) => { if (o?.head) head = true; return q; };
                    if (k === 'eq') return (col, v) => { filters.push(r => String(r[col]) === String(v)); return q; };
                    if (k === 'in') return (col, vs) => { filters.push(r => vs.map(String).includes(String(r[col]))); return q; };
                    if (k === 'insert') return v => { mode = 'insert'; nilai = v; return q; };
                    if (k === 'update') return v => { mode = 'update'; nilai = v; return q; };
                    if (k === 'delete') return () => { mode = 'delete'; return q; };
                    return () => q; // order/limit/range/neq/... diabaikan
                },
            });
            return q;
        },
    };
    return { db, log, tabel };
}

const BESOK = new Date(Date.now() + 3 * 864e5).toISOString().slice(0, 10);
const jadwal = { mapel: 'Matematika', topik: 'Limit', tanggal: BESOK, jam_mulai: '08:00', jam_selesai: '09:00' };
const user = id => ({ id: String(id), nama: 'Siswa ' + id, nip: '00' + id, username: '00' + id, auth_id: 'auth' + id });
const rombel = ids => ids.map(id => ({ nisn: '00' + id, kelas: 'XI A', aktif: true }));

test('update_slot (sesi guru): simpan tanpa perubahan tidak menghapus/menambah apa pun', async () => {
    const { db, log, tabel } = buatDb({
        users: [user(9), user(1), user(2), user(3)],
        siswa_kelas: rombel([1, 2, 3]),
        klinik_slots: [{ id: 's1', status: 'open', guru_id: '9', initiator_type: 'GURU', max_siswa: 5 }],
        klinik_peserta: [
            { id: 'p1', slot_id: 's1', siswa_id: '1', nama_siswa: 'A', status: 'ditugaskan', kehadiran: 'H' },
            { id: 'p2', slot_id: 's1', siswa_id: '2', nama_siswa: 'B', status: 'ditugaskan', kehadiran: null },
            { id: 'p3', slot_id: 's1', siswa_id: '3', nama_siswa: 'C', status: 'registered', kehadiran: null },
        ],
    });
    const r = await mod.exports.handlePost({ user: { authId: 'auth9', nip: '009', roles: ['GURU'], manage: true } }, 'update_slot',
        { slot_id: 's1', payload: { ...jadwal, max_siswa: 5, anggota: [1, 2] } }, db);
    assert.equal(r.ok, true);
    assert.deepEqual(log.delete.filter(d => d[0] === 'klinik_peserta'), []);
    assert.deepEqual(log.insert.filter(d => d[0] === 'klinik_peserta'), []);
    assert.equal(tabel.klinik_peserta.find(p => p.siswa_id === '1').kehadiran, 'H');
});

test('update_slot (sesi guru): menunjuk pendaftar mandiri tidak menggandakan baris; hanya yang dicabut dibuang', async () => {
    const { db, log, tabel } = buatDb({
        users: [user(9), user(1), user(2), user(3)],
        siswa_kelas: rombel([1, 2, 3]),
        klinik_slots: [{ id: 's1', status: 'open', guru_id: '9', initiator_type: 'GURU', max_siswa: 5 }],
        klinik_peserta: [
            { id: 'p1', slot_id: 's1', siswa_id: '1', nama_siswa: 'A', status: 'ditugaskan', kehadiran: null },
            { id: 'p2', slot_id: 's1', siswa_id: '2', nama_siswa: 'B', status: 'ditugaskan', kehadiran: null },
            { id: 'p3', slot_id: 's1', siswa_id: '3', nama_siswa: 'C', status: 'registered', kehadiran: null },
        ],
    });
    const r = await mod.exports.handlePost({ user: { authId: 'auth9', nip: '009', roles: ['GURU'], manage: true } }, 'update_slot',
        { slot_id: 's1', payload: { ...jadwal, max_siswa: 5, anggota: ['1', '3'] } }, db);
    assert.equal(r.ok, true);
    assert.deepEqual(log.delete.filter(d => d[0] === 'klinik_peserta'), [['klinik_peserta', ['2']]]);
    assert.deepEqual(log.insert.filter(d => d[0] === 'klinik_peserta'), []);
    assert.deepEqual(tabel.klinik_peserta.map(p => p.siswa_id).sort(), ['1', '3']);
});

test('update_slot (kelompok siswa): pengaju tetap ikut, anggota baru ditambah, yang lama tidak diulang', async () => {
    const { db, log, tabel } = buatDb({
        users: [user(5), user(6), user(7)],
        siswa_kelas: rombel([5, 6, 7]),
        klinik_slots: [{ id: 's2', status: 'pending', guru_id: '9', initiator_type: 'SISWA', initiator_siswa_id: '5', max_siswa: 10 }],
        klinik_peserta: [
            { id: 'q5', slot_id: 's2', siswa_id: '5', nama_siswa: 'P', status: 'registered', kehadiran: null },
            { id: 'q6', slot_id: 's2', siswa_id: '6', nama_siswa: 'Q', status: 'registered', kehadiran: null },
        ],
    });
    const r = await mod.exports.handlePost({ user: { authId: 'auth5', nip: '005', roles: ['SISWA'], manage: false } }, 'update_slot',
        { slot_id: 's2', payload: { ...jadwal, anggota: [5, 6, 7] } }, db);
    assert.equal(r.ok, true);
    assert.deepEqual(log.delete.filter(d => d[0] === 'klinik_peserta'), []);
    assert.deepEqual(log.insert.filter(d => d[0] === 'klinik_peserta'), [['klinik_peserta', ['7']]]);
    assert.deepEqual(tabel.klinik_peserta.map(p => p.siswa_id).sort(), ['5', '6', '7']);
});

test('register: siswa yang mengirim id-nya sendiri dianggap mendaftar diri sendiri', async () => {
    const { db, tabel } = buatDb({
        users: [user(1)],
        siswa_kelas: rombel([1]),
        klinik_slots: [{ id: 's3', status: 'open', guru_id: '9', initiator_type: 'GURU', max_siswa: 5, target_kelas: null }],
        klinik_peserta: [],
    });
    const r = await mod.exports.handlePost({ user: { authId: 'auth1', nip: '001', username: '001', roles: ['SISWA'], manage: false } }, 'register',
        { slot_id: 's3', siswa_id: 1 }, db);
    assert.equal(r.ok, true);
    assert.deepEqual(tabel.klinik_peserta.map(p => String(p.siswa_id)), ['1']);
});
