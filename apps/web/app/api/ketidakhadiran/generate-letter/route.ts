import { prisma } from '@/lib/prisma';
import { NextRequest, NextResponse } from 'next/server';
import QRCode from 'qrcode';

export const dynamic = 'force-dynamic';

import {
  getMonthRoman,
  formatDateId,
  buildSingleHtml,
  buildCollectiveHtml,
  buildRekapanHtml,
} from '@/app/ketidakhadiran/utils/letter-html';

async function resolvePejabat(pejabatId?: string, defaultJabatan?: string) {
  let nama = 'Imran, S.Si.';
  let nip = '-';
  let jabatan = defaultJabatan || 'Guru';

  if (!pejabatId) return { nama, nip, jabatan };

  try {
    const numericId = parseInt(pejabatId, 10);
    let guruData: any = null;
    if (!isNaN(numericId)) {
      guruData = await prisma.master_guru.findUnique({
        where: { id: numericId },
        select: { nama_lengkap: true, nip: true },
      });
    }
    if (!guruData && typeof pejabatId === 'string' && pejabatId.length > 5) {
      guruData = await prisma.master_guru.findFirst({
        where: { nip: pejabatId },
        select: { nama_lengkap: true, nip: true },
      });
    }
    if (!guruData) {
      guruData = await prisma.master_guru.findFirst({
        where: { nama_lengkap: { contains: pejabatId, mode: 'insensitive' } },
        select: { nama_lengkap: true, nip: true },
      });
    }
    if (guruData) {
      nama = guruData.nama_lengkap || nama;
      nip = guruData.nip || nip;
    } else {
      nama = pejabatId;
    }
  } catch {}

  return { nama, nip, jabatan };
}
import { getTemplateBackgroundUrl } from '@/lib/surat-config';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const {
      letterType,
      row,
      rows,
      petugasNama,
      pejabatId,
      pejabatJabatan,
      month,
      year,
      forceReprint,
      oldLetterId,
    } = body;

    if (forceReprint && oldLetterId) {
      await prisma.acca_letters.deleteMany({ where: { id: oldLetterId } });
    }

    const isCollective = Array.isArray(rows) && rows.length > 0;
    const isRekap = letterType === 'REKAPAN_IZIN' || letterType === 'REKAPAN_SAKIT';

    // Duplicate checks
    if (!forceReprint) {
      if (isRekap) {
        const monthNum = parseInt(String(month), 10) || new Date().getMonth() + 1;
        const yearNum = parseInt(String(year), 10) || new Date().getFullYear();
        const rekapTag = `Rekap ${String(monthNum).padStart(2, '0')}/${yearNum}`;
        const existing = await prisma.acca_letters.findFirst({
          where: {
            jenis_izin: letterType,
            keterangan: { contains: rekapTag },
          },
          orderBy: { generated_at: 'desc' },
        });
        if (existing) {
          return NextResponse.json({ ok: false, alreadyPrinted: true, data: existing });
        }
      } else {
        const targetJenisList =
          (letterType === 'MENINGGALKAN_ASRAMA' || letterType === 'AKHIR_PEKAN')
            ? ['MENINGGALKAN_ASRAMA', 'P', 'M']
            : (letterType === 'REKOMENDASI_KONTROL' || letterType === 'SAKIT')
              ? ['REKOMENDASI_KONTROL']
              : (letterType === 'REKAM_MEDIK')
                ? ['REKAM_MEDIK']
                : [letterType];

        if (isCollective) {
          const nisns = rows.map((r: any) => r.nisn).filter(Boolean);
          const firstRow = rows[0];
          const existing = await prisma.acca_letters.findFirst({
            where: {
              OR: [
                { siswa_nisn: { in: nisns } },
                ...nisns.map((n: string) => ({ siswa_nisn: { contains: n } })),
              ],
              tgl_mulai: firstRow?.tgl_mulai,
              tgl_selesai: firstRow?.tgl_selesai,
              jenis_izin: { in: targetJenisList },
            },
            orderBy: { generated_at: 'desc' },
          });
          if (existing) {
            return NextResponse.json({ ok: false, alreadyPrinted: true, data: existing });
          }
        } else if (row) {
          const existing = await prisma.acca_letters.findFirst({
            where: {
              siswa_nisn: row.nisn,
              tgl_mulai: row.tgl_mulai,
              tgl_selesai: row.tgl_selesai,
              jenis_izin: { in: targetJenisList },
            },
            orderBy: { generated_at: 'desc' },
          });
          if (existing) {
            return NextResponse.json({ ok: false, alreadyPrinted: true, data: existing });
          }
        }
      }
    }

    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth() + 1;
    const monthRoman = getMonthRoman(currentMonth);

    const isUks =
      letterType === 'REKOMENDASI_KONTROL' ||
      letterType === 'REKAM_MEDIK' ||
      letterType === 'REKAPAN_SAKIT' ||
      (letterType === 'SAKIT' && letterType !== 'MENINGGALKAN_ASRAMA');
    const jenisSub = isUks ? 'UKS' : (row?.status === 'MADRASAH' ? 'M' : 'P');

    let nextNumber = 1;
    if (isUks) {
      const lastLetter = await prisma.acca_letters.findFirst({
        where: {
          nomor_surat: { contains: '/UKS/' },
          AND: { nomor_surat: { contains: `/${currentYear}` } },
        },
        orderBy: { nomor_urut: 'desc' },
        select: { nomor_urut: true },
      });
      nextNumber = (lastLetter?.nomor_urut || 0) + 1;
    } else {
      const seq = await prisma.acca_letter_sequence.findUnique({
        where: { tahun: currentYear },
      });
      if (seq) {
        nextNumber = (seq.last_number || 0) + 1;
      }
      await prisma.acca_letter_sequence.upsert({
        where: { tahun: currentYear },
        update: { last_number: nextNumber },
        create: { tahun: currentYear, last_number: nextNumber },
      });
    }

    const nomorSurat = isUks
      ? `${String(nextNumber).padStart(3, '0')}/UKS/${monthRoman}/${currentYear}`
      : `${String(nextNumber).padStart(3, '0')}/IZIN/${jenisSub}/${monthRoman}/${currentYear}`;

    const barcode = 'ACCA-' + Date.now().toString(36).toUpperCase() + '-' + Math.random().toString(36).slice(2, 8).toUpperCase();

    const origin = request.nextUrl.origin || 'https://acca.icgowa.sch.id';
    const scanUrl = `${origin}/ketidakhadiran/verify/${barcode}`;

    let qrCodeUrl: string | undefined;
    try {
      qrCodeUrl = await QRCode.toDataURL(scanUrl, {
        width: 250,
        margin: 1,
        color: {
          dark: '#000000',
          light: '#ffffff',
        },
        errorCorrectionLevel: 'M',
      });
    } catch (qrErr) {
      console.error('[generate-letter] QR Code generation error:', qrErr);
    }

    const pejabat = await resolvePejabat(pejabatId, pejabatJabatan);
    const backgroundUrl = await getTemplateBackgroundUrl(letterType);

    let letterHtml = '';
    let studentNama = '-';
    let studentNisn = '-';
    let studentKelas = '-';
    let tglMulai = '';
    let tglSelesai = '';
    let keterangan = '';

    if (isRekap) {
      const monthNum = parseInt(String(month), 10) || currentMonth;
      const yearNum = parseInt(String(year), 10) || currentYear;
      const monthNames = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
      const monthName = monthNames[monthNum - 1] || 'Bulan';
      tglMulai = `${yearNum}-${String(monthNum).padStart(2, '0')}-01`;
      tglSelesai = `${yearNum}-${String(monthNum).padStart(2, '0')}-28`;
      studentNama = `Rekapitulasi ${letterType === 'REKAPAN_IZIN' ? 'Izin' : 'Sakit'}`;
      studentNisn = 'REKAP';
      studentKelas = '-';
      keterangan = `Rekap ${String(monthNum).padStart(2, '0')}/${yearNum} (${monthName} ${yearNum})`;

      letterHtml = buildRekapanHtml({
        nomorSurat,
        barcode,
        letterType,
        monthName,
        year: yearNum,
        pejabatNama: pejabat.nama,
        pejabatJabatan: pejabat.jabatan,
        pejabatNip: pejabat.nip,
        scanUrl,
        qrCodeUrl,
        backgroundUrl,
        autoPrint: true,
      });
    } else if (isCollective) {
      const firstRow = rows[0] || {};
      tglMulai = firstRow.tgl_mulai || '';
      tglSelesai = firstRow.tgl_selesai || tglMulai;
      studentNama = `${rows.length} Siswa (Kolektif)`;
      studentNisn = rows.map((r: any) => r.nisn).filter(Boolean).join(',');
      studentKelas = Array.from(new Set(rows.map((r: any) => r.kelas).filter(Boolean))).join(', ');
      keterangan = firstRow.keterangan || 'Izin meninggalkan asrama kolektif';

      letterHtml = buildCollectiveHtml({
        nomorSurat,
        barcode,
        rows,
        tglMulai,
        tglSelesai,
        keterangan,
        pejabatNama: pejabat.nama,
        pejabatJabatan: pejabat.jabatan,
        pejabatNip: pejabat.nip,
        scanUrl,
        qrCodeUrl,
        backgroundUrl,
        autoPrint: true,
      });
    } else {
      tglMulai = row?.tgl_mulai || '';
      tglSelesai = row?.tgl_selesai || tglMulai;
      studentNama = row?.nama || '-';
      studentNisn = row?.nisn || '-';
      studentKelas = row?.kelas || '-';
      keterangan = row?.keterangan || '-';

      letterHtml = buildSingleHtml({
        nomorSurat,
        barcode,
        siswaNama: studentNama,
        siswaNisn: studentNisn,
        siswaKelas: studentKelas,
        tglMulai,
        tglSelesai,
        keterangan,
        pejabatNama: pejabat.nama,
        pejabatJabatan: pejabat.jabatan,
        pejabatNip: pejabat.nip,
        scanUrl,
        qrCodeUrl,
        letterType: letterType || 'MENINGGALKAN_ASRAMA',
        backgroundUrl,
        autoPrint: true,
      });
    }

    let resolvedJenisIzin = 'P';
    if (letterType === 'MENINGGALKAN_ASRAMA' || letterType === 'AKHIR_PEKAN' || isCollective) {
      resolvedJenisIzin = 'MENINGGALKAN_ASRAMA';
    } else if (letterType === 'REKOMENDASI_KONTROL') {
      resolvedJenisIzin = 'REKOMENDASI_KONTROL';
    } else if (letterType === 'REKAM_MEDIK') {
      resolvedJenisIzin = 'REKAM_MEDIK';
    } else if (letterType === 'REKAPAN_IZIN') {
      resolvedJenisIzin = 'REKAPAN_IZIN';
    } else if (letterType === 'REKAPAN_SAKIT') {
      resolvedJenisIzin = 'REKAPAN_SAKIT';
    } else if (row?.status === 'MADRASAH') {
      resolvedJenisIzin = 'M';
    } else {
      resolvedJenisIzin = 'P';
    }

    const created = await prisma.acca_letters.create({
      data: {
        nomor_surat: nomorSurat,
        nomor_urut: nextNumber,
        barcode,
        jenis_izin: resolvedJenisIzin,
        siswa_nama: studentNama,
        siswa_nisn: studentNisn,
        siswa_kelas: studentKelas,
        tgl_mulai: tglMulai,
        tgl_selesai: tglSelesai,
        keterangan,
        generated_by: petugasNama || null,
        penjabat_nama: pejabat.nama,
        penjabat_jabatan: pejabat.jabatan,
        is_printed: true,
        ketidakhadiran_id: row?.id || (isCollective && rows[0]?.id ? rows[0].id : null),
      },
      select: { id: true, nomor_surat: true, barcode: true, file_url: true },
    });

    return NextResponse.json({
      ok: true,
      data: {
        id: created.id,
        nomor_surat: created.nomor_surat,
        barcode: created.barcode,
        html: letterHtml,
        file_url: created.file_url || null,
        scanUrl,
        pejabat,
      },
    });
  } catch (error: any) {
    console.error('[generate-letter] Error:', error);
    return NextResponse.json(
      { ok: false, error: error.message || 'Gagal menghasilkan surat' },
      { status: 500 },
    );
  }
}
