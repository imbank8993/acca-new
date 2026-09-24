/** Ukuran kertas A4 dan margin area konten (selaras template surat) */
export const A4_PAGE = {
  width: '210mm',
  height: '297mm',
  padTop: '30mm',
  padRight: '20mm',
  padBottom: '20mm',
  padLeft: '20mm',
} as const;

/**
 * Metrik tinggi untuk paginasi rekap (satuan px CSS, A4 = 794×1123px @96dpi).
 *
 * Jumlah baris per halaman TIDAK bisa dipatok angka tetap: tinggi satu baris
 * siswa mengikuti banyaknya entri ketidakhadiran dan panjang keterangannya.
 * Memakai angka tetap membuat isi tabel melebihi lembar, dan karena
 * `.print-sheet` memakai `overflow: hidden`, kelebihannya terpotong diam-diam
 * (nomor urut lompat, mis. halaman berikutnya langsung mulai dari 27).
 *
 * Semua angka di bawah hasil pengukuran langsung di browser terhadap template
 * cetak ini, bukan taksiran.
 */
export const REKAP_METRICS = {
  /** Tinggi area konten .sheet-inner (297mm − 30mm atas − 20mm bawah). */
  contentHeight: 934,
  /** Tinggi <thead> tabel, ada di setiap halaman. */
  tableHeadHeight: 18,
  /** Judul + kalimat pembuka di halaman pertama. */
  introHeight: 42,
  /** Tinggi satu baris meta (Bulan / Petugas / Jumlah Siswa). */
  metaRowHeight: 18,
  /** Margin bawah blok meta. */
  metaMargin: 8,
  /** Judul "lanjutan" di halaman kedua dan seterusnya. */
  continuedHeight: 22,
  /** Blok tanda tangan (tanggal + QR + label) di halaman terakhir. */
  signHeight: 150,
  /** Tinggi satu baris teks di dalam sel keterangan. */
  lineHeight: 11,
  /** Padding sel untuk satu entri ketidakhadiran. */
  entryPadding: 12,
  /** Tinggi minimum satu baris siswa (nama + NISN + kelas). */
  minRowHeight: 44,
  /** Perkiraan jumlah karakter per baris di kolom keterangan. */
  charsPerLine: 42,
  /** Sisa ruang pengaman supaya pembulatan tidak membuat baris terpotong. */
  safety: 24,
} as const;

/** Ubah path relatif menjadi URL absolut agar valid di jendela print (about:blank). */
export function resolvePrintAssetUrl(url: string, appBase: string): string {
  if (!url) return url;
  if (/^(https?:|data:)/i.test(url)) return url;
  const base = appBase.replace(/\/$/, '');
  return url.startsWith('/') ? `${base}${url}` : `${base}/${url}`;
}

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
