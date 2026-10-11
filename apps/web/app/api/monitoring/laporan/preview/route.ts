import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import QRCode from 'qrcode';
import { renderKopHTML, KOP_CSS } from '@/lib/lckh/print-shared';
import { getPublicOrigin } from '@/lib/public-url';
import { buildKlinikReport } from '@/lib/klinik/laporan-report';
import { corsResponse, handleOptions } from '@/lib/cors';
import { optimizeImageUrls } from '@/lib/image-optimizer';

export const dynamic = 'force-dynamic';

const BULAN = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];

function esc(v: unknown): string {
    if (v === null || v === undefined) return '';
    return String(v)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function sanitizeMediaUrl(url: unknown): string {
    if (!url || typeof url !== 'string') return '';
    const trimmed = url.trim();
    if (trimmed.startsWith('https://') || trimmed.startsWith('http://') || trimmed.startsWith('/')) {
        if (trimmed.includes('169.254.169.254') || trimmed.includes('metadata.google.internal')) {
            return '';
        }
        return esc(trimmed);
    }
    if (trimmed.startsWith('data:image/')) {
        return trimmed;
    }
    return '';
}

function fmtDate(d?: string | Date | null): string {
    if (!d) return '-';
    try {
        const dateObj = typeof d === 'string' ? new Date(d) : d;
        return dateObj.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
    } catch {
        return '-';
    }
}

async function generateQrDataUrl(data: string): Promise<string> {
    try {
        return await QRCode.toDataURL(data, { errorCorrectionLevel: 'M', margin: 1, width: 160 });
    } catch {
        return '';
    }
}

async function buildGuruAsuhHtml(submissionId: string, origin: string): Promise<string> {
    const submission = await prisma.laporan_guru_asuh_submissions.findUnique({
        where: { id: submissionId },
    });
    if (!submission) throw new Error('Dokumen pengajuan guru asuh tidak ditemukan.');

    const entries = await prisma.laporan_guru_asuh.findMany({
        where: { submission_id: submission.id },
        include: { guru_asuh: true },
        orderBy: { tanggal: 'asc' },
    });

    const [guru, profil, approverUser] = await Promise.all([
        submission.nip
            ? prisma.master_guru.findUnique({
                where: { nip: submission.nip },
                select: { nip: true, nama_lengkap: true },
            })
            : null,
        prisma.profil_sekolah.findFirst(),
        submission.approved_by
            ? prisma.public_users.findFirst({
                where: { auth_id: submission.approved_by },
                select: { nip: true, nama: true, nama_lengkap: true },
            })
            : null,
    ]);

    const guruName = submission.nama_guru_snap || guru?.nama_lengkap || '-';
    const approverName = submission.approved_by_name || approverUser?.nama_lengkap || approverUser?.nama || 'WKM Keasramaan';
    const approverNip = approverUser?.nip || '-';

    // Group entries
    const mergedByKey = new Map<string, { tanggal: string; kegiatan: string; siswaList: { nama: string; kelas: string }[] }>();
    for (const e of entries) {
        const siswaObj = { nama: e.guru_asuh?.nama_siswa || '-', kelas: e.guru_asuh?.kelas || '-' };
        const key = `${e.tanggal.toISOString().split('T')[0]}|${e.kegiatan}|${e.hasil || ''}`;
        const existing = mergedByKey.get(key);
        if (existing) existing.siswaList.push(siswaObj);
        else mergedByKey.set(key, { tanggal: e.tanggal.toISOString().split('T')[0], kegiatan: e.kegiatan, siswaList: [siswaObj] });
    }
    const mergedRows = Array.from(mergedByKey.values());
    for (const r of mergedRows) {
        r.siswaList.sort((a, b) => a.nama.localeCompare(b.nama, 'id-ID'));
    }

    const rowsHtml = mergedRows.map((r, i: number) => {
        return r.siswaList.map((s, sIdx) => {
            if (sIdx === 0) {
                return `
            <tr>
              <td class="c-no" rowspan="${r.siswaList.length}">${i + 1}</td>
              <td class="c-tgl" rowspan="${r.siswaList.length}">${fmtDate(r.tanggal)}</td>
              <td class="c-siswa">${esc(s.nama)}</td>
              <td class="c-kelas">${esc(s.kelas)}</td>
              <td rowspan="${r.siswaList.length}">${esc(r.kegiatan)}</td>
            </tr>`;
            }
            return `
            <tr>
              <td class="c-siswa">${esc(s.nama)}</td>
              <td class="c-kelas">${esc(s.kelas)}</td>
            </tr>`;
        }).join('');
    }).join('');

    const fotoEntries = Array.from(
        new Map(entries.filter(e => e.foto_url).map(e => [e.foto_url, e])).values()
    );
    const validFotoEntries = fotoEntries.filter(e => sanitizeMediaUrl(e.foto_url));
    const rawGuruUrls = validFotoEntries.map(e => e.foto_url).filter((u): u is string => Boolean(u));
    const optimizedGuruMap = await optimizeImageUrls(rawGuruUrls);

    const lampiranHtml = validFotoEntries.length === 0 ? '' : `
    <div class="lampiran-page">
      <div class="doc-title"><h1>LAMPIRAN FOTO DOKUMENTASI KEGIATAN</h1></div>
      <div class="foto-grid">
        ${validFotoEntries.map((e, i: number) => {
          const imgSrc = (e.foto_url && optimizedGuruMap.get(e.foto_url)) || sanitizeMediaUrl(e.foto_url);
          return `
          <div class="foto-item" id="foto-${i + 1}">
            <img src="${imgSrc}" alt="Dokumentasi ${esc(e.kegiatan)}" />
            <div class="foto-caption">
              <div class="foto-kegiatan">${i + 1}. ${esc(e.kegiatan)}</div>
              <div class="foto-tgl">Tanggal: ${fmtDate(e.tanggal)}</div>
            </div>
          </div>`;
        }).join('')}
      </div>
    </div>`;

    const isApproved = submission.status === 'Approved';
    const baseOrigin = getPublicOrigin(origin);
    const scanUrl = `${baseOrigin}/guru-asuh/verify/${submission.id}`;
    const qrDataUrl = await generateQrDataUrl(scanUrl);

    return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8"/>
<title>Laporan Guru Asuh - ${esc(guruName)}</title>
<style>
  @page { size: A4 portrait; margin: 10mm 15mm 15mm 20mm; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Times New Roman', serif; font-size: 10.5pt; color: #000; width: 794px; margin: 0 auto; background: #fff; }
  .page { padding: 10mm 15mm 15mm 20mm; width: 100%; }
  @media print { 
      body { width: 100%; margin: 0; zoom: 1 !important; }
      .page { padding: 0; } 
  }
  @media screen and (max-width: 820px) {
      body { zoom: calc(100vw / 820); }
  }
  ${KOP_CSS}
  .kop { position: relative; display: block; }
  .kop-logo { position: absolute; left: 0; top: 0; margin: 0; }
  .kop-text { width: 100%; }
  .doc-title { text-align: center; margin: 14px 0 4px; }
  .doc-title h1 { font-size: 12.5pt; text-decoration: underline; text-underline-offset: 4px; letter-spacing: 1px; }
  .doc-sub { text-align: center; font-size: 10pt; margin-bottom: 14px; }
  .meta-table { width: 100%; margin-bottom: 12px; font-size: 10pt; }
  .meta-table td { padding: 1px 0; vertical-align: middle; }
  .meta-table td:first-child { width: 120px; }
  .meta-table td:nth-child(2) { width: 14px; }
  .status-text { display: inline-flex; align-items: center; gap: 4px; color: #16a34a; font-size: 10pt; font-weight: bold; line-height: 1; vertical-align: middle; }
  table.entries { width: 100%; border-collapse: collapse; font-size: 9pt; margin-bottom: 16px; }
  table.entries th, table.entries td { border: 1px solid #333; padding: 5px 6px; text-align: left; vertical-align: top; }
  table.entries th { background: #f1f5f9; font-weight: normal; text-align: center; }
  .c-no { text-align: center; width: 5%; }
  .c-tgl { width: 14%; white-space: nowrap; }
  .c-siswa { width: 26%; font-size: 8pt; }
  .c-kelas { width: 10%; text-align: center; font-size: 8pt; white-space: nowrap; }
  .approval-footer { display: flex; justify-content: space-between; align-items: center; margin-top: 20px; page-break-inside: avoid; }
  .ttd-table { font-size: 10pt; border-collapse: collapse; margin-top: 0; }
  .ttd-table td { padding: 4px 0; vertical-align: top; }
  .ttd-table td:first-child { width: 120px; font-weight: normal; }
  .ttd-table td:nth-child(2) { width: 14px; }
  .ttd-nip { font-size: 8.5pt; color: #555; }
  .verify-wrap { display: flex; flex-direction: column; align-items: center; text-align: center; margin-top: 0; margin-left: 20px; gap: 2px; flex-shrink: 0; }
  .verify-qr { width: 64px; height: 64px; display: block; }
  .verify-label { font-size: 7pt; color: #555; text-align: center; }
  .verify-id { font-family: 'Courier New', monospace; font-size: 6.5pt; color: #777; letter-spacing: 0.5px; text-align: center; }
  .lampiran-page { page-break-before: always; padding: 20mm 15mm 20mm 20mm; }
  @media print { .lampiran-page { padding: 0; } }
  .foto-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-top: 12px; align-items: start; }
  .foto-item { border: 1px solid #ccc; border-radius: 4px; overflow: hidden; page-break-inside: avoid; background: #fff; }
  .foto-item img { width: 100%; height: auto; max-height: 80mm; object-fit: contain; display: block; background: #f8fafc; }
  .foto-caption { padding: 6px 8px; }
  .foto-kegiatan { font-size: 9pt; font-weight: bold; margin-bottom: 2px; }
  .foto-tgl { font-size: 8pt; color: #555; }
</style>
</head>
<body>
  <div class="page">
    ${renderKopHTML(profil)}
    <div class="doc-title"><h1>LAPORAN BULANAN GURU ASUH</h1></div>
    <div class="doc-sub">Periode : <strong>${BULAN[submission.bulan - 1] || '-'} ${submission.tahun}</strong></div>

    <table class="meta-table">
      <tr><td>Nama Guru</td><td>:</td><td>${esc(guruName)}</td></tr>
      <tr><td>NIP</td><td>:</td><td>${esc(submission.nip)}</td></tr>
      <tr><td>Jumlah Kegiatan</td><td>:</td><td>${mergedRows.length} kegiatan</td></tr>
      <tr><td>Status Dokumen</td><td>:</td><td><span class="status-text">${isApproved ? 'Disahkan Resmi' : 'Menunggu Pengesahan'}</span></td></tr>
    </table>

    <table class="entries">
      <thead>
        <tr><th class="c-no">No</th><th class="c-tgl">Tanggal</th><th class="c-siswa">Siswa Asuh</th><th class="c-kelas">Kelas</th><th>Kegiatan Pembinaan</th></tr>
      </thead>
      <tbody>
        ${rowsHtml || '<tr><td colspan="5" style="text-align:center;padding:10px;">Tidak ada data kegiatan</td></tr>'}
      </tbody>
    </table>

    <div class="approval-footer">
      <table class="ttd-table">
        <tbody>
          <tr><td>Diajukan pada</td><td>:</td><td>${fmtDate(submission.submitted_at)}</td></tr>
          <tr><td>Diajukan Oleh</td><td>:</td><td>${esc(guruName)}${submission.nip ? `<br/><span class="ttd-nip">NIP. ${esc(submission.nip)}</span>` : ''}</td></tr>
          <tr><td>Disahkan Oleh</td><td>:</td><td>${esc(approverName)}${approverNip && approverNip !== '-' ? `<br/><span class="ttd-nip">NIP. ${esc(approverNip)}</span>` : ''}</td></tr>
        </tbody>
      </table>

      <div class="verify-wrap">
        <img class="verify-qr" src="${qrDataUrl}" alt="QR Verifikasi"/>
        <div class="verify-label">Pindai untuk verifikasi dokumen</div>
        <div class="verify-id">${esc(submission.id)}</div>
      </div>
    </div>
  </div>
  ${lampiranHtml}
</body>
</html>`;
}

async function buildEkskulHtml(submissionId: string, origin: string): Promise<string> {
    const submission = await prisma.laporan_ekskul_submissions.findUnique({
        where: { id: submissionId },
        include: { ekskul: true },
    });
    if (!submission) throw new Error('Dokumen pengajuan ekskul tidak ditemukan.');

    const entries = await prisma.ekskul_pertemuan.findMany({
        where: { submission_id: submission.id },
        include: { ekskul_absensi: true },
        orderBy: { tanggal: 'asc' },
    });

    const [guru, profil, approverUser] = await Promise.all([
        submission.pembina_nip
            ? prisma.master_guru.findUnique({
                where: { nip: submission.pembina_nip },
                select: { nip: true, nama_lengkap: true },
            })
            : null,
        prisma.profil_sekolah.findFirst(),
        submission.approved_by
            ? prisma.public_users.findFirst({
                where: { auth_id: submission.approved_by },
                select: { nip: true, nama: true, nama_lengkap: true },
            })
            : null,
    ]);

    const guruName = submission.pembina_nama || guru?.nama_lengkap || '-';
    const approverName = submission.approved_by_name || approverUser?.nama_lengkap || approverUser?.nama || 'WKM Kesiswaan';
    const approverNip = approverUser?.nip || '-';

    const absensiMap: Record<string, { hadir: number; total: number }> = {};
    for (const e of entries) {
        const absList = e.ekskul_absensi || [];
        absensiMap[e.id] = {
            total: absList.length,
            hadir: absList.filter((a: any) => a.status === 'H' || a.status === 'Hadir').length,
        };
    }

    const rowsHtml = entries.map((e, i: number) => {
        const abs = absensiMap[e.id] || { hadir: 0, total: 0 };
        return `
        <tr>
          <td class="c-no">${i + 1}</td>
          <td class="c-tgl">${fmtDate(e.tanggal)}</td>
          <td>${esc(e.materi || '-')}</td>
          <td class="c-kelas">${esc(e.status_pelatih || 'Internal')}</td>
          <td class="c-kelas">${abs.total > 0 ? `${abs.hadir} / ${abs.total} Siswa` : '-'}</td>
        </tr>`;
    }).join('');

    const fotoItems: { url: string; materi?: string | null; tanggal: Date }[] = [];
    for (const e of entries) {
        if (Array.isArray(e.dokumentasi)) {
            for (const url of e.dokumentasi) {
                if (url && typeof url === 'string' && url.trim()) {
                    fotoItems.push({ url: url.trim(), materi: e.materi, tanggal: e.tanggal });
                }
            }
        }
    }
    const rawEkskulUrls = fotoItems.map(item => item.url);
    const optimizedEkskulMap = await optimizeImageUrls(rawEkskulUrls);

    const lampiranHtml = fotoItems.length === 0 ? '' : `
    <div class="lampiran-page">
      <div class="doc-title"><h1>LAMPIRAN FOTO DOKUMENTASI KEGIATAN</h1></div>
      <div class="foto-grid">
        ${fotoItems.map((item, i: number) => {
          const imgSrc = optimizedEkskulMap.get(item.url) || esc(item.url);
          return `
          <div class="foto-item" id="foto-${i + 1}">
            <img src="${imgSrc}" alt="Dokumentasi ${esc(item.materi)}" />
            <div class="foto-caption">
              <div class="foto-kegiatan">${i + 1}. ${esc(item.materi || 'Pertemuan ' + (i+1))}</div>
              <div class="foto-tgl">${fmtDate(item.tanggal)}</div>
            </div>
          </div>`;
        }).join('')}
      </div>
    </div>`;

    const isApproved = submission.status === 'Disahkan';
    const baseOrigin = getPublicOrigin(origin);
    const scanUrl = `${baseOrigin}/ekstrakurikuler?tab=approval&id=${submission.id}`;
    const qrDataUrl = await generateQrDataUrl(scanUrl);

    return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8"/>
<title>Laporan Ekstrakurikuler - ${esc(submission.ekskul?.nama_ekskul)}</title>
<style>
  @page { size: A4 portrait; margin: 10mm 15mm 15mm 20mm; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Times New Roman', serif; font-size: 10.5pt; color: #000; width: 794px; margin: 0 auto; background: #fff; }
  .page { padding: 10mm 15mm 15mm 20mm; width: 100%; }
  @media print { 
      body { width: 100%; margin: 0; zoom: 1 !important; }
      .page { padding: 0; } 
  }
  @media screen and (max-width: 820px) {
      body { zoom: calc(100vw / 820); }
  }
  ${KOP_CSS}
  .kop { position: relative; display: block; }
  .kop-logo { position: absolute; left: 0; top: 0; margin: 0; }
  .kop-text { width: 100%; }
  .doc-title { text-align: center; margin: 14px 0 4px; }
  .doc-title h1 { font-size: 12.5pt; text-decoration: underline; text-underline-offset: 4px; letter-spacing: 1px; }
  .doc-sub { text-align: center; font-size: 10pt; margin-bottom: 14px; }
  .meta-table { width: 100%; margin-bottom: 12px; font-size: 10pt; }
  .meta-table td { padding: 1px 0; vertical-align: middle; }
  .meta-table td:first-child { width: 140px; }
  .meta-table td:nth-child(2) { width: 14px; }
  .status-text { display: inline-flex; align-items: center; gap: 4px; color: #16a34a; font-size: 10pt; font-weight: bold; line-height: 1; vertical-align: middle; }
  table.entries { width: 100%; border-collapse: collapse; font-size: 9pt; margin-bottom: 16px; }
  table.entries th, table.entries td { border: 1px solid #333; padding: 5px 6px; text-align: left; vertical-align: top; }
  table.entries th { background: #f1f5f9; font-weight: normal; text-align: center; }
  .c-no { text-align: center; width: 5%; }
  .c-tgl { width: 18%; white-space: nowrap; }
  .c-kelas { width: 15%; text-align: center; font-size: 9pt; white-space: nowrap; }
  .approval-footer { display: flex; justify-content: space-between; align-items: center; margin-top: 20px; page-break-inside: avoid; }
  .ttd-table { font-size: 10pt; border-collapse: collapse; margin-top: 0; }
  .ttd-table td { padding: 4px 0; vertical-align: top; }
  .ttd-table td:first-child { width: 120px; font-weight: normal; }
  .ttd-table td:nth-child(2) { width: 14px; }
  .ttd-nip { font-size: 8.5pt; color: #555; }
  .verify-wrap { display: flex; flex-direction: column; align-items: center; text-align: center; margin-top: 0; margin-left: 20px; gap: 2px; flex-shrink: 0; }
  .verify-qr { width: 64px; height: 64px; display: block; }
  .verify-label { font-size: 7pt; color: #555; text-align: center; }
  .verify-id { font-family: 'Courier New', monospace; font-size: 6.5pt; color: #777; letter-spacing: 0.5px; text-align: center; }
  .lampiran-page { page-break-before: always; padding: 20mm 15mm 20mm 20mm; }
  @media print { .lampiran-page { padding: 0; } }
  .foto-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-top: 12px; }
  .foto-item { border: 1px solid #ccc; border-radius: 4px; overflow: hidden; page-break-inside: avoid; }
  .foto-item img { width: 100%; height: 55mm; object-fit: cover; display: block; background: #f1f5f9; }
  .foto-caption { padding: 6px 8px; }
  .foto-kegiatan { font-size: 9pt; font-weight: bold; margin-bottom: 2px; }
  .foto-tgl { font-size: 8pt; color: #555; }
</style>
</head>
<body>
  <div class="page">
    ${renderKopHTML(profil)}
    <div class="doc-title"><h1>LAPORAN BULANAN EKSTRAKURIKULER</h1></div>
    <div class="doc-sub">Periode : <strong>${BULAN[submission.bulan - 1] || '-'} ${submission.tahun}</strong></div>

    <table class="meta-table">
      <tr><td>Ekstrakurikuler</td><td>:</td><td><strong>${esc(submission.ekskul?.nama_ekskul)}</strong></td></tr>
      <tr><td>Nama Pembina / Pelatih</td><td>:</td><td>${esc(guruName)}</td></tr>
      <tr><td>NIP</td><td>:</td><td>${esc(submission.pembina_nip)}</td></tr>
      <tr><td>Jumlah Pertemuan</td><td>:</td><td>${entries.length} kali</td></tr>
      <tr><td>Status Dokumen</td><td>:</td><td><span class="status-text">${isApproved ? 'Disahkan Resmi' : 'Menunggu Pengesahan'}</span></td></tr>
    </table>

    <table class="entries">
      <thead>
        <tr><th class="c-no">No</th><th class="c-tgl">Tanggal</th><th>Materi / Topik Kegiatan</th><th class="c-kelas">Status Pelatih</th><th class="c-kelas">Kehadiran</th></tr>
      </thead>
      <tbody>
        ${rowsHtml || '<tr><td colspan="5" style="text-align:center;padding:10px;">Tidak ada data kegiatan</td></tr>'}
      </tbody>
    </table>

    <div class="approval-footer">
      <table class="ttd-table">
        <tbody>
          <tr><td>Diajukan pada</td><td>:</td><td>${fmtDate(submission.submitted_at)}</td></tr>
          <tr><td>Diajukan Oleh</td><td>:</td><td>${esc(guruName)}${submission.pembina_nip ? `<br/><span class="ttd-nip">NIP. ${esc(submission.pembina_nip)}</span>` : ''}</td></tr>
          <tr><td>Disahkan Oleh</td><td>:</td><td>${esc(approverName)}${approverNip && approverNip !== '-' ? `<br/><span class="ttd-nip">NIP. ${esc(approverNip)}</span>` : ''}</td></tr>
        </tbody>
      </table>

      <div class="verify-wrap">
        <img class="verify-qr" src="${qrDataUrl}" alt="QR Verifikasi"/>
        <div class="verify-label">Pindai untuk verifikasi dokumen</div>
        <div class="verify-id">${esc(submission.id)}</div>
      </div>
    </div>
  </div>
  ${lampiranHtml}
</body>
</html>`;
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { type, id } = body;

        if (!type || !id) {
            return corsResponse(
                NextResponse.json({ ok: false, error: 'type dan id wajib diisi' }, { status: 400 })
            );
        }

        const origin = getPublicOrigin(request.headers.get('x-forwarded-host') || request.headers.get('host'));

        let html = '';
        if (type === 'GURU_ASUH') {
            html = await buildGuruAsuhHtml(id, origin);
        } else if (type === 'KLINIK') {
            const result = await buildKlinikReport({ slotId: id, origin });
            if (!result.ok) throw new Error(result.error);
            html = result.html;
        } else if (type === 'EKSKUL') {
            html = await buildEkskulHtml(id, origin);
        } else {
            return corsResponse(
                NextResponse.json({ ok: false, error: 'Tipe modul tidak valid' }, { status: 400 })
            );
        }

        return corsResponse(NextResponse.json({ ok: true, html }), { publicRead: true });
    } catch (error: any) {
        console.error('[monitoring/laporan/preview POST] error:', error);
        return corsResponse(
            NextResponse.json({ ok: false, error: error.message || 'Gagal memuat pratinjau dokumen' }, { status: 500 }),
            { publicRead: true }
        );
    }
}

export async function OPTIONS() {
    return handleOptions();
}
