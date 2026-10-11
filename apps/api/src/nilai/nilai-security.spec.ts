import { NilaiService } from './nilai.service';

const user = { id: '1', nip: 'G1', roles: ['GURU'] };
const scope = { nip: 'G1', kelas: 'X A', mapel: 'Matematika', semester: 'Ganjil', tahun_ajaran: '2026/2027' };
const score = { nisn: '001', jenis: 'PAS', nilai: 80 };
const appreciation = { ...scope, judul: 'Kuis', poin_per_soal: 2, items: [{ nisn: '001', jumlah_menang: 3, total_poin: 999999 }] };

function fixture() {
  let committed: any[] = [];
  const prisma: any = {
    siswa_kelas: { findMany: jest.fn().mockResolvedValue([{ nisn: '001' }]) },
    $transaction: jest.fn(async (callback: any) => {
      const pending: any[] = [];
      const result = await callback({
        nilai_data: {
          findMany: jest.fn().mockResolvedValue([]),
          create: jest.fn(async ({ data }: any) => {
            if (data.nilai === 99) throw new Error('Database unavailable');
            pending.push(data);
            return { id: String(pending.length), ...data };
          }),
        },
        nilai_apresiasi_sesi: { create: jest.fn(async ({ data }: any) => {
          pending.push(data);
          return { id: 'session', ...data };
        }) },
        nilai_apresiasi_poin: { create: jest.fn(async ({ data }: any) => {
          if (data.catatan === 'fail') throw new Error('Database unavailable');
          pending.push(data);
          return data;
        }) },
      });
      committed = pending;
      return result;
    }),
  };
  const service = new NilaiService(prisma);
  const assignment = jest.spyOn(service, 'checkGuruAssignment').mockResolvedValue(true);
  return { service, prisma, assignment, committed: () => committed };
}

describe('Nilai security and atomic saves', () => {
  it('rejects appreciation outside the teacher assignment before writing', async () => {
    const f = fixture();
    f.assignment.mockResolvedValue(false);
    await expect(f.service.saveApresiasi(user, appreciation)).rejects.toThrow('wewenang');
    expect(f.assignment).toHaveBeenCalledWith('G1', 'X A', 'Matematika', '2026/2027', 1);
    expect(f.prisma.$transaction).not.toHaveBeenCalled();
  });

  it.each(['nilai', 'apresiasi'])('rejects a student outside the exact class and period for %s', async kind => {
    const f = fixture();
    f.prisma.siswa_kelas.findMany.mockResolvedValue([]);
    const action = kind === 'nilai'
      ? f.service.saveNilai(user, { ...scope, updates: [score] })
      : f.service.saveApresiasi(user, appreciation);
    await expect(action).rejects.toThrow('tidak terdaftar');
    expect(f.prisma.siswa_kelas.findMany).toHaveBeenCalledWith({
      where: { nisn: { in: ['001'] }, kelas: 'X A', tahun_ajaran: '2026/2027', semester: 'Ganjil', aktif: true },
      select: { nisn: true },
    });
    expect(f.prisma.$transaction).not.toHaveBeenCalled();
  });

  it('also validates student enrollment for administrators', async () => {
    const f = fixture();
    f.prisma.siswa_kelas.findMany.mockResolvedValue([]);
    await expect(f.service.saveNilai({ ...user, roles: ['ADMIN'] }, { ...scope, updates: [score] }))
      .rejects.toThrow('tidak terdaftar');
    expect(f.prisma.$transaction).not.toHaveBeenCalled();
  });

  it('calculates appreciation totals from wins and points, ignoring forged totals', async () => {
    const f = fixture();
    await expect(f.service.saveApresiasi(user, appreciation)).resolves.toMatchObject({ ok: true });
    expect(f.committed()[1]).toMatchObject({ nisn: '001', jumlah_menang: 3, total_poin: 6 });
  });

  it.each([-1, Infinity, '2abc', 0, 1000, 0.001])('rejects invalid points %s', async points => {
    const f = fixture();
    await expect(f.service.saveApresiasi(user, { ...appreciation, poin_per_soal: points })).rejects.toThrow();
    expect(f.prisma.$transaction).not.toHaveBeenCalled();
  });

  it.each([-1, 1.5, Infinity])('rejects invalid win counts %s', async wins => {
    const f = fixture();
    await expect(f.service.saveApresiasi(user, { ...appreciation, items: [{ nisn: '001', jumlah_menang: wins }] }))
      .rejects.toThrow();
    expect(f.prisma.$transaction).not.toHaveBeenCalled();
  });

  it('validates every score before starting the transaction', async () => {
    const f = fixture();
    await expect(f.service.saveNilai(user, { ...scope, updates: [score, { ...score, nilai: '80abc' }] }))
      .rejects.toThrow('angka');
    expect(f.prisma.$transaction).not.toHaveBeenCalled();
  });

  it('propagates a failed write and rolls back earlier scores', async () => {
    const f = fixture();
    await expect(f.service.saveNilai(user, { ...scope, updates: [score, { ...score, jenis: 'UH', nilai: 99 }] }))
      .rejects.toThrow('Database unavailable');
    expect(f.committed()).toEqual([]);
  });

  it('rolls back the appreciation session when its points cannot be saved', async () => {
    const f = fixture();
    await expect(f.service.saveApresiasi(user, {
      ...appreciation, items: [{ nisn: '001', jumlah_menang: 1, catatan: 'fail' }],
    })).rejects.toThrow('Database unavailable');
    expect(f.committed()).toEqual([]);
  });

  it('saves valid scores and reports success only after committing', async () => {
    const f = fixture();
    await expect(f.service.saveNilai(user, { ...scope, updates: [score] }))
      .resolves.toMatchObject({ ok: true, inserted: 1, updated: 0 });
    expect(f.committed()).toHaveLength(1);
  });

  it.each([{}, { semester: 3 }, { tahun_ajaran: '' }])('rejects missing or invalid write periods: %j', async invalid => {
    const f = fixture();
    const body = Object.keys(invalid).length ? { ...scope, ...invalid } : { ...scope, semester: undefined };
    await expect(f.service.saveNilai(user, { ...body, updates: [score] })).rejects.toThrow('Semester');
    expect(f.prisma.$transaction).not.toHaveBeenCalled();
  });
});
