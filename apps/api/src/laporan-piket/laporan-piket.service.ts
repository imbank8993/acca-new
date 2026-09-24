import { Injectable, BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../common/storage.service';

@Injectable()
export class LaporanPiketService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  async getLaporan(limit: number = 50) {
    return this.prisma.laporan_piket.findMany({
      take: limit,
      orderBy: { created_at: 'desc' },
      include: {
        laporan_piket_detail: true,
      }
    }).then(results => results.map(r => ({
      ...r,
      details: r.laporan_piket_detail
    })));
  }

  async createLaporan(apiUser: any, body: any) {
    const { guruPiket, nip, tanggal, selectedDate, jamPiket, keteranganTambahan, details } = body;

    if (!guruPiket || !jamPiket || (Array.isArray(jamPiket) && jamPiket.length === 0)) {
      throw new BadRequestException('Nama Guru Piket dan Jam Piket wajib diisi!');
    }
    if (!details || !Array.isArray(details) || details.length === 0) {
      throw new BadRequestException('Detail laporan piket tidak boleh kosong!');
    }

    const piketDateStr = tanggal || selectedDate || new Date().toISOString().slice(0, 10);
    const piketDate = new Date(piketDateStr);
    
    const jams = Array.isArray(jamPiket) ? jamPiket : [jamPiket];

    const incomingPairs = details
      .map((d: any) => ({
        kelas: String(d.kelas || '').trim(),
        jam: String(d.jam_ke || jams[0] || '').trim(),
      }))
      .filter((p: any) => p.kelas && p.jam);

    if (incomingPairs.length > 0) {
      const existingHeaders = await this.prisma.laporan_piket.findMany({
        where: { tanggal: piketDate },
        select: { id: true }
      });

      const headerIds = existingHeaders.map(h => h.id);
      
      if (headerIds.length > 0) {
        const existingDetails = await this.prisma.laporan_piket_detail.findMany({
          where: { piket_id: { in: headerIds } },
          select: { nama_kelas: true, jam_ke: true }
        });

        const existingSet = new Set(
          existingDetails.map(d => `${String(d.nama_kelas || '').trim()}||${String(d.jam_ke || '').trim()}`)
        );

        const conflicts = incomingPairs.filter((p: any) => existingSet.has(`${p.kelas}||${p.jam}`));
        if (conflicts.length > 0) {
          const list = conflicts.map((c: any) => `${c.kelas} (JP ${c.jam})`).join(', ');
          throw new ConflictException(`Kelas berikut sudah dilaporkan pada jam tersebut: ${list}. Hapus laporan lama dahulu jika ingin menggantinya.`);
        }
      }
    }

    return this.prisma.$transaction(async (tx) => {
      const header = await tx.laporan_piket.create({
        data: {
          tanggal: piketDate,
          nama_guru_piket: guruPiket,
          nama_guru: guruPiket,
          nip: nip || apiUser.nip || '0',
          jam_ke: jams.join(','),
          keterangan: keteranganTambahan || null,
        }
      });

      const detailRows = details.map((item: any) => ({
        piket_id: header.id,
        nama_kelas: item.kelas,
        jam_ke: item.jam_ke || (jams[0] || ''),
        nama_guru: item.guru || null,
        status_kehadiran: item.status,
        status_tambahan_1: item.status_tambahan_1 || null,
        status_tambahan_2: item.status_tambahan_2 || null,
        status_tambahan_3: item.status_tambahan_3 || null,
        dokumentasi_url: item.dokumentasi_url || null
      }));

      await tx.laporan_piket_detail.createMany({
        data: detailRows
      });

      try {
        await tx.notifications.create({
          data: {
            type: 'piket_baru',
            title: `Laporan Piket Baru - ${jams.join(', ')}`,
            message: `Guru Piket: ${guruPiket}${keteranganTambahan ? ` • Catatan: ${keteranganTambahan}` : ''}`,
            link: '/piket',
            user_id: null, 
          } as any
        });
      } catch (e) {}

      return header;
    });
  }

  async updateLaporan(body: any) {
    const { id, tanggal, nama_guru_piket, jam_ke, keterangan } = body;
    if (!id) throw new BadRequestException('ID wajib diisi');

    const updateData: any = {};
    if (tanggal !== undefined) updateData.tanggal = new Date(tanggal);
    if (nama_guru_piket !== undefined) updateData.nama_guru_piket = nama_guru_piket;
    if (jam_ke !== undefined) updateData.jam_ke = jam_ke;
    if (keterangan !== undefined) updateData.keterangan = keterangan;

    return this.prisma.laporan_piket.update({
      where: { id: String(id) },
      data: updateData
    });
  }

  async deleteLaporan(id: string) {
    const targetId = String(id);
    const details = await this.prisma.laporan_piket_detail.findMany({
      where: { piket_id: targetId },
      select: { dokumentasi_url: true }
    });

    for (const d of details) {
      if (d.dokumentasi_url) {
        await this.storage.removeByUrl(d.dokumentasi_url).catch((err) => {
          console.error(`[deleteLaporan] Gagal menghapus foto piket ${d.dokumentasi_url}:`, err);
        });
      }
    }

    await this.prisma.laporan_piket.delete({
      where: { id: targetId }
    });
  }
}
