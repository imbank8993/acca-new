import { BadRequestException, ConflictException, ForbiddenException } from '@nestjs/common';
import { JadwalService } from './jadwal.service';
import { tanggalSementara, tandaBaris, terapkanSementara, pastikanBebasBentrok } from './jadwal-sementara';

const rows = [
  { id: 1n, nip: '001', nama_guru: 'Guru A', mata_pelajaran: 'Matematika', kelas: 'X A', hari: 'Senin', jam_ke: '1' },
  { id: 2n, nip: '002', nama_guru: 'Guru B', mata_pelajaran: 'Fisika', kelas: 'X B', hari: 'Selasa', jam_ke: '2' },
];
const changes = rows.map((r, i) => ({ id: String(r.id), asal: tandaBaris(r), pengganti: { nip: rows[1 - i].nip, nama_guru: rows[1 - i].nama_guru, mata_pelajaran: rows[1 - i].mata_pelajaran } }));
const admin = { roles: ['ADMIN'], nama: 'Admin' };
const body = { jenis: 'mengajar', mulai: '2026-11-02', selesai: '2026-11-08', slots_a: ['1'], slots_b: ['2'], alasan: 'Kegiatan madrasah' };

function setup(records: any[] = []) {
  const tx = {
    $executeRaw: jest.fn(),
    jadwal_sementara: { findMany: jest.fn().mockResolvedValue(records), create: jest.fn().mockResolvedValue({ id: 9n }), updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
  };
  const prisma = {
    site_settings: { findUnique: jest.fn().mockResolvedValue(null) },
    jadwal_sementara: { findMany: jest.fn(async ({ where }: any) => records.filter(r => !r.dibatalkan && r.mulai <= where.mulai.lte && r.selesai >= where.selesai.gte)) },
    $transaction: jest.fn(work => work(tx)),
  };
  return { service: new JadwalService(prisma as any), prisma, tx };
}

describe('Jadwal sementara', () => {
  it.each(['2026-02-30', '2026-13-01', 'invalid', '2026-1-01'])('rejects invalid calendar input %s', value => {
    expect(() => tanggalSementara(value)).toThrow(BadRequestException);
  });

  it('applies swaps without mutating the permanent schedule', () => {
    const actual = terapkanSementara(rows, [{ perubahan: changes }]);
    expect(actual[0]).toMatchObject({ nip: '002', mata_pelajaran: 'Fisika', kelas: 'X A', hari: 'Senin' });
    expect(rows[0].nip).toBe('001');
  });

  it('ignores the entire swap if one original slot has changed', () => {
    const updated = [rows[0], { ...rows[1], nip: '003' }];
    expect(terapkanSementara(updated, [{ perubahan: changes }])).toEqual(updated);
  });

  it('detects a collision with another teaching slot', () => {
    const collision = { ...rows[1], id: 3n, hari: 'Senin', jam_ke: '01' };
    expect(() => pastikanBebasBentrok([...terapkanSementara(rows, [{ perubahan: changes }]), collision], ['1', '2'], 'mengajar')).toThrow(ConflictException);
  });

  it('starts and expires inclusively, including historical reads', async () => {
    const { service } = setup([{ jenis: 'mengajar', mulai: new Date(body.mulai), selesai: new Date(body.selesai), perubahan: changes }]);
    for (const day of ['2026-11-02', '2026-11-08']) {
      expect((await service.applySementara(rows, day, 'mengajar'))[0].nip).toBe('002');
    }
    for (const day of ['2026-11-01', '2026-11-09']) {
      expect((await service.applySementara(rows, day, 'mengajar'))[0].nip).toBe('001');
    }
  });

  it('rejects an ordinary teacher before reading or writing schedules', async () => {
    const { service, prisma } = setup();
    await expect(service.createSementara({ roles: ['GURU'] }, body)).rejects.toThrow(ForbiddenException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('accepts an explicitly designated account', async () => {
    const { service, prisma } = setup();
    prisma.site_settings.findUnique.mockResolvedValue({ value: JSON.stringify({ allowedRoles: [], allowedUsers: [{ id: '8' }] }) } as never);
    expect(await service.bolehSementara({ id: 8, roles: ['GURU'] })).toBe(true);
  });

  it('creates an immediate overlay and validates every day, without changing base rows', async () => {
    const { service, tx } = setup();
    const resolve = jest.spyOn(service, 'resolveJadwalBerlaku').mockResolvedValue(rows);
    await expect(service.createSementara(admin, body)).resolves.toEqual({ ok: true, data: { id: '9' } });
    expect(resolve).toHaveBeenCalledTimes(7);
    expect(tx.jadwal_sementara.create.mock.calls[0][0].data.perubahan).toHaveLength(2);
    expect(tx.$executeRaw).toHaveBeenCalledTimes(1);
    expect(rows[0].nip).toBe('001');
  });

  it('rejects overlapping assignments for either teacher', async () => {
    const { service, tx } = setup([{ perubahan: changes }]);
    jest.spyOn(service, 'resolveJadwalBerlaku').mockResolvedValue(rows);
    await expect(service.createSementara(admin, body)).rejects.toThrow(ConflictException);
    expect(tx.jadwal_sementara.create).not.toHaveBeenCalled();
  });

  it('rejects a period spanning a new normal schedule version', async () => {
    const { service, tx } = setup();
    jest.spyOn(service, 'resolveJadwalBerlaku').mockResolvedValueOnce(rows).mockResolvedValue([]);
    await expect(service.createSementara(admin, body)).rejects.toThrow(ConflictException);
    expect(tx.jadwal_sementara.create).not.toHaveBeenCalled();
  });

  it.each([
    { selesai: '2026-11-01' }, { selesai: '2026-12-31' }, { slots_b: ['1'] }, { alasan: '' },
  ])('rejects malformed input before opening a transaction', async invalid => {
    const { service, prisma } = setup();
    await expect(service.createSementara(admin, { ...body, ...invalid })).rejects.toThrow(BadRequestException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('cancels the overlay without modifying the normal timetable', async () => {
    const { service, tx } = setup();
    await expect(service.cancelSementara(admin, '9')).resolves.toEqual({ ok: true });
    expect(tx.jadwal_sementara.updateMany).toHaveBeenCalledWith({ where: { id: 9n, dibatalkan: false }, data: { dibatalkan: true } });
  });

  it('exchanges complete duty groups while preserving their rooms and classes', async () => {
    const { service, tx } = setup();
    const duties = rows.map(r => ({ ...r, jam_ke: Number(r.jam_ke), kode_guru: r.nip, ruang: r.kelas }));
    jest.spyOn(service, 'resolvePiketDasar').mockResolvedValue(duties as any);
    await service.createSementara(admin, { ...body, jenis: 'piket' });
    const edits = tx.jadwal_sementara.create.mock.calls[0][0].data.perubahan;
    expect(edits[0].pengganti).toEqual({ nip: '002', kode_guru: '002' });
    expect(terapkanSementara(duties, [{ perubahan: edits }])[0]).toMatchObject({ nip: '002', ruang: 'X A', kelas: 'X A' });
  });

  it('rejects a partially selected duty group', async () => {
    const { service, tx } = setup();
    jest.spyOn(service, 'resolvePiketDasar').mockResolvedValue([...rows, { ...rows[0], id: 3n, kelas: 'X C' }] as any);
    await expect(service.createSementara(admin, { ...body, jenis: 'piket' })).rejects.toThrow('seluruh baris tugas piket');
    expect(tx.jadwal_sementara.create).not.toHaveBeenCalled();
  });

  it('rejects a duty swap when the receiving teacher is already on duty at that time', async () => {
    const { service, tx } = setup();
    jest.spyOn(service, 'resolvePiketDasar').mockResolvedValue([...rows, { ...rows[0], id: 3n, nip: '002' }] as any);
    await expect(service.createSementara(admin, { ...body, jenis: 'piket' })).rejects.toThrow(ConflictException);
    expect(tx.jadwal_sementara.create).not.toHaveBeenCalled();
  });

  it('ignores cancelled overlays even for historical dates', async () => {
    const { service } = setup([{ mulai: new Date(body.mulai), selesai: new Date(body.selesai), dibatalkan: true, perubahan: changes }]);
    expect(await service.applySementara(rows, body.mulai, 'mengajar')).toEqual(rows);
  });
});
