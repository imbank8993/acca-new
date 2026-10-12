import { randomUUID } from 'node:crypto';
import { letterActor, mayManageLetter, LETTER_TYPES } from '@/lib/ketidakhadiran-security';
import { prisma } from '@/lib/prisma';
import { NextRequest, NextResponse } from 'next/server';
import QRCode from 'qrcode';
import { getPublicOrigin } from '@/lib/public-url';

export const dynamic = 'force-dynamic';

import {
  getMonthRoman,
  formatDateId,
  buildSingleHtml,
  buildCollectiveHtml,
} from '@/app/ketidakhadiran/utils/letter-html';
import { buildRekapPrintHtml } from '@/lib/print/rekam-medis-letter';
import { getRekapLetterData } from '@/app/ketidakhadiran/utils/rekap-letter-data';

class LetterRequestError extends Error {
  constructor(message: string, readonly status = 400) { super(message); }
}

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
    const actor = await letterActor(request);
    if (!actor) return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    const body = await request.json().catch(() => ({}));
    if (!LETTER_TYPES.includes(body.letterType)) return NextResponse.json({ ok: false, error: 'Jenis surat tidak valid' }, { status: 400 });
    if (!mayManageLetter(actor, body.letterType)) return NextResponse.json({ ok: false, error: 'Akses ditolak' }, { status: 403 });
    const cleanDate = (value: unknown) => {
      const text = String(value || '').split('T')[0]; const d = new Date(`${text}T00:00:00Z`);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(text) || !Number.isFinite(d.getTime()) || d.toISOString().slice(0,10) !== text) throw new LetterRequestError('Tanggal surat tidak valid');
      return text;
    };
    return await prisma.$transaction(async tx => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(424201)`;
    const authoritativeRow = async (input: any) => {
      const record = input?.id ? await tx.ketidakhadiran.findUnique({ where: { id: String(input.id) } }) : null;
      if (!record?.aktif) throw new LetterRequestError('Data ketidakhadiran tidak ditemukan');
      const asrama = ['MENINGGALKAN_ASRAMA', 'AKHIR_PEKAN'].includes(body.letterType);
      const asramaSakit = asrama && record.jenis === 'SAKIT' && ['Sedang', 'Berat', 'Kontrol'].includes(record.status);
      if (!asramaSakit && !mayManageLetter(actor, record.jenis)) throw new LetterRequestError('Tidak berhak atas data surat');
      if (asrama && record.jenis === 'SAKIT' && !asramaSakit) throw new LetterRequestError('Kategori sakit ini tidak memerlukan surat keluar asrama');
      if (['SAKIT', 'REKAM_MEDIK', 'REKOMENDASI_KONTROL', 'UKS'].includes(body.letterType) && record.jenis !== 'SAKIT') throw new LetterRequestError('Surat medis memerlukan data sakit');
      if (['SAKIT', 'REKOMENDASI_KONTROL'].includes(body.letterType) && !['Sedang', 'Berat', 'Kontrol'].includes(record.status)) throw new LetterRequestError('Kategori sakit ini tidak memerlukan rekomendasi keluar');
      return { ...record, ...(asramaSakit ? { keterangan: 'Keperluan kesehatan' } : {}), tgl_mulai: record.tgl_mulai.toISOString().slice(0,10), tgl_selesai: record.tgl_selesai.toISOString().slice(0,10) };
    };
    if (body.rows) {
      if (!Array.isArray(body.rows) || !body.rows.length || body.rows.length > 500) throw new LetterRequestError('Jumlah siswa tidak valid');
      body.rows = await Promise.all(body.rows.map(authoritativeRow));
    } else if (!['REKAPAN_IZIN', 'REKAPAN_SAKIT'].includes(body.letterType)) body.row = await authoritativeRow(body.row);
    if (['REKAPAN_IZIN', 'REKAPAN_SAKIT'].includes(body.letterType) && (!Number.isInteger(Number(body.month)) || Number(body.month) < 1 || Number(body.month) > 12 || !Number.isInteger(Number(body.year)) || Number(body.year) < 2000 || Number(body.year) > 2100)) throw new LetterRequestError('Periode rekap tidak valid');
    body.petugasNama = actor.nama;
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

      if (forceReprint) {
        if (!oldLetterId) throw new LetterRequestError('ID surat lama wajib untuk cetak ulang');
        const old = await tx.acca_letters.findUnique({ where: { id: String(oldLetterId) } });
        if (!old || !mayManageLetter(actor, old.jenis_izin, old.nomor_surat)) throw new LetterRequestError('Tidak berhak mencetak ulang surat ini');
        const targetNisn = rows?.length ? rows.map((r: any) => r.nisn).join(',') : row?.nisn;
        const compatibleTypes = letterType === 'SAKIT' ? ['REKOMENDASI_KONTROL', 'P'] : letterType === 'AKHIR_PEKAN' ? ['AKHIR_PEKAN','MENINGGALKAN_ASRAMA'] : [letterType];
        if (!compatibleTypes.includes(old.jenis_izin)) throw new LetterRequestError('Jenis surat lama berbeda');
        if (targetNisn && old.siswa_nisn !== targetNisn) throw new LetterRequestError('Penerima surat lama berbeda');
        if (letterType.startsWith('REKAPAN_') && !old.keterangan?.includes(`Rekap ${String(month).padStart(2,'0')}/${year}`)) throw new LetterRequestError('Periode surat lama berbeda');
        await tx.acca_letters.delete({ where: { id: old.id } });
        await tx.system_config.deleteMany({ where: { key: `acca-snapshot-${old.id}` } });
      }

      const isCollective = Array.isArray(rows) && rows.length > 0;
      if (row) { cleanDate(row.tgl_mulai); cleanDate(row.tgl_selesai); }
      if (rows?.length && rows.some((r: any) => r.tgl_mulai !== rows[0].tgl_mulai || r.tgl_selesai !== rows[0].tgl_selesai)) throw new LetterRequestError('Periode surat kolektif harus sama');
      const isRekap = letterType === 'REKAPAN_IZIN' || letterType === 'REKAPAN_SAKIT';

      // Duplicate checks
      if (!forceReprint) {
        if (isRekap) {
          const monthNum = parseInt(String(month), 10) || new Date().getMonth() + 1;
          const yearNum = parseInt(String(year), 10) || new Date().getFullYear();
          const rekapTag = `Rekap ${String(monthNum).padStart(2, '0')}/${yearNum}`;
          const existing = await tx.acca_letters.findFirst({
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
              ? ['MENINGGALKAN_ASRAMA', 'AKHIR_PEKAN']
              : (letterType === 'REKOMENDASI_KONTROL' || letterType === 'SAKIT')
                ? ['REKOMENDASI_KONTROL']
                : (letterType === 'REKAM_MEDIK')
                  ? ['REKAM_MEDIK']
                  : [letterType];

          if (isCollective) {
            const nisns = rows.map((r: any) => String(r.nisn || '').trim()).filter(Boolean);
            const firstRow = rows[0];
            const startStr = String(firstRow?.tgl_mulai || '').split('T')[0];
            const endStr = String(firstRow?.tgl_selesai || startStr).split('T')[0];
            const allNisnsJoined = nisns.join(',');

            const existing = await tx.acca_letters.findFirst({
              where: {
                siswa_nisn: allNisnsJoined,
                tgl_mulai: { startsWith: startStr },
                tgl_selesai: { startsWith: endStr },
                jenis_izin: { in: targetJenisList },
              },
              orderBy: { generated_at: 'desc' },
            });
            if (existing) {
              return NextResponse.json({ ok: false, alreadyPrinted: true, data: existing });
            }
          } else if (row) {
            const startStr = String(row.tgl_mulai || '').split('T')[0];
            const endStr = String(row.tgl_selesai || startStr).split('T')[0];
            const existing = await tx.acca_letters.findFirst({
              where: {
                siswa_nisn: String(row.nisn || '').trim(),
                tgl_mulai: { startsWith: startStr },
                tgl_selesai: { startsWith: endStr },
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
        const lastLetter = await tx.acca_letters.findFirst({
          where: {
            nomor_surat: { contains: '/UKS/' },
            AND: { nomor_surat: { contains: `/${currentYear}` } },
          },
          orderBy: { nomor_urut: 'desc' },
          select: { nomor_urut: true },
        });
        nextNumber = (lastLetter?.nomor_urut || 0) + 1;
      } else {
        const seq = await tx.acca_letter_sequence.findUnique({
          where: { tahun: currentYear },
        });
        if (seq) {
          nextNumber = (seq.last_number || 0) + 1;
        }
        await tx.acca_letter_sequence.upsert({
          where: { tahun: currentYear },
          update: { last_number: nextNumber },
          create: { tahun: currentYear, last_number: nextNumber },
        });
      }

      const nomorSurat = isUks
        ? `${String(nextNumber).padStart(3, '0')}/UKS/${monthRoman}/${currentYear}`
        : `${String(nextNumber).padStart(3, '0')}/IZIN/${jenisSub}/${monthRoman}/${currentYear}`;

      const barcode = 'ACCA-' + randomUUID();
      const scanBase = getPublicOrigin(request.headers.get('x-forwarded-host') || request.headers.get('host'));
      const scanUrl = `${scanBase}/ketidakhadiran/verify/${barcode}`;

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
        const jenisRekap = letterType === 'REKAPAN_IZIN' ? 'IZIN' : 'SAKIT';
        const { rekamRows, penandatangan } = await getRekapLetterData(
          jenisRekap,
          monthNum,
          yearNum,
          petugasNama || pejabat.nama,
        );
        if (!qrCodeUrl) throw new Error('QR Code verifikasi rekap gagal dibuat.');
        pejabat.nama = penandatangan.join(', ') || '-';
        pejabat.jabatan = jenisRekap === 'SAKIT' ? 'Petugas UKS' : 'Petugas Izin';
        tglMulai = `${yearNum}-${String(monthNum).padStart(2, '0')}-01`;
        tglSelesai = `${yearNum}-${String(monthNum).padStart(2, '0')}-${String(new Date(yearNum, monthNum, 0).getDate()).padStart(2, '0')}`;
        studentNama = `Rekapitulasi ${letterType === 'REKAPAN_IZIN' ? 'Izin' : 'Sakit'}`;
        studentNisn = 'REKAP';
        studentKelas = '-';
        keterangan = `Rekap ${String(monthNum).padStart(2, '0')}/${yearNum} (${monthName} ${yearNum})`;

        letterHtml = buildRekapPrintHtml({
          jenis: jenisRekap,
          nomorSurat,
          monthName,
          year: yearNum,
          penandatangan,
          rekamRows,
          qrCodeUrl,
          backgroundUrl,
          appBase: scanBase,
        });
      } else if (isCollective) {
        const firstRow = rows[0] || {};
        tglMulai = String(firstRow.tgl_mulai || '').split('T')[0];
        tglSelesai = String(firstRow.tgl_selesai || tglMulai).split('T')[0];
        studentNama = `${rows.length} Siswa (Kolektif)`;
        studentNisn = rows.map((r: any) => r.nisn).filter(Boolean).join(',');
        studentKelas = Array.from(new Set(rows.map((r: any) => r.kelas).filter(Boolean))).join(', ');

        const ketList = rows.map((r: any) => String(r.keterangan || '').trim());
        const sharedKet = ketList.length > 0 && ketList.every((item: string) => item === ketList[0]) &&
          ketList[0] !== '' && ketList[0] !== '-'
          ? ketList[0]
          : '';
        keterangan = sharedKet || 'Izin meninggalkan asrama (kolektif)';

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
        tglMulai = String(row?.tgl_mulai || '').split('T')[0];
        tglSelesai = String(row?.tgl_selesai || tglMulai).split('T')[0];
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
          status: row?.status,
          backgroundUrl,
          autoPrint: true,
        });
      }

      let resolvedJenisIzin = 'P';
      if (letterType === 'MENINGGALKAN_ASRAMA' || letterType === 'AKHIR_PEKAN' || isCollective) {
        resolvedJenisIzin = 'MENINGGALKAN_ASRAMA';
      } else if (letterType === 'REKOMENDASI_KONTROL') {
        resolvedJenisIzin = 'REKOMENDASI_KONTROL';
      } else if (letterType === 'SAKIT' || letterType === 'UKS') {
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

      const created = await tx.acca_letters.create({
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

      await tx.system_config.create({ data: { key: `acca-snapshot-${created.id}`, value: letterHtml, description: 'Arsip HTML surat ACCA', updated_by: actor.id } });
      await tx.audit_logs.create({ data: { user_id: actor.id, user_nip: actor.nip, user_name: actor.nama.slice(0,100), user_role: actor.roles.join(',').slice(0,100), action: forceReprint ? 'REPRINT' : 'CREATE_LETTER', entity: 'acca_letters', entity_id: created.id } });
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
      }, { timeout: 30000, maxWait: 10000 });
  } catch (error: any) {
    console.error('[generate-letter] Error:', error);
    return NextResponse.json(
      { ok: false, error: error instanceof LetterRequestError ? error.message : 'Gagal menghasilkan surat; coba kembali.' },
      { status: error instanceof LetterRequestError ? error.status : 500 },
    );
  }
}
