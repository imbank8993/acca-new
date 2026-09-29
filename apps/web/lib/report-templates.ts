/**
 * lib/report-templates.ts
 * Template HTML untuk laporan yang akan dirender jadi gambar (via lib/report-image.ts)
 * lalu dikirim ke grup WA sebagai gambar.
 *
 * Semua styling inline/self-contained agar bisa dirender headless tanpa aset eksternal.
 */

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
  
  .rp-meta { display: flex; flex-wrap: nowrap; align-items: center; gap: 28px; padding: 18px 32px; background: #ffffff; border-bottom: 1px solid #e2e8f0; }
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
  .rp-foot-brand { display: flex; align-items: center; gap: 8px; font-weight: 700; color: #1e3a8a; }
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
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#2563eb" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2L2 7l10 5 10-5-10-5z"></path><path d="M2 17l10 5 10-5"></path><path d="M2 12l10 5 10-5"></path></svg>
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
        // Buat inisial dari nama
        const initial = (r.nama || '?').substring(0, 2).toUpperCase()
        const colorHue = Array.from(initial).reduce((acc, char) => acc + char.charCodeAt(0), 0) % 360
        const avatarBg = `hsl(${colorHue}, 70%, 90%)`
        const avatarColor = `hsl(${colorHue}, 70%, 30%)`

        return `<tr>
      <td class="rp-num">${escapeHtml(r.no || String(i + 1))}</td>
      <td>
        <div class="user-cell">
          <div class="user-avatar" style="background:${avatarBg};color:${avatarColor}">${initial}</div>
          <div class="user-details">
            <span class="user-name">${escapeHtml(r.nama || '-')}</span>
            <span class="user-nisn">NISN: ${escapeHtml(r.nisn || '-')}</span>
          </div>
        </div>
      </td>
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
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#2563eb" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2L2 7l10 5 10-5-10-5z"></path><path d="M2 17l10 5 10-5"></path><path d="M2 12l10 5 10-5"></path></svg>
            <span>acca.icgowa.sch.id</span>
        </div>
      </div>
    </div>
  </body></html>`
}
