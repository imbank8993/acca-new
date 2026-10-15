import { BadRequestException, NotFoundException } from '@nestjs/common';
import { UsersService } from './users.service';

describe('UsersService Profile Siswa Security & Validation', () => {
  let prismaMock: any;
  let service: UsersService;

  beforeEach(() => {
    prismaMock = {
      master_siswa: {
        findFirst: jest.fn(),
        update: jest.fn(),
      },
    };
    // Instantiate UsersService with mock dependencies
    service = new UsersService(
      prismaMock as any,
      {} as any, // orangtuaService
    );
  });

  it('rejects student update if account has no NISN / username / nip', async () => {
    await expect(
      service.updateProfileSiswa({ username: '', nip: '' }, { nomor_hp: '08123456789' }),
    ).rejects.toThrow(BadRequestException);
    expect(prismaMock.master_siswa.findFirst).not.toHaveBeenCalled();
  });

  it('rejects if student row not found in master_siswa', async () => {
    prismaMock.master_siswa.findFirst.mockResolvedValue(null);

    await expect(
      service.updateProfileSiswa({ username: '0012345678' }, { nomor_hp: '08123456789' }),
    ).rejects.toThrow(NotFoundException);
  });

  it('prevents IDOR and strips unauthorized fields (e.g. nisn, nama_lengkap, aktif, id)', async () => {
    prismaMock.master_siswa.findFirst.mockResolvedValue({ id: 100n, nisn: '0012345678' });
    prismaMock.master_siswa.update.mockResolvedValue({
      id: 100n,
      nisn: '0012345678',
      nama_lengkap: 'Nama Asli',
      nomor_hp: '08123456789',
    });

    const maliciousInput = {
      id: 999,
      nisn: '9999999999',
      nama_lengkap: 'Hacked Name',
      aktif: false,
      nomor_hp: '08123456789',
    };

    const res = await service.updateProfileSiswa({ username: '0012345678' }, maliciousInput);

    expect(res.ok).toBe(true);
    expect(prismaMock.master_siswa.update).toHaveBeenCalledWith({
      where: { id: 100n },
      data: expect.objectContaining({
        nomor_hp: '08123456789',
        updated_at: expect.any(Date),
      }),
    });

    // Verify malicious fields were stripped and never sent to update
    const updateData = prismaMock.master_siswa.update.mock.calls[0][0].data;
    expect(updateData.id).toBeUndefined();
    expect(updateData.nisn).toBeUndefined();
    expect(updateData.nama_lengkap).toBeUndefined();
    expect(updateData.aktif).toBeUndefined();
  });

  it('validates nomor_hp format and rejects malicious characters or invalid phone numbers', async () => {
    prismaMock.master_siswa.findFirst.mockResolvedValue({ id: 100n, nisn: '0012345678' });

    // Too short
    await expect(
      service.updateProfileSiswa({ username: '0012345678' }, { nomor_hp: '123' }),
    ).rejects.toThrow(BadRequestException);

    // Contains alphabets or scripts / injection
    await expect(
      service.updateProfileSiswa({ username: '0012345678' }, { nomor_hp: '08123456abc' }),
    ).rejects.toThrow(BadRequestException);

    await expect(
      service.updateProfileSiswa({ username: '0012345678' }, { nomor_hp: "<script>alert('xss')</script>" }),
    ).rejects.toThrow(BadRequestException);

    expect(prismaMock.master_siswa.update).not.toHaveBeenCalled();
  });

  it('accepts valid phone numbers and trims whitespace', async () => {
    prismaMock.master_siswa.findFirst.mockResolvedValue({ id: 100n, nisn: '0012345678' });
    prismaMock.master_siswa.update.mockResolvedValue({
      id: 100n,
      nisn: '0012345678',
      nomor_hp: '+62 812-3456-7890',
    });

    const res = await service.updateProfileSiswa(
      { username: '0012345678' },
      { nomor_hp: '  +62 812-3456-7890  ' },
    );

    expect(res.ok).toBe(true);
    expect(prismaMock.master_siswa.update).toHaveBeenCalledWith({
      where: { id: 100n },
      data: expect.objectContaining({
        nomor_hp: '+62 812-3456-7890',
      }),
    });
  });

  it('normalizes empty phone number to null', async () => {
    prismaMock.master_siswa.findFirst.mockResolvedValue({ id: 100n, nisn: '0012345678' });
    prismaMock.master_siswa.update.mockResolvedValue({
      id: 100n,
      nisn: '0012345678',
      nomor_hp: null,
    });

    const res = await service.updateProfileSiswa(
      { username: '0012345678' },
      { nomor_hp: '   ' },
    );

    expect(res.ok).toBe(true);
    expect(prismaMock.master_siswa.update).toHaveBeenCalledWith({
      where: { id: 100n },
      data: expect.objectContaining({
        nomor_hp: null,
      }),
    });
  });
});
