import { BadRequestException, ConflictException } from '@nestjs/common';
import { JadwalWriteService, jadwalDate, jadwalRows } from './jadwal-write.service';

const row = { nip: '123', nama_guru: 'Guru', hari: 'Senin', jam_ke: '1', kelas: 'X A', mata_pelajaran: 'Matematika' };

describe('Jadwal writes', () => {
  it('rejects impossible dates and duplicate physical slots before writing', () => {
    expect(() => jadwalDate('2026-02-30')).toThrow(BadRequestException);
    expect(() => jadwalRows([row, { ...row, nip: '456', jam_ke: '01' }], jadwalDate('2026-09-18'))).toThrow('Slot ganda');
    expect(() => jadwalRows([], new Date())).toThrow(BadRequestException);
  });

  it('writes the requested version and replaces only its date in one serializable transaction', async () => {
    const tx = {
      jadwal_versi: { upsert: jest.fn().mockResolvedValue({ id: 7n }) },
      jadwal_guru: { updateMany: jest.fn().mockResolvedValue({ count: 2 }), createMany: jest.fn().mockResolvedValue({ count: 1 }) },
    };
    const prisma = { $transaction: jest.fn(work => work(tx)) };
    const result = await new JadwalWriteService(prisma as any).generate({ berlaku_mulai: '2026-09-18', jenis: 'penuh', rows: [row] }, { nip: 'admin' });
    expect(prisma.$transaction).toHaveBeenCalledWith(expect.any(Function), expect.objectContaining({ isolationLevel: 'Serializable' }));
    expect(tx.jadwal_versi.upsert.mock.calls[0][0].create.jenis).toBe('penuh');
    expect(tx.jadwal_guru.updateMany).toHaveBeenCalledWith({ where: { berlaku_mulai: jadwalDate('2026-09-18'), aktif: true }, data: { aktif: false } });
    expect(tx.jadwal_guru.createMany.mock.calls[0][0].data[0].versi_id).toBe(7n);
    expect(result.data).toEqual({ versi_id: '7', inserted: 1, replaced: 2 });
  });

  it('propagates insertion failure out of the transaction so PostgreSQL rolls back', async () => {
    const failure = Object.assign(new Error('duplicate'), { code: 'P2002' });
    const tx = {
      jadwal_versi: { upsert: jest.fn().mockResolvedValue({ id: 7n }) },
      jadwal_guru: { updateMany: jest.fn().mockResolvedValue({ count: 1 }), createMany: jest.fn().mockRejectedValue(failure) },
    };
    const prisma = { $transaction: jest.fn(async work => {
      await expect(work(tx)).rejects.toBe(failure);
      throw failure;
    }) };
    await expect(new JadwalWriteService(prisma as any).generate({ berlaku_mulai: '2026-09-18', jenis: 'parsial', rows: [row] }, {})).rejects.toThrow(ConflictException);
  });

  it('rejects stale manual edits before inserting replacements', async () => {
    const tx = { jadwal_guru: { updateMany: jest.fn().mockResolvedValue({ count: 0 }) } };
    const prisma = { $transaction: (work: any) => work(tx) };
    await expect(new JadwalWriteService(prisma as any).save({ berlaku_mulai: '2026-09-18', replace_ids: ['1'], rows: [row] })).rejects.toThrow(ConflictException);
  });

  it('deletes all selected dates directly, without a latest-date listing', async () => {
    const tx = { jadwal_guru: { updateMany: jest.fn().mockResolvedValue({ count: 5 }) } };
    const prisma = { $transaction: (work: any) => work(tx) };
    const dates = ['2026-01-01', '2026-08-01'];
    await new JadwalWriteService(prisma as any).deleteDates({ dates });
    expect(tx.jadwal_guru.updateMany.mock.calls[0][0].where.berlaku_mulai.in).toEqual(dates.map(jadwalDate));
  });

  it('does not merge two existing versions when moving a date', async () => {
    const tx = { jadwal_versi: { findUnique: jest.fn().mockResolvedValue({ id: 7n }) } };
    const prisma = { $transaction: (work: any) => work(tx) };
    await expect(new JadwalWriteService(prisma as any).moveDate({ old_date: '2026-09-18', new_date: '2026-09-19' })).rejects.toThrow(ConflictException);
  });
});
