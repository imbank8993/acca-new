import { Test, TestingModule } from '@nestjs/testing';
import { OrangtuaService } from './orangtua.service';
import { PrismaService } from '../prisma/prisma.service';
import { BadRequestException } from '@nestjs/common';

describe('OrangtuaService - assertClaimAllowed', () => {
  let service: OrangtuaService;
  let mockPrisma: any;

  beforeEach(async () => {
    mockPrisma = {
      orangtua_siswa: {
        findMany: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrangtuaService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<OrangtuaService>(OrangtuaService);
  });

  it('should throw BadRequestException if statusKeluarga is invalid', async () => {
    await expect(
      service.assertClaimAllowed('1234567890', 'Paman', BigInt(1)),
    ).rejects.toThrow(BadRequestException);
  });

  it('should throw BadRequestException if user already claimed student', async () => {
    mockPrisma.orangtua_siswa.findMany.mockResolvedValue([
      { user_id: BigInt(1), status_keluarga: 'Ayah' },
    ]);

    await expect(
      service.assertClaimAllowed('1234567890', 'Ayah', BigInt(1)),
    ).rejects.toThrow('Anda sudah mengklaim siswa ini sebelumnya.');
  });

  it('should throw BadRequestException if student already has 2 parents', async () => {
    mockPrisma.orangtua_siswa.findMany.mockResolvedValue([
      { user_id: BigInt(1), status_keluarga: 'Ayah' },
      { user_id: BigInt(2), status_keluarga: 'Ibu' },
    ]);

    await expect(
      service.assertClaimAllowed('1234567890', 'Wali', BigInt(3)),
    ).rejects.toThrow(/sudah diklaim batas maksimal/);
  });

  it('should throw BadRequestException if status Ayah is duplicate for student', async () => {
    mockPrisma.orangtua_siswa.findMany.mockResolvedValue([
      { user_id: BigInt(1), status_keluarga: 'Ayah' },
    ]);

    await expect(
      service.assertClaimAllowed('1234567890', 'Ayah', BigInt(2)),
    ).rejects.toThrow("Akun dengan status keluarga 'Ayah' sudah diklaim untuk siswa ini.");
  });

  it('should allow valid claim when student has 0 claims', async () => {
    mockPrisma.orangtua_siswa.findMany.mockResolvedValue([]);

    await expect(
      service.assertClaimAllowed('1234567890', 'Ayah', BigInt(1)),
    ).resolves.not.toThrow();
  });
});
