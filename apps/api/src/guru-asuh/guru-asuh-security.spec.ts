import { GuruAsuhService } from './guru-asuh.service';
import { SettingsService } from '../settings/settings.service';
import { KetidakhadiranService } from '../ketidakhadiran/ketidakhadiran.service';

describe('Guru Asuh security regressions', () => {
  afterEach(() => jest.useRealTimers());

  it('rejects client-supplied document URLs without writing to the database', async () => {
    const update = jest.fn();
    const service = new GuruAsuhService({ laporan_guru_asuh_submissions: { update } } as any);
    await expect(service.updatePdfUrl({ nip: 'G1', roles: ['ADMIN'] }, 'id', 'https://example.org/fake.pdf'))
      .rejects.toThrow('Tautan PDF tidak dapat diubah');
    expect(update).not.toHaveBeenCalled();
  });

  it('rejects reactivation when the student is already claimed by another teacher', async () => {
    const update = jest.fn();
    const service = new SettingsService({ guru_asuh: {
      findUnique: jest.fn().mockResolvedValue({ id: 1n, nip: 'G1', nisn_siswa: '001', tahun_ajaran: '2026/2027', aktif: false }),
      findFirst: jest.fn().mockResolvedValue({ id: 2n, nama_guru: 'Guru lain' }), update,
    } } as any);
    await expect(service.updateGuruAsuh({ id: '1', aktif: true }, { nip: 'G1' }))
      .rejects.toThrow('sudah diasuh');
    expect(update).not.toHaveBeenCalled();
  });

  it('allows reactivation when no other active claim exists', async () => {
    const record = { id: 1n, nip: 'G1', nisn_siswa: '001', tahun_ajaran: '2026/2027', aktif: false };
    const update = jest.fn().mockResolvedValue({ ...record, aktif: true });
    const service = new SettingsService({ guru_asuh: {
      findUnique: jest.fn().mockResolvedValue(record), findFirst: jest.fn().mockResolvedValue(null), update,
    } } as any);
    await expect(service.updateGuruAsuh({ id: '1', aktif: true }, { nip: 'G1' })).resolves.toMatchObject({ ok: true });
    expect(update).toHaveBeenCalled();
  });

  it.each([
    ['Asia/Makassar', '2026-10-10'],
    ['Asia/Jakarta', '2026-10-09'],
    ['invalid', '2026-10-10'],
  ])('uses the school date for attendance in %s', async (zone, expected) => {
    jest.useFakeTimers().setSystemTime(new Date('2026-10-09T16:30:00Z'));
    const service = new KetidakhadiranService({
      site_settings: { findUnique: jest.fn().mockResolvedValue({ value: zone }) },
      guru_asuh: { findMany: jest.fn().mockResolvedValue([]) },
    } as any);
    const result = await service.getLogGuruAsuh('G1');
    expect(result.today).toBe(expected);
  });
});
