import QRCode from 'qrcode';
import { prisma } from '@/lib/prisma';
import { renderKopHTML, KOP_CSS } from '@/lib/lckh/print-shared';
import { can, type CapabilityHolder } from '@/lib/capabilities';

export function esc(v: unknown): string {
    if (v === null || v === undefined) return '';
    return String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function fmtDate(d?: string | Date | null): string {
    if (!d) return '-';
    try {
        const dateObj = typeof d === 'string'
            ? new Date(d.includes('T') ? d : `${d}T12:00:00`)
            : d;
        return dateObj.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
    } catch {
        return '-';
    }
}

function fmtJam(v?: string | null): string {
    if (!v) return '-';
    const s = String(v).trim();
    if (s.includes('T')) return (s.split('T')[1] || '').slice(0, 5);
    return s.slice(0, 5);
}

async function generateQrDataUrl(data: string): Promise<string> {
    try {
        return await QRCode.toDataURL(data, { errorCorrectionLevel: 'M', margin: 1, width: 160 });
    } catch {
        return '';
    }
}

export interface KlinikReportInput {
    slotId: string;
    origin: string;
}

export type KlinikReportResult =
    | { ok: true; html: string; slot: any }
    | { ok: false; error: string; status: number };

export function isReviewerKlinik(user: CapabilityHolder): boolean {
    return can(user, 'klinik.rekap');
}

export async function bolehAksesLaporanKlinik(
    user: CapabilityHolder & { authId: string; nip: string },
    slotId: string
): Promise<{ ok: true } | { ok: false; error: string; status: number }> {
    if (!slotId) return { ok: false, error: 'slotId wajib diisi', status: 400 };
    if (isReviewerKlinik(user)) return { ok: true };

    const slot = await prisma.klinik_slots.findUnique({
        where: { id: slotId },
        select: {
            guru_id: true,
            klinik_peserta: { select: { siswa_id: true } }
        }
    });
    if (!slot) return { ok: false, error: 'Jadwal Klinik tidak ditemukan.', status: 404 };

    const byAuthId = await (prisma as any).public_users.findFirst({
        where: { auth_id: user.authId },
        select: { id: true }
    });
    let userId: number | null = byAuthId?.id ? Number(byAuthId.id) : null;
    if (!userId && user.nip) {
        const byNip = await (prisma as any).public_users.findFirst({
            where: { nip: user.nip },
            select: { id: true }
        });
        userId = byNip?.id ? Number(byNip.id) : null;
    }
    if (!userId) return { ok: false, error: 'User tidak ditemukan', status: 403 };

    const ikutSesi = (slot.klinik_peserta || []).some((p: any) => Number(p.siswa_id) === userId);
    if (Number(slot.guru_id) === userId || ikutSesi) return { ok: true };

    return { ok: false, error: 'Anda tidak memiliki akses ke laporan sesi ini', status: 403 };
}

export async function buildKlinikReport(input: KlinikReportInput): Promise<KlinikReportResult> {
    const { slotId, origin } = input;

    const slot = await (prisma as any).klinik_slots.findUnique({
        where: { id: slotId },
        include: {
            klinik_peserta: true,
            klinik_laporan: true,
            users: { select: { nama: true, nama_lengkap: true } }
        }
    });

    if (!slot) {
        return { ok: false, error: 'Jadwal Klinik tidak ditemukan.', status: 404 };
    }

    const profil = await prisma.profil_sekolah.findFirst();

    const guruName = slot.nama_guru || slot.users?.nama_lengkap || slot.users?.nama || '-';
    let guruNip = '-';
    if (slot.guru_id) {
        const guruData = await (prisma as any).public_users.findUnique({
            where: { id: Number(slot.guru_id) },
            select: { nip: true }
        });
        if (guruData?.nip) guruNip = guruData.nip;
    }
    
    const laporan: any = slot.klinik_laporan?.[0] || slot.klinik_laporan || {};
    const peserta = slot.klinik_peserta || [];
    const fotos = (laporan.foto_bukti as string[]) || [];

    let approverNip = '-';
    if (laporan.status === 'Approved' && laporan.approved_by) {
        const approverRow = await (prisma as any).public_users.findUnique({
            where: { id: Number(laporan.approved_by) },
            select: { nip: true }
        });
        approverNip = approverRow?.nip || '-';
    }

    peserta.sort((a: any, b: any) => (a.nama_siswa || '').localeCompare(b.nama_siswa || '', 'id-ID'));
    const jumlahHadir = peserta.filter((p: any) => p.kehadiran === 'H').length;

    const rowsHtml = peserta.length > 0 ? peserta.map((p: any, i: number) => {
        const hadir = `<td class="c-hadir">${esc(p.kehadiran || '-')}</td>`;
        if (i === 0) {
            return `
        <tr>
          <td class="c-no">${i + 1}</td>
          <td class="c-siswa">${esc(p.nama_siswa)}</td>
          <td class="c-kelas">${esc(p.kelas)}</td>
          ${hadir}
          <td rowspan="${peserta.length}" class="c-materi">${esc(laporan.materi_disampaikan || '-')}</td>
        </tr>`;
        }
        return `
        <tr>
          <td class="c-no">${i + 1}</td>
          <td class="c-siswa">${esc(p.nama_siswa)}</td>
          <td class="c-kelas">${esc(p.kelas)}</td>
          ${hadir}
        </tr>`;
    }).join('') : `<tr><td colspan="5" style="text-align:center;padding:10px;">Tidak ada data peserta</td></tr>`;

    const lampiranHtml = fotos.length === 0 ? '' : `
    <div class="lampiran-page">
      <div class="doc-title"><h1>LAMPIRAN FOTO DOKUMENTASI KLINIK</h1></div>
      <div class="foto-grid">
        ${fotos.map((url: string, i: number) => `
          <div class="foto-item" id="foto-${i + 1}">
            <img src="${esc(url)}" alt="Dokumentasi" />
            <div class="foto-caption">
              <div class="foto-kegiatan">Foto ${i + 1}</div>
            </div>
          </div>`).join('')}
      </div>
    </div>`;

    const isApproved = laporan.status === 'Approved';
    const isSubmitted = laporan.status === 'Submitted' || laporan.status === 'Approved';
    const scanUrl = (isApproved && laporan.id) ? `${origin}/klinik-approval/verify/${laporan.id}` : '';
    const qrDataUrl = scanUrl ? await generateQrDataUrl(scanUrl) : '';

    const statusInfo = isApproved
        ? { label: 'Disahkan', iconHtml: '<svg width="15" height="15" viewBox="0 0 16 16" fill="#2563eb" style="display:inline-block; vertical-align:middle; margin-right:4px; flex-shrink:0;"><path d="M10.067.87a2.89 2.89 0 0 0-4.134 0l-.622.638-.89-.011a2.89 2.89 0 0 0-2.924 2.924l.01.89-.636.622a2.89 2.89 0 0 0 0 4.134l.637.622-.011.89a2.89 2.89 0 0 0 2.924 2.924l.89-.01.622.636a2.89 2.89 0 0 0 4.134 0l.622-.637.89.011a2.89 2.89 0 0 0 2.924-2.924l-.01-.89.636-.622a2.89 2.89 0 0 0 0-4.134l-.637-.622.011-.89a2.89 2.89 0 0 0-2.924-2.924l-.89.01zm.287 5.984-3 3a.5.5 0 0 1-.708 0l-1.5-1.5a.5.5 0 1 1 .708-.708L7 8.793l2.646-2.647a.5.5 0 0 1 .708.708"/></svg>' }
        : isSubmitted
            ? { label: 'Menunggu Pengesahan', iconHtml: '' }
            : { label: 'Draft', iconHtml: '' };

    const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8"/>
<title>Laporan Klinik Pembelajaran - ${esc(guruName)}</title>
<style>
  @page { size: A4 portrait; margin: 10mm 15mm 15mm 20mm; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Times New Roman', serif; font-size: 10.5pt; color: #000; }
  .page { padding: 10mm 15mm 15mm 20mm; }
  @media print { .page { padding: 0; } }
  ${KOP_CSS}
  .kop { position: relative; display: block; }
  .kop-logo { position: absolute; left: 0; top: 0; margin: 0; }
  .kop-text { width: 100%; }
  .doc-title { text-align: center; margin: 14px 0 14px; }
  .doc-title h1 { font-size: 12.5pt; text-decoration: underline; text-underline-offset: 4px; letter-spacing: 1px; }
  .meta-table { width: 100%; margin-bottom: 12px; font-size: 10pt; }
  .meta-table td { padding: 1px 0; vertical-align: middle; }
  .meta-table td:first-child { width: 120px; }
  .meta-table td:nth-child(2) { width: 14px; }
  .status-text { display: inline-flex; align-items: center; gap: 2px; color: #2563eb; font-size: 10pt; font-weight: normal; line-height: 1; vertical-align: middle; }
  table.entries { width: 100%; border-collapse: collapse; font-size: 9pt; margin-bottom: 16px; }
  table.entries th, table.entries td { border: 1px solid #333; padding: 5px 6px; text-align: left; vertical-align: top; }
  table.entries th { background: #f1f5f9; font-weight: bold; text-align: center; }
  .c-no { text-align: center; width: 5%; }
  .c-siswa { width: 32%; font-size: 9pt; }
  .c-kelas { width: 13%; text-align: center; font-size: 9pt; white-space: nowrap; }
  .c-hadir { width: 8%; text-align: center; font-size: 9pt; font-weight: bold; }
  .c-materi { width: 42%; }
  .approval-footer { display: flex; justify-content: space-between; align-items: center; margin-top: 20px; page-break-inside: avoid; }
  .ttd-table { font-size: 10pt; border-collapse: collapse; margin-top: 0; }
  .ttd-table td { padding: 4px 0; vertical-align: top; }
  .ttd-table td:first-child { width: 120px; font-weight: bold; }
  .ttd-table td:nth-child(2) { width: 14px; }
  .ttd-nip { font-size: 8.5pt; color: #555; }
  .verify-wrap { display: flex; flex-direction: column; align-items: center; text-align: center; margin-top: 0; margin-left: 20px; gap: 2px; flex-shrink: 0; }
  .verify-qr { width: 64px; height: 64px; display: block; }
  .verify-label { font-size: 7pt; color: #555; text-align: center; }
  .verify-id { font-family: 'Courier New', monospace; font-size: 6.5pt; color: #777; letter-spacing: 0.5px; text-align: center; }
  .pending-note { margin-top: 22px; padding: 10px 14px; border: 1px dashed #cbd5e1; border-radius: 6px; font-size: 9pt; color: #64748b; text-align: center; font-style: italic; }

  .lampiran-page { page-break-before: always; padding: 20mm 15mm 20mm 20mm; }
  @media print { .lampiran-page { padding: 0; } }
  .foto-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-top: 12px; }
  .foto-item { border: 1px solid #ccc; border-radius: 4px; overflow: hidden; page-break-inside: avoid; }
  .foto-item img { width: 100%; height: 55mm; object-fit: cover; display: block; background: #f1f5f9; }
  .foto-caption { padding: 6px 8px; }
  .foto-kegiatan { font-size: 9pt; font-weight: bold; margin-bottom: 2px; }
</style>
</head>
<body>
  <div class="page">
    ${renderKopHTML(profil)}
    <div class="doc-title"><h1>LAPORAN PELAKSANAAN KLINIK PEMBELAJARAN</h1></div>

    <table class="meta-table">
      <tr><td>Nama Guru</td><td>:</td><td>${esc(guruName)}</td></tr>
      <tr><td>NIP</td><td>:</td><td>${esc(guruNip)}</td></tr>
      <tr><td>Mata Pelajaran</td><td>:</td><td>${esc(slot.mapel)}</td></tr>
      <tr><td>Topik</td><td>:</td><td>${esc(slot.topik)}</td></tr>
      <tr><td>Tanggal Pelaksanaan</td><td>:</td><td>${fmtDate(slot.tanggal)}</td></tr>
      <tr><td>Waktu</td><td>:</td><td>${esc(fmtJam(slot.jam_mulai))} - ${esc(fmtJam(slot.jam_selesai))}</td></tr>
      <tr><td>Kehadiran</td><td>:</td><td>${jumlahHadir} dari ${peserta.length} peserta terdaftar</td></tr>
      <tr><td>Status</td><td>:</td><td><span class="status-text">${statusInfo.iconHtml}${statusInfo.label}</span></td></tr>
    </table>

    <table class="entries">
      <thead>
        <tr><th class="c-no">No</th><th class="c-siswa">Siswa Terdaftar</th><th class="c-kelas">Kelas</th><th class="c-hadir">Hadir</th><th>Ringkasan Materi</th></tr>
      </thead>
      <tbody>
        ${rowsHtml}
      </tbody>
    </table>

    ${isApproved ? `
    <div class="approval-footer">
      <table class="ttd-table">
        <tbody>
          <tr><td>Dilaksanakan pada</td><td>:</td><td>${fmtDate(slot.tanggal)}</td></tr>
          <tr><td>Diajukan Oleh</td><td>:</td><td>${esc(guruName)}${guruNip && guruNip !== '-' ? `<br/><span class="ttd-nip">NIP. ${esc(guruNip)}</span>` : ''}</td></tr>
          <tr><td>Disahkan Oleh</td><td>:</td><td>${esc(laporan.approved_by_name || '-')}${approverNip && approverNip !== '-' ? `<br/><span class="ttd-nip">NIP. ${esc(approverNip)}</span>` : ''}</td></tr>
        </tbody>
      </table>

      <div class="verify-wrap">
        <img class="verify-qr" src="${qrDataUrl}" alt="QR Verifikasi"/>
        <div class="verify-label">Pindai untuk verifikasi keaslian dokumen</div>
        <div class="verify-id">${esc(laporan.id)}</div>
      </div>
    </div>
    ` : `
    <div class="pending-note">
      Dokumen me-rekap ini belum disahkan. Tanda tangan Admin/WKM dan kode QR verifikasi
      hanya tersedia pada versi resmi setelah laporan disetujui.
    </div>
    `}
  </div>
  ${lampiranHtml}
</body>
</html>`;

    return { ok: true, html, slot };
}
