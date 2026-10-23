import { renderKopHTML, CENTERED_KOP_CSS, kotaKedudukan, type ProfilSekolah } from '@/lib/lckh/print-shared';

export interface IncidentIzinItem {
  id?: string;
  jenis: 'izin' | 'sakit' | 'dinas_luar' | string;
  status: 'disetujui' | 'pending' | 'ditolak' | string;
  keterangan?: string | null;
  instansi_tujuan?: string | null;
  tanggal_mulai?: string;
  tanggal_selesai?: string;
}

export interface KinerjaIncidentDetail {
  type: string;
  tanggal: string;
  kelas: string;
  program?: string;
  mapel: string;
  jam_ke: string;
  waktu: string;
  keterangan: string;
  hari?: string;
  izin?: IncidentIzinItem | null;
}

export interface KinerjaGuruTopItem {
  rank?: number;
  nip: string;
  nama: string;
  count: number;
  total_jp: number;
  details: KinerjaIncidentDetail[];
}

export interface RekapKinerjaReportInput {
  top10: KinerjaGuruTopItem[];
  kategoriLabel: string;
  kategoriKey: string;
  periodeLabel: string;
  profil?: ProfilSekolah | null;
  pembuatNama?: string;
  pembuatNip?: string;
  allTeachersCount?: number;
  /** true = hitungan kejadian (mis. versi guru piket), meski kategorinya Terlambat. */
  satuanKejadian?: boolean;
}

function esc(v: unknown): string {
  if (v === null || v === undefined) return '';
  return String(v)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function fmtTanggalIndo(dateStr: string): string {
  if (!dateStr || dateStr === '-') return '-';
  try {
    const d = new Date(dateStr.includes('T') ? dateStr : `${dateStr}T12:00:00`);
    if (Number.isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

const JENIS_LABEL: Record<string, string> = {
  izin: 'Izin',
  sakit: 'Sakit',
  dinas_luar: 'Dinas Luar',
};

export function generateRekapKinerjaHtml(input: RekapKinerjaReportInput): string {
  const {
    top10 = [],
    kategoriLabel,
    kategoriKey,
    periodeLabel,
    profil,
    pembuatNama = 'Koordinator Kurikulum / Tim Penjaminan Mutu',
    pembuatNip = '',
    allTeachersCount = 0,
  } = input;

  const kota = kotaKedudukan(profil) || 'Makassar';
  // Identitas penandatangan diambil dari Pengaturan Umum › Profil Sekolah.
  const kepalaNama = (profil?.kepala_sekolah_nama || '').trim();
  const kepalaNip = (profil?.kepala_sekolah_nip || '').trim();
  const tglCetak = new Date().toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const isMenitCategory = !input.satuanKejadian && (kategoriKey === 'terlambat' || kategoriKey === 'keluarSebelumWaktu');
  const unitLabel = isMenitCategory ? 'Menit' : 'kali';

  // Helper filter details matching category
  const getFilteredDetails = (details: KinerjaIncidentDetail[] = []) => {
    return details.filter((d) => {
      const type = (d.type || '').trim().toLowerCase();
      if (kategoriKey === 'jamKosong') return type === 'jam kosong';
      if (kategoriKey === 'penugasanTanpa') return type === 'tanpa pendampingan';
      if (kategoriKey === 'penugasanDengan') return type === 'dengan pendampingan';
      if (kategoriKey === 'digabung') return type === 'digabung';
      if (kategoriKey === 'terlambat') return type === 'terlambat';
      if (kategoriKey === 'mengambilIstirahat') return type === 'mengambil waktu istirahat';
      if (kategoriKey === 'keluarSebelumWaktu') return type === 'keluar sebelum waktunya';
      if (kategoriKey === 'daring') return type === 'daring';
      if (kategoriKey === 'piket') return type === 'tidak piket';
      return false;
    });
  };

  // ── Render Tabel Ringkasan Top 10 ──────────────────────────────────────────
  const ringkasanRowsHtml = top10.length === 0
    ? `<tr><td colspan="5" class="text-center empty-cell">Tidak ada data catatan kinerja pada kategori dan periode ini.</td></tr>`
    : top10.map((guru, idx) => {
      const rank = guru.rank || (idx + 1);
      const filtered = getFilteredDetails(guru.details);
      const berizinCount = filtered.filter((d) => d.izin?.status === 'disetujui').length;
      const berizinText = berizinCount > 0
        ? `<span class="badge-berizin">${berizinCount} Berizin</span>`
        : '<span class="text-muted">-</span>';

      return `
        <tr>
          <td class="text-center font-bold rank-cell">#${rank}</td>
          <td>
            <div class="font-bold text-dark">${esc(guru.nama)}</div>
            <div class="sub-text">NIP: ${esc(guru.nip || '-')}</div>
          </td>
          <td class="text-center font-bold total-cell">${guru.count} ${unitLabel}</td>
          <td class="text-center font-semibold">${guru.total_jp > 0 ? `${guru.total_jp} JP` : '-'}</td>
          <td class="text-center">${berizinText}</td>
        </tr>
      `;
    }).join('');

  // ── Render Rincian Detail per Guru ─────────────────────────────────────────
  const detailSectionsHtml = top10.length === 0
    ? ''
    : top10.map((guru, idx) => {
      const rank = guru.rank || (idx + 1);
      const filtered = getFilteredDetails(guru.details);

      const itemsHtml = filtered.length === 0
        ? `<tr><td colspan="7" class="text-center empty-cell">Tidak ada rincian baris insiden.</td></tr>`
        : filtered.map((det, dIdx) => {
          let izinHtml = '<span class="text-muted">-</span>';
          if (det.izin) {
            const jClass = det.izin.jenis === 'sakit' ? 'badge-sakit' : det.izin.jenis === 'dinas_luar' ? 'badge-dinas' : 'badge-izin';
            const jText = JENIS_LABEL[det.izin.jenis] || det.izin.jenis;
            const sText = det.izin.status === 'disetujui' ? 'Disetujui' : det.izin.status === 'ditolak' ? 'Ditolak' : 'Menunggu';
            izinHtml = `
              <div>
                <span class="${jClass}">${esc(jText)}</span>
                <span class="sub-status">(${esc(sText)})</span>
              </div>
              ${det.izin.keterangan ? `<div class="sub-izin-ket">${esc(det.izin.keterangan)}</div>` : ''}
              ${det.izin.instansi_tujuan ? `<div class="sub-izin-inst">${esc(det.izin.instansi_tujuan)}</div>` : ''}
            `;
          }

          return `
            <tr>
              <td class="text-center">${dIdx + 1}</td>
              <td class="nowrap">
                <strong>${fmtTanggalIndo(det.tanggal)}</strong>
                ${det.hari ? `<div class="sub-text">${esc(det.hari)}</div>` : ''}
              </td>
              <td>${esc(det.mapel || '-')}</td>
              <td>${esc(det.kelas || '-')}</td>
              <td class="text-center">
                <div class="font-semibold">${esc(det.jam_ke || '-')}</div>
                ${det.waktu ? `<div class="sub-text">${esc(det.waktu)}</div>` : ''}
              </td>
              <td>${izinHtml}</td>
              <td>${esc(det.keterangan || '-')}</td>
            </tr>
          `;
        }).join('');

      return `
        <div class="guru-detail-card">
          <div class="guru-detail-header">
            <div class="guru-header-title">
              <span class="rank-badge">Peringkat #${rank}</span>
              <span class="guru-nama-title">${esc(guru.nama)}</span>
              <span class="guru-nip-title">(NIP: ${esc(guru.nip || '-')})</span>
            </div>
            <div class="guru-header-stat">
              ${isMenitCategory ? 'Total Durasi' : 'Total Insiden'}: <strong>${guru.count} ${unitLabel}</strong> ${guru.total_jp > 0 ? `(${guru.total_jp} JP)` : ''}
            </div>
          </div>
          <table class="report-table detail-table">
            <thead>
              <tr>
                <th style="width: 4%;">No</th>
                <th style="width: 16%;">Tanggal & Hari</th>
                <th style="width: 18%;">Mata Pelajaran</th>
                <th style="width: 14%;">Kelas</th>
                <th style="width: 12%;">Jam / Waktu</th>
                <th style="width: 18%;">Izin / Sakit</th>
                <th style="width: 18%;">Keterangan</th>
              </tr>
            </thead>
            <tbody>
              ${itemsHtml}
            </tbody>
          </table>
        </div>
      `;
    }).join('');

  return `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="utf-8"/>
  <title>Rekapitulasi 10 Besar Kinerja Guru - ${esc(kategoriLabel)}</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 10mm 15mm 15mm 20mm;
    }
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      font-family: 'Times New Roman', Times, serif;
      font-size: 10pt;
      color: #111;
      line-height: 1.35;
      background: #fff;
    }

    ${CENTERED_KOP_CSS}

    .doc-header {
      text-align: center;
      margin: 14px 0 16px;
    }
    .doc-title {
      font-size: 13pt;
      font-weight: bold;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 3px;
    }
    .doc-subtitle {
      font-size: 11pt;
      font-weight: bold;
      color: #222;
    }
    .doc-period {
      font-size: 10pt;
      color: #444;
      margin-top: 2px;
    }

    .meta-box {
      border: 1px solid #999;
      background: #fafafa;
      padding: 8px 12px;
      margin-bottom: 16px;
      font-size: 9pt;
      display: flex;
      justify-content: space-between;
      gap: 12px;
    }
    .meta-col {
      flex: 1;
    }
    .meta-item {
      margin-bottom: 3px;
    }
    .meta-item strong {
      display: inline-block;
      width: 140px;
    }

    .section-title {
      font-size: 11pt;
      font-weight: bold;
      margin: 18px 0 8px;
      text-transform: uppercase;
      border-bottom: 1.5px solid #333;
      padding-bottom: 3px;
    }

    .report-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 9pt;
      margin-bottom: 16px;
    }
    .report-table th, .report-table td {
      border: 1px solid #444;
      padding: 5px 6px;
      vertical-align: top;
    }
    .report-table th {
      background: #e2e8f0;
      font-weight: bold;
      text-align: center;
      font-size: 9pt;
    }
    .report-table tr {
      page-break-inside: avoid;
    }

    .rank-cell {
      background: #f8fafc;
      font-size: 9.5pt;
    }
    .total-cell {
      background: #eff6ff;
      color: #1d4ed8;
      font-size: 9.5pt;
    }
    .sub-text {
      font-size: 8pt;
      color: #555;
      font-weight: normal;
    }
    .sub-status {
      font-size: 7.5pt;
      color: #555;
      margin-left: 3px;
    }
    .sub-izin-ket {
      font-size: 7.5pt;
      color: #333;
      margin-top: 2px;
      font-style: italic;
    }
    .sub-izin-inst {
      font-size: 7.5pt;
      color: #6b21a8;
      margin-top: 1px;
    }

    .badge-berizin {
      display: inline-block;
      background: #dcfce7;
      color: #15803d;
      padding: 2px 7px;
      border-radius: 3px;
      font-size: 7.5pt;
      font-weight: bold;
    }

    .badge-izin {
      display: inline-block;
      background: #dbeafe;
      color: #1e40af;
      padding: 1px 5px;
      border-radius: 3px;
      font-size: 7.5pt;
      font-weight: bold;
      text-transform: uppercase;
    }
    .badge-sakit {
      display: inline-block;
      background: #ffedd5;
      color: #c2410c;
      padding: 1px 5px;
      border-radius: 3px;
      font-size: 7.5pt;
      font-weight: bold;
      text-transform: uppercase;
    }
    .badge-dinas {
      display: inline-block;
      background: #f3e8ff;
      color: #6b21a8;
      padding: 1px 5px;
      border-radius: 3px;
      font-size: 7.5pt;
      font-weight: bold;
      text-transform: uppercase;
    }

    .guru-detail-card {
      margin-bottom: 18px;
      page-break-inside: avoid;
      break-inside: avoid;
      border: 1px solid #cbd5e1;
      border-radius: 4px;
      overflow: hidden;
    }
    .guru-detail-header {
      background: #f1f5f9;
      padding: 7px 10px;
      border-bottom: 1px solid #cbd5e1;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .rank-badge {
      background: #1e3a8a;
      color: #fff;
      padding: 2px 7px;
      border-radius: 3px;
      font-size: 8pt;
      font-weight: bold;
      margin-right: 6px;
    }
    .guru-nama-title {
      font-weight: bold;
      font-size: 9.5pt;
    }
    .guru-nip-title {
      font-size: 8.5pt;
      color: #555;
      margin-left: 4px;
    }
    .guru-header-stat {
      font-size: 9pt;
      color: #1e3a8a;
    }
    .detail-table {
      margin-bottom: 0;
      border: none;
    }
    .detail-table th {
      background: #f8fafc;
      font-size: 8.5pt;
    }
    .detail-table td {
      font-size: 8.5pt;
      padding: 4px 6px;
    }

    .sign-section {
      margin-top: 28px;
      display: flex;
      justify-content: space-between;
      page-break-inside: avoid;
      break-inside: avoid;
    }
    .sign-col {
      width: 44%;
      text-align: center;
    }
    .sign-role {
      font-weight: 500;
      margin-bottom: 55px;
    }
    .sign-name {
      font-weight: bold;
      text-decoration: underline;
      text-underline-offset: 3px;
    }
    .sign-nip {
      font-size: 8.5pt;
      color: #333;
      margin-top: 2px;
    }

    .text-center { text-align: center; }
    .text-right { text-align: right; }
    .font-bold { font-weight: bold; }
    .font-semibold { font-weight: 600; }
    .text-muted { color: #888; }
    .nowrap { white-space: nowrap; }
    .empty-cell { padding: 14px; font-style: italic; color: #64748b; }

    @media print {
      body {
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
    }
  </style>
</head>
<body>

  <!-- ── KOP SURAT RESMI ── -->
  ${renderKopHTML(profil)}

  <!-- ── JUDUL DOKUMEN ── -->
  <div class="doc-header">
    <div class="doc-title">REKAPITULASI 10 BESAR KINERJA GURU</div>
    <div class="doc-subtitle">Kategori: ${esc(kategoriLabel)}</div>
    <div class="doc-period">Periode: ${esc(periodeLabel)}</div>
  </div>

  <!-- ── INFORMASI METADATA LAPORAN ── -->
  <div class="meta-box">
    <div class="meta-col">
      <div class="meta-item"><strong>Kategori Evaluasi</strong>: ${esc(kategoriLabel)}</div>
      <div class="meta-item"><strong>Periode Penilaian</strong>: ${esc(periodeLabel)}</div>
    </div>
    <div class="meta-col">
      <div class="meta-item"><strong>Total Guru Bertugas</strong>: ${allTeachersCount} Guru</div>
      <div class="meta-item"><strong>Waktu Cetak</strong>: ${esc(tglCetak)}</div>
    </div>
  </div>

  <!-- ── BAGIAN I: TABEL RINGKASAN 10 BESAR ── -->
  ${kategoriKey === 'piket' ? '<p class="sub-text">Kategori Tidak Piket dihitung dari jam tugas yang belum memiliki laporan kelas. Satu guru pada tanggal dan JP yang sama dihitung sekali meskipun mencakup beberapa kelas. Izin/sakit ditampilkan sebagai keterangan.</p>' : ''}
  <div class="section-title">I. Ringkasan Peringkat 10 Besar</div>
  <table class="report-table">
    <thead>
      <tr>
        <th style="width: 8%;">Peringkat</th>
        <th style="width: 44%;">Nama Guru / Pegawai</th>
        <th style="width: 18%;">Jumlah (${unitLabel})</th>
        <th style="width: 14%;">Total JP</th>
        <th style="width: 16%;">Izin / Sakit</th>
      </tr>
    </thead>
    <tbody>
      ${ringkasanRowsHtml}
    </tbody>
  </table>

  <!-- ── BAGIAN II: RINCIAN DETAIL INSIDEN PER GURU ── -->
  ${top10.length > 0 ? `
    <div class="section-title">II. Rincian Detail Insiden: ${esc(kategoriLabel)} (10 Besar)</div>
    ${detailSectionsHtml}
  ` : ''}

  <!-- ── BAGIAN III: PENGESAHAN & TANDA TANGAN ── -->
  <div class="sign-section">
    <div class="sign-col">
      <div style="font-size: 8.5pt; color: #555; margin-bottom: 2px;">&nbsp;</div>
      <div class="sign-role">Mengetahui,<br/>Kepala Madrasah</div>
      <div class="sign-name">${kepalaNama ? esc(kepalaNama) : '.......................................'}</div>
      <div class="sign-nip">NIP. ${esc(kepalaNip || '-')}</div>
    </div>

    <div class="sign-col">
      <div style="font-size: 8.5pt; color: #333; margin-bottom: 2px;">${esc(kota)}, ${esc(tglCetak)}</div>
      <div class="sign-role">Yang Membuat Rekapan,</div>
      <div class="sign-name">${esc(pembuatNama)}</div>
      <div class="sign-nip">${pembuatNip ? `NIP. ${esc(pembuatNip)}` : '-'}</div>
    </div>
  </div>

</body>
</html>
`;
}
