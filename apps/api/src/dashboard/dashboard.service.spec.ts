import { DashboardService } from './dashboard.service';

describe('DashboardService student summary', () => {
  let prisma: any;
  let service: DashboardService;
  const user = { id: 1n, username: '001', roles: ['SISWA'] };

  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date('2026-10-04T17:00:00Z'));
    prisma = {
      master_tahun_ajaran: { findMany: jest.fn().mockResolvedValue([{ tahun_ajaran: '2026/2027' }]) },
      master_siswa: { findUnique: jest.fn().mockResolvedValue({ id: 10n }) },
      siswa_kelas: { findMany: jest.fn().mockResolvedValue([]) },
      master_kelas: { findMany: jest.fn().mockResolvedValue([{ nama: 'XI A', program: 'Reguler' }]) },
      wali_kelas: { findFirst: jest.fn().mockResolvedValue(null) },
      guru_asuh: {
        findFirst: jest.fn().mockResolvedValue(null),
        findMany: jest.fn().mockResolvedValue([]),
      },
      site_settings: { findUnique: jest.fn().mockResolvedValue({ value: 'Asia/Makassar' }) },
      ketidakhadiran: { findMany: jest.fn().mockResolvedValue([]) },
      public_users: { findMany: jest.fn().mockResolvedValue([]) },
    };
    service = new DashboardService(prisma);
  });

  afterEach(() => jest.useRealTimers());

  it('keeps old classes in history without treating them as current', async () => {
    prisma.siswa_kelas.findMany.mockResolvedValue([{ kelas: 'X A', tahun_ajaran: '2025/2026' }]);
    const result = await service.getDashboardSummary(user);
    expect(result.siswaData.kelasSekarang).toBeNull();
    expect(result.siswaData.kelasHistory).toEqual([{ kelas: 'X A', tahun_ajaran: '2025/2026' }]);
    expect(prisma.wali_kelas.findFirst).not.toHaveBeenCalled();
  });

  it('uses only the newest active year and prefers its regular class', async () => {
    prisma.master_tahun_ajaran.findMany.mockResolvedValue([
      { tahun_ajaran: '2025/2026' }, { tahun_ajaran: '2026/2027' },
    ]);
    prisma.siswa_kelas.findMany.mockResolvedValue([
      { kelas: 'X A', tahun_ajaran: '2025/2026' },
      { kelas: 'UTBK', tahun_ajaran: '2026/2027' },
      { kelas: 'XI A', tahun_ajaran: '2026/2027' },
    ]);
    const result = await service.getDashboardSummary(user);
    expect(result.siswaData.kelasSekarang).toBe('XI A');
    expect(prisma.wali_kelas.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { nama_kelas: 'XI A', aktif: true, tahun_ajaran: '2026/2027' },
    }));
  });

  it('does not choose a class when no academic year is active', async () => {
    prisma.master_tahun_ajaran.findMany.mockResolvedValue([]);
    prisma.siswa_kelas.findMany.mockResolvedValue([{ kelas: 'XI A', tahun_ajaran: '2026/2027' }]);
    const result = await service.getDashboardSummary(user);
    expect(result.siswaData.kelasSekarang).toBeNull();
  });

  it('does not substitute an older active year when newest-year enrollment is missing', async () => {
    prisma.master_tahun_ajaran.findMany.mockResolvedValue([
      { tahun_ajaran: '2025/2026' }, { tahun_ajaran: '2026/2027' },
    ]);
    prisma.siswa_kelas.findMany.mockResolvedValue([{ kelas: 'X A', tahun_ajaran: '2025/2026' }]);
    const result = await service.getDashboardSummary(user);
    expect(result.siswaData.kelasSekarang).toBeNull();
  });

  it('returns scoped sibling attendance on the school date, with sickness taking priority', async () => {
    prisma.guru_asuh.findFirst.mockResolvedValue({ nama_guru: 'Guru Asuh', nip: 'G01' });
    prisma.guru_asuh.findMany.mockResolvedValue(['002', '003', '004'].map(nisn_siswa => ({
      nisn_siswa, nama_siswa: nisn_siswa, kelas: 'XI A',
    })));
    prisma.ketidakhadiran.findMany.mockResolvedValue([
      { nisn: '002', jenis: 'IZIN' }, { nisn: '002', jenis: 'SAKIT' },
      { nisn: '002', jenis: 'IZIN' }, { nisn: '003', jenis: 'IZIN' },
    ]);
    const result = await service.getDashboardSummary(user, '999');
    expect(prisma.master_siswa.findUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { nisn: '001' } }));
    expect(prisma.guru_asuh.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { nip: 'G01', aktif: true, tahun_ajaran: '2026/2027', nisn_siswa: { not: '001' } },
    }));
    expect(prisma.ketidakhadiran.findMany).toHaveBeenCalledWith({
      where: {
        nisn: { in: ['002', '003', '004'] }, aktif: true,
        tgl_mulai: { lte: new Date('2026-10-05T23:59:59.999Z') },
        tgl_selesai: { gte: new Date('2026-10-05T00:00:00Z') },
        jenis: { in: ['SAKIT', 'IZIN'] },
      },
      select: { nisn: true, jenis: true },
    });
    expect(result.siswaData.saudaraAsuhKehadiran).toEqual({
      '002': { kode: 'SAKIT', keterangan: 'Sakit hari ini' },
      '003': { kode: 'IZIN', keterangan: 'Izin hari ini' },
      '004': { kode: 'HADIR', keterangan: 'Hadir hari ini' },
    });
  });
});
