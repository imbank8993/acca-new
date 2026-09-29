import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import QRCode from 'qrcode';
import {
  buildSingleHtml,
  buildCollectiveHtml,
} from '@/app/ketidakhadiran/utils/letter-html';
import { buildRekapPrintHtml } from '@/lib/print/rekam-medis-letter';
import { getRekapLetterData } from '@/app/ketidakhadiran/utils/rekap-letter-data';

export const dynamic = 'force-dynamic';

import { getTemplateBackgroundUrl } from '@/lib/surat-config';

export async function GET(request: NextRequest) {
  try {
    const barcode = request.nextUrl.searchParams.get('barcode');
    const autoPrint = request.nextUrl.searchParams.get('print') === '1' || request.nextUrl.searchParams.get('print') === 'true';

    if (!barcode) {
      return new NextResponse('Barcode is required', { status: 400 });
    }

    const letter = await prisma.acca_letters.findFirst({
      where: { barcode },
    });

    if (!letter) {
      return new NextResponse('Dokumen tidak ditemukan', { status: 404 });
    }

    // 1. Jika ada file fisik (arsip lawas / storage eksternal), proxy file tersebut
    if (letter.file_url) {
      try {
        const response = await fetch(letter.file_url);
        if (response.ok) {
          const buffer = await response.arrayBuffer();
          let contentType = 'application/pdf';
          const lower = letter.file_url.toLowerCase();
          if (lower.endsWith('.html') || lower.endsWith('.htm')) {
            contentType = 'text/html';
          }
          return new NextResponse(buffer, {
            headers: {
              'Content-Type': contentType,
              'Content-Disposition': 'inline',
            },
          });
        }
      } catch (err) {
        console.warn('[pdf-preview] Gagal fetch file_url, beralih ke dynamic render:', err);
      }
    }

    // 2. Render dokumen HTML on-the-fly secara dinamis
    const origin = request.nextUrl.origin || 'https://acca.icgowa.sch.id';
    const scanUrl = `${origin}/ketidakhadiran/verify/${letter.barcode}`;
    const backgroundUrl = await getTemplateBackgroundUrl(letter.jenis_izin);

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
      console.error('[pdf-preview] QR Code generation error:', qrErr);
    }

    let html = '';
    const isRekap = letter.jenis_izin === 'REKAPAN_IZIN' || letter.jenis_izin === 'REKAPAN_SAKIT';
    const isCollective = (letter.siswa_nama || '').toLowerCase().includes('kolektif');

    if (isRekap) {
      const parts = (letter.keterangan || '').match(/Rekap\s+(\d{1,2})\/(\d{4})/i);
      const monthNum = parts ? parseInt(parts[1], 10) : new Date().getMonth() + 1;
      const yearNum = parts ? parseInt(parts[2], 10) : new Date().getFullYear();
      const monthNames = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
      const monthName = monthNames[monthNum - 1] || 'Bulan';

      const jenis = letter.jenis_izin === 'REKAPAN_IZIN' ? 'IZIN' : 'SAKIT';
      const { rekamRows, penandatangan } = await getRekapLetterData(
        jenis,
        monthNum,
        yearNum,
        letter.penjabat_nama || '',
      );
      if (!qrCodeUrl) throw new Error('QR Code verifikasi rekap gagal dibuat.');

      html = buildRekapPrintHtml({
        jenis,
        nomorSurat: letter.nomor_surat,
        monthName,
        year: yearNum,
        penandatangan,
        rekamRows,
        qrCodeUrl,
        backgroundUrl,
        appBase: origin,
      });
    } else if (isCollective) {
      // Ambil data siswa kolektif dari ketidakhadiran / siswa_kelas jika memungkinkan
      let rows: any[] = [];
      if (letter.siswa_nisn && letter.siswa_nisn.includes(',')) {
        const nisns = letter.siswa_nisn.split(',').map((s: string) => s.trim()).filter(Boolean);
        try {
          const [relatedK, relatedS] = await Promise.all([
            letter.tgl_mulai
              ? prisma.ketidakhadiran.findMany({
                  where: {
                    nisn: { in: nisns },
                    tgl_mulai: new Date(letter.tgl_mulai),
                    aktif: true,
                  },
                  select: { nama: true, nisn: true, kelas: true, keterangan: true },
                })
              : Promise.resolve([]),
            prisma.siswa_kelas.findMany({
              where: { nisn: { in: nisns }, aktif: true },
              select: { nama_siswa: true, nisn: true, kelas: true },
            }),
          ]);

          rows = nisns.map((n) => {
            const fromK = relatedK.find((r) => r.nisn === n);
            if (fromK) return fromK;
            const fromS = relatedS.find((r) => r.nisn === n);
            if (fromS) return { nama: fromS.nama_siswa, nisn: fromS.nisn, kelas: fromS.kelas };
            return { nama: '-', nisn: n, kelas: '-' };
          });
        } catch {}
      }

      if (rows.length === 0 && letter.tgl_mulai && letter.keterangan) {
        const related = await prisma.ketidakhadiran.findMany({
          where: {
            tgl_mulai: new Date(letter.tgl_mulai),
            keterangan: letter.keterangan,
            aktif: true,
          },
          select: { nama: true, nisn: true, kelas: true, keterangan: true },
        });
        if (related.length > 0) rows = related;
      }

      if (rows.length === 0) {
        rows = [{
          nama: letter.siswa_nama,
          nisn: letter.siswa_nisn,
          kelas: letter.siswa_kelas,
        }];
      }

      html = buildCollectiveHtml({
        nomorSurat: letter.nomor_surat,
        barcode: letter.barcode,
        rows,
        tglMulai: letter.tgl_mulai || '',
        tglSelesai: letter.tgl_selesai || '',
        keterangan: letter.keterangan || '-',
        pejabatNama: letter.penjabat_nama || 'Imran, S.Si.',
        pejabatJabatan: letter.penjabat_jabatan || 'WKM Keasramaan',
        pejabatNip: '-',
        scanUrl,
        qrCodeUrl,
        backgroundUrl,
        autoPrint,
      });
    } else {
      const linkedAbsence = letter.ketidakhadiran_id
        ? await prisma.ketidakhadiran.findUnique({
            where: { id: letter.ketidakhadiran_id },
            select: { status: true },
          })
        : null;
      html = buildSingleHtml({
        nomorSurat: letter.nomor_surat,
        barcode: letter.barcode,
        siswaNama: letter.siswa_nama || '-',
        siswaNisn: letter.siswa_nisn || '-',
        siswaKelas: letter.siswa_kelas || '-',
        tglMulai: letter.tgl_mulai || '',
        tglSelesai: letter.tgl_selesai || '',
        keterangan: letter.keterangan || '-',
        pejabatNama: letter.penjabat_nama || 'Imran, S.Si.',
        pejabatJabatan: letter.penjabat_jabatan || 'Petugas',
        pejabatNip: '-',
        scanUrl,
        qrCodeUrl,
        letterType: letter.jenis_izin,
        status: linkedAbsence?.status || undefined,
        backgroundUrl,
        autoPrint,
      });
    }

    return new NextResponse(html, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Content-Disposition': 'inline',
        'Cache-Control': 'public, max-age=60, s-maxage=300',
      },
    });
  } catch (e: any) {
    console.error('[pdf-preview] Error:', e);
    return new NextResponse(e.message || 'Error proxying file', { status: 500 });
  }
}
