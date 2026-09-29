/**
 * lib/report-templates.ts
 * Template HTML untuk laporan yang akan dirender jadi gambar (via lib/report-image.ts)
 * lalu dikirim ke grup WA sebagai gambar.
 *
 * Semua styling inline/self-contained agar bisa dirender headless tanpa aset eksternal.
 */

/** Base64-encoded ACCA logo (same as /logo-sidebar-kecil.webp used in the collapsed sidebar). */
const ACCA_LOGO_B64 = 'data:image/webp;base64,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'

function escapeHtml(v: unknown): string {
    return String(v ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
}

type BadgeColor = { bg: string; fg: string }

const NEUTRAL_BADGE: BadgeColor = { bg: '#e2e8f0', fg: '#475569' }

/**
 * Warna badge status guru pada laporan piket.
 * Kategori mengikuti master_dropdown.kategori_kehadiran.
 */
function piketStatusColor(status: string): BadgeColor {
    const s = status.toLowerCase()

    // Penugasan: cek "tanpa" lebih dulu agar tidak tertangkap "dengan pendampingan".
    if (s.includes('pendampingan')) {
        return s.includes('tanpa')
            ? { bg: '#7f1d1d', fg: '#ffffff' }   // maroon pekat — paling perlu perhatian
            : { bg: '#dbeafe', fg: '#1d4ed8' }   // biru
    }
    if (s.includes('sesuai')) return { bg: '#dcfce7', fg: '#15803d' }               // hijau
    if (s.includes('kosong') || s.includes('alpa') || s.includes('tanpa keterangan'))
        return { bg: '#fee2e2', fg: '#b91c1c' }                                     // merah
    if (s.includes('terlambat')) return { bg: '#ffedd5', fg: '#c2410c' }            // oranye
    if (s.includes('keluar sebelum')) return { bg: '#ffe4e6', fg: '#be123c' }       // rose
    if (s.includes('istirahat')) return { bg: '#fef3c7', fg: '#b45309' }            // amber
    if (s.includes('tukaran') || s.includes('diganti')) return { bg: '#e0e7ff', fg: '#4338ca' } // indigo
    if (s.includes('digabung')) return { bg: '#ccfbf1', fg: '#0f766e' }             // teal
    if (s.includes('tim teaching')) return { bg: '#e0f2fe', fg: '#0369a1' }         // sky
    if (s.includes('daring')) return { bg: '#cffafe', fg: '#0e7490' }               // cyan
    if (s.includes('sakit') || s.includes('izin')) return { bg: '#fef3c7', fg: '#b45309' }
    return NEUTRAL_BADGE
}

/**
 * Warna badge status siswa pada laporan ketidakhadiran.
 * SAKIT → Ringan / Sedang / Berat / Kontrol, IZIN → Madrasah / Personal.
 * Palet mengikuti badge di halaman Log Ketidakhadiran.
 */
function ketidakhadiranStatusColor(status: string): BadgeColor {
    const s = status.toLowerCase()

    // Kategori SAKIT — gradasi keparahan.
    if (s.includes('ringan')) return { bg: '#fef3c7', fg: '#b45309' }   // amber
    if (s.includes('sedang')) return { bg: '#fee2e2', fg: '#dc2626' }   // merah
    if (s.includes('berat')) return { bg: '#991b1b', fg: '#ffffff' }    // maroon pekat
    if (s.includes('kontrol')) return { bg: '#e0e7ff', fg: '#4338ca' }  // indigo

    // Kategori IZIN.
    if (s.includes('madrasah')) return { bg: '#cffafe', fg: '#0e7490' } // cyan
    if (s.includes('personal')) return { bg: '#ede9fe', fg: '#6d28d9' } // violet

    // Fallback bila status masih berupa jenis mentah.
    if (s.includes('sakit')) return { bg: '#fee2e2', fg: '#b91c1c' }
    if (s.includes('izin')) return { bg: '#cffafe', fg: '#0e7490' }
    return NEUTRAL_BADGE
}

function statusBadges(statusText: string, colorOf: (s: string) => BadgeColor): string {
    return String(statusText || '-')
        .split(',')
        .map(s => s.trim())
        .filter(Boolean)
        .map(s => {
            const c = colorOf(s)
            return `<span style="display:inline-block;padding:2px 8px;margin:1px 2px;border-radius:999px;font-size:12px;font-weight:600;background:${c.bg};color:${c.fg}">${escapeHtml(s)}</span>`
        })
        .join('') || '<span style="color:#94a3b8">-</span>'
}

const SHELL_STYLE = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Inter', sans-serif; background: #ffffff; padding: 0; margin: 0; }
  #report { width: 100%; max-width: 1000px; background: #ffffff; border-radius: 0; overflow: hidden; margin: 0 auto; }
  .rp-head { padding: 24px 32px; color: #fff; display: flex; align-items: center; gap: 16px; }
  .rp-head-icon { width: 48px; height: 48px; display: flex; align-items: center; justify-content: center; background: rgba(255, 255, 255, 0.15); border: 1px solid rgba(255, 255, 255, 0.25); border-radius: 12px; backdrop-filter: blur(8px); flex-shrink: 0; }
  .rp-head-icon svg { width: 26px; height: 26px; color: #fff; }
  .rp-title { font-size: 22px; font-weight: 800; letter-spacing: -0.3px; margin: 0; color: #ffffff; }
  
  .rp-meta { display: flex; flex-wrap: nowrap; align-items: center; gap: 36px; padding: 18px 32px; background: #ffffff; border-bottom: 1px solid #e2e8f0; }
  .rp-meta-item { display: flex; align-items: center; gap: 10px; font-size: 14px; color: #1e293b; }
  .rp-meta-item svg { width: 18px; height: 18px; color: #2563eb; flex-shrink: 0; }
  .rp-meta-item b { font-weight: 700; color: #0f172a; white-space: nowrap; }
  
  table { width: 100%; border-collapse: separate; border-spacing: 0; }
  thead th { background: #f8fafc; color: #64748b; font-size: 12px; font-weight: 600; text-align: left; padding: 16px 20px; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 1px solid #e2e8f0; border-top: 1px solid #e2e8f0; }
  tbody td { padding: 16px 20px; font-size: 14px; color: #1e293b; border-bottom: 1px solid #f1f5f9; vertical-align: middle; }
  tbody tr:hover { background: #f8fafc; }
  
  .user-cell { display: flex; align-items: center; gap: 12px; }
  .user-avatar { width: 36px; height: 36px; border-radius: 50%; background: #e2e8f0; color: #475569; display: flex; align-items: center; justify-content: center; font-size: 14px; font-weight: 700; flex-shrink: 0; }
  .user-details { display: flex; flex-direction: column; }
  .user-name { font-weight: 600; color: #0f172a; margin-bottom: 2px; }
  .user-nisn { font-size: 12px; color: #94a3b8; }
  
  .rp-num { color: #94a3b8; font-weight: 600; width: 40px; text-align: center; }
  .rp-foot { padding: 18px 32px; background: #fff; border-top: 1px solid #f1f5f9; font-size: 13px; color: #64748b; display: flex; justify-content: space-between; align-items: center; }
  .rp-foot-brand { display: flex; align-items: center; gap: 6px; font-weight: 700; color: #1e3a8a; line-height: 1; }
  .rp-foot-brand img { height: 14px; width: auto; object-fit: contain; display: block; }
  .rp-note { padding: 16px 32px; background: #fffbeb; border-top: 1px solid #fde68a; font-size: 14px; color: #92400e; display: flex; gap: 8px; }
`

interface PiketRow {
    nama_kelas?: string
    nama_guru?: string
    status_kehadiran?: string
    guru_pengganti?: string
    guru_jadwal?: string
    dokumentasi_url?: string
    izin_sakit?: string
}

function izinBadge(text: string): string {
    const t = (text || '-').trim();
    if (t === '-' || !t) return '<span style="color:#94a3b8">-</span>';
    const lower = t.toLowerCase();
    let bg = '#f1f5f9';
    let fg = '#64748b';
    if (lower === 'sakit') {
        bg = '#fee2e2'; fg = '#b91c1c';
    } else if (lower === 'izin') {
        bg = '#fef3c7'; fg = '#b45309';
    } else if (lower.includes('dinas')) {
        bg = '#e0e7ff'; fg = '#4338ca';
    } else if (lower === 'pending') {
        bg = '#ffedd5'; fg = '#c2410c';
    } else if (lower === 'tidak ada') {
        bg = '#f1f5f9'; fg = '#64748b';
    }
    return `<span style="display:inline-block;padding:2px 8px;margin:1px 2px;border-radius:999px;font-size:12px;font-weight:600;background:${bg};color:${fg}">${escapeHtml(t)}</span>`;
}

export function piketReportHtml(
    data: { tanggal?: string; hari?: string; jam_ke?: string; nama_guru_piket?: string; waktu?: string; keterangan?: string; nama_sekolah?: string },
    rows: PiketRow[]
): string {
    const bodyRows = rows.map((r, i) => {
        const hasPengganti = r.guru_pengganti && r.guru_jadwal && r.guru_pengganti !== r.guru_jadwal;
        return `<tr>
      <td class="rp-num">${i + 1}</td>
      <td style="font-weight:600;color:#0f172a">${escapeHtml(r.nama_kelas || '-')}</td>
      <td style="font-weight:500;color:#475569">${escapeHtml(r.nama_guru || '-')}</td>
      <td style="font-weight:500;color:${hasPengganti ? '#b45309' : '#94a3b8'}">${hasPengganti ? escapeHtml(r.guru_pengganti!) : '-'}</td>
      <td>${statusBadges(r.status_kehadiran || '-', piketStatusColor)}</td>
      <td>${izinBadge(r.izin_sakit || '-')}</td>
    </tr>`
    }).join('')

    const note = data.keterangan && data.keterangan.trim()
        ? `<div class="rp-note">📝 Catatan: ${escapeHtml(data.keterangan)}</div>`
        : ''

    return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>${SHELL_STYLE}</style></head><body>
    <div id="report">
      <div class="rp-head" style="background: linear-gradient(135deg, #2563eb 0%, #1e40af 100%);">
        <div class="rp-head-icon">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path><rect x="8" y="2" width="8" height="4" rx="1" ry="1"></rect><path d="M9 14h6"></path><path d="M9 10h6"></path><path d="M9 18h6"></path></svg>
        </div>
        <div>
            <div class="rp-title">Laporan Piket Harian</div>
        </div>
      </div>
      <div class="rp-meta">
        <div class="rp-meta-item">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
          <b>${escapeHtml(data.hari || '')}${data.hari ? ', ' : ''}${escapeHtml(data.tanggal || '')}</b>
        </div>
        <div class="rp-meta-item">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
          <b>${escapeHtml(data.nama_guru_piket || '-')}</b>
        </div>
        <div class="rp-meta-item">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
          <b>Jam ke-${escapeHtml(data.jam_ke || '-')}</b>
        </div>
      </div>
      <table style="margin-top: -1px;">
        <thead><tr><th>No</th><th>Kelas</th><th>Guru Utama</th><th>Pengganti</th><th>Status</th><th>Izin/Sakit</th></tr></thead>
        <tbody>${bodyRows || '<tr><td colspan="6" style="text-align:center;color:#94a3b8;padding:40px">Tidak ada data</td></tr>'}</tbody>
      </table>
      ${note}
      <div class="rp-foot">
        <span style="font-weight:600;color:#64748b">Total: ${escapeHtml(String(rows.length))} kelas</span>
        <div class="rp-foot-brand">
            <img src="${ACCA_LOGO_B64}" alt="ACCA" height="14" style="height:14px;width:auto;object-fit:contain;display:block" />
            <span>acca.icgowa.sch.id</span>
        </div>
      </div>
    </div>
  </body></html>`
}

interface KetidakhadiranRow {
    no?: string
    nama?: string
    nisn?: string
    kelas?: string
    status?: string
    waktu?: string
    keterangan?: string
}

export function ketidakhadiranReportHtml(
    data: { tanggal?: string; petugas_nama?: string; jenis?: string; total?: string; nama_sekolah?: string; bagian?: string },
    rows: KetidakhadiranRow[]
): string {
    const bodyRows = rows.map((r, i) => {
        return `<tr>
      <td class="rp-num">${escapeHtml(r.no || String(i + 1))}</td>
      <td style="font-weight:600;color:#0f172a">${escapeHtml(r.nama || '-')}</td>
      <td style="font-weight:500;color:#475569">${escapeHtml(r.kelas || '-')}</td>
      <td style="color:#475569;white-space:nowrap">${escapeHtml(r.waktu || '-')}</td>
      <td>${statusBadges(r.status || '-', ketidakhadiranStatusColor)}</td>
      <td style="color:#64748b">${escapeHtml(r.keterangan || '-')}</td>
    </tr>`
    }).join('')

    const isSakit = (data.jenis || '').toLowerCase().includes('sakit')
    const headerBg = isSakit 
        ? 'linear-gradient(135deg, #991b1b 0%, #7f1d1d 100%)' // Merah maroon
        : 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)' // Biru gelap (slate)

    return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>${SHELL_STYLE}</style></head><body>
    <div id="report">
      <div class="rp-head" style="background: ${headerBg};">
        <div class="rp-head-icon">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
        </div>
        <div>
            <div class="rp-title">Laporan Ketidakhadiran Siswa</div>
        </div>
      </div>
      <div class="rp-meta">
        <div class="rp-meta-item">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
          <b>${escapeHtml(data.tanggal || '')}</b>
        </div>
        <div class="rp-meta-item">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
          <b>${escapeHtml(data.petugas_nama || '-')}</b>
        </div>
        <div class="rp-meta-item">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
          <b>${escapeHtml(data.jenis || '-')}</b>
        </div>
      </div>
      <table style="margin-top: -1px;">
        <thead><tr><th>No</th><th>Siswa</th><th>Kelas</th><th>Waktu</th><th>Status</th><th>Keterangan</th></tr></thead>
        <tbody>${bodyRows || '<tr><td colspan="6" style="text-align:center;color:#94a3b8;padding:40px">Tidak ada data ketidakhadiran hari ini</td></tr>'}</tbody>
      </table>
      <div class="rp-foot">
        <span style="font-weight:600;color:#64748b">Total: ${escapeHtml(data.total || String(rows.length))} siswa${data.bagian ? ` — ${escapeHtml(data.bagian)}` : ''}</span>
        <div class="rp-foot-brand">
            <img src="${ACCA_LOGO_B64}" alt="ACCA" height="14" style="height:14px;width:auto;object-fit:contain;display:block" />
            <span>acca.icgowa.sch.id</span>
        </div>
      </div>
    </div>
  </body></html>`
}
