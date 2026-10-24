/**
 * Dokumen administrasi E-Supervisi (HTML siap cetak, A4).
 *
 *  1. Laporan Hasil Supervisi Akademik — rekap seluruh guru satu tahun ajaran:
 *     identitas, rekapitulasi nilai, distribusi predikat, analisis indikator,
 *     simpulan & rekomendasi tindak lanjut, pengesahan Kepala Madrasah.
 *  2. Lembar Hasil Supervisi per guru — instrumen terisi (termasuk
 *     sub-indikator), nilai per tahap, catatan supervisor, rencana tindak
 *     lanjut, dan tanda tangan guru, supervisor, serta Kepala Madrasah.
 *
 * Angka dihitung dengan modul `penilaian` yang sama dengan server.
 */
import { CENTERED_KOP_CSS, kotaKedudukan, renderKopHTML, type ProfilSekolah } from '@/lib/lckh/print-shared';
import { bakukanMentah, hitungHasil, indikatorDinilai, konversiNilai, predikatDari } from './penilaian';

export const BATAS_BAIK = 76;

function esc(v: unknown): string {
  if (v === null || v === undefined) return '';
  return String(v)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const angka = (v: unknown) => (v === null || v === undefined || v === '' ? '-' : Number(v).toFixed(2));

export interface TahunAjaranInfo { tahun_ajaran?: string | null; semester?: string | null }

export function labelTahunAjaran(ta?: TahunAjaranInfo | null): string {
  if (!ta?.tahun_ajaran) return '-';
  return `${ta.tahun_ajaran}${ta.semester ? ` Semester ${ta.semester}` : ''}`;
}

function tanggalCetak(): string {
  return new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Makassar' });
}

const BASE_CSS = `
  @page { size: A4; margin: 16mm 14mm; }
  * { box-sizing: border-box; }
  body { font-family: 'Times New Roman', Times, serif; font-size: 11pt; color: #000; margin: 0; }
  ${CENTERED_KOP_CSS}
  h1 { font-size: 13pt; text-align: center; margin: 4px 0 2px; text-transform: uppercase; }
  .sub { text-align: center; margin: 0 0 14px; font-size: 11pt; }
  h2 { font-size: 11.5pt; margin: 16px 0 6px; text-transform: uppercase; }
  table { width: 100%; border-collapse: collapse; }
  table.data th, table.data td { border: 1px solid #000; padding: 4px 6px; vertical-align: top; }
  table.data th { background: #e8e8e8; text-align: center; font-weight: bold; }
  table.data td.c { text-align: center; }
  table.data td.r { text-align: right; }
  table.data tr.grup td { background: #f2f2f2; font-weight: bold; }
  table.data tr.total td { font-weight: bold; background: #fafafa; }
  table.ident td { padding: 2px 4px; vertical-align: top; }
  table.ident td.l { width: 170px; }
  table.ident td.s { width: 10px; }
  .muted { color: #444; font-size: 10pt; }
  .box { border: 1px solid #000; padding: 8px 10px; min-height: 60px; white-space: pre-wrap; }
  ol, ul { margin: 4px 0 4px 18px; padding: 0; }
  li { margin: 2px 0; }
  .ttd { display: flex; justify-content: space-between; gap: 16px; margin-top: 26px; page-break-inside: avoid; }
  .ttd > div { flex: 1; text-align: center; }
  .ttd .nama { margin-top: 64px; font-weight: bold; text-decoration: underline; }
  .garis td { height: 26px; }
  .avoid { page-break-inside: avoid; }
  @media print { .noprint { display: none; } }
`;

function dokumenHtml(judul: string, isi: string): string {
  return `<!doctype html><html lang="id"><head><meta charset="utf-8"><title>${esc(judul)}</title><style>${BASE_CSS}</style></head><body>${isi}</body></html>`;
}

function blokTtd(kolom: { jabatan: string; nama?: string | null; nip?: string | null; atas?: string }[]): string {
  return `<div class="ttd">${kolom.map((k) => `
    <div>
      <div>${k.atas ? esc(k.atas) : '&nbsp;'}</div>
      <div>${esc(k.jabatan)}</div>
      <div class="nama">${k.nama ? esc(k.nama) : '..............................................'}</div>
      <div>NIP. ${k.nip ? esc(k.nip) : '..............................'}</div>
    </div>`).join('')}</div>`;
}

// ─── 1. Laporan Hasil Supervisi (rekap madrasah) ─────────────────────────────

export interface RekapRow {
  guru_nama: string;
  guru_nip: string;
  guru_mapel?: string;
  supervisor_nama: string;
  supervisor_nip?: string;
  status?: string | null;
  progres?: number;
  nilai: Record<string, string | null>;
}

export interface IndikatorStat {
  nama_indikator: string;
  nama_dokumen: string;
  tahap: string;
  jumlah: number;
  rata_rata: number;
}

export interface LaporanHasilInput {
  rekap: RekapRow[];
  stages: string[];
  indikatorStats: IndikatorStat[];
  profil?: ProfilSekolah | null;
  tahunAjaran?: TahunAjaranInfo | null;
  penyusunNama?: string;
  penyusunNip?: string;
}

export function generateLaporanHasilSupervisiHtml(input: LaporanHasilInput): string {
  const { rekap, stages, indikatorStats, profil } = input;
  const ta = labelTahunAjaran(input.tahunAjaran);
  const dinilai = rekap.filter((r) => r.nilai?.rata_rata !== null && r.nilai?.rata_rata !== undefined);
  const nilaiAkhir = dinilai.map((r) => Number(r.nilai.rata_rata));
  const rataMadrasah = nilaiAkhir.length ? nilaiAkhir.reduce((a, b) => a + b, 0) / nilaiAkhir.length : null;
  const tertinggi = nilaiAkhir.length ? Math.max(...nilaiAkhir) : null;
  const terendah = nilaiAkhir.length ? Math.min(...nilaiAkhir) : null;
  const selesai = rekap.filter((r) => (r.progres ?? 0) >= 100).length;
  const terkunci = rekap.filter((r) => r.status === 'terkunci').length;

  const kategori = ['Sangat Baik', 'Baik', 'Cukup', 'Kurang'];
  const distribusi = kategori.map((k) => ({ k, n: dinilai.filter((r) => r.nilai.predikat === k).length }));
  const belum = rekap.length - dinilai.length;
  const persen = (n: number) => (rekap.length ? `${((n / rekap.length) * 100).toFixed(1)}%` : '0%');

  const perluPembinaan = dinilai
    .filter((r) => Number(r.nilai.rata_rata) < BATAS_BAIK)
    .sort((a, b) => Number(a.nilai.rata_rata) - Number(b.nilai.rata_rata));
  const lemah = indikatorStats.filter((s) => s.rata_rata < BATAS_BAIK).slice(0, 7);
  const kuat = [...indikatorStats].sort((a, b) => b.rata_rata - a.rata_rata).slice(0, 3);

  const barisRekap = rekap.map((r, i) => `
    <tr>
      <td class="c">${i + 1}</td>
      <td>${esc(r.guru_nama)}<br><span class="muted">NIP. ${esc(r.guru_nip || '-')}</span></td>
      <td>${esc(r.guru_mapel || '-')}</td>
      <td>${esc(r.supervisor_nama || '-')}</td>
      ${stages.map((t) => `<td class="c">${angka(r.nilai?.[t])}</td>`).join('')}
      <td class="c"><b>${angka(r.nilai?.rata_rata)}</b></td>
      <td class="c">${esc(r.nilai?.predikat || '-')}</td>
    </tr>`).join('');

  const rekomendasi: string[] = [];
  if (perluPembinaan.length) {
    rekomendasi.push(`Melaksanakan pembinaan individual (coaching/pendampingan dan supervisi ulang) bagi ${perluPembinaan.length} guru dengan nilai di bawah ${BATAS_BAIK}: ${perluPembinaan.map((r) => esc(r.guru_nama)).join(', ')}.`);
  }
  if (lemah.length) {
    rekomendasi.push(`Menjadikan indikator dengan capaian terendah sebagai fokus program pengembangan keprofesian (IHT, KKG/MGMP, atau lesson study), terutama: ${lemah.slice(0, 3).map((s) => `${esc(s.nama_indikator)} (${s.rata_rata.toFixed(2)})`).join('; ')}.`);
  }
  if (kuat.length) {
    rekomendasi.push(`Memberdayakan praktik baik pada indikator dengan capaian tertinggi (${kuat.map((s) => esc(s.nama_indikator)).join('; ')}) melalui berbagi praktik baik antarguru.`);
  }
  if (belum > 0) rekomendasi.push(`Menuntaskan supervisi bagi ${belum} guru yang belum dinilai.`);
  rekomendasi.push('Menindaklanjuti hasil supervisi pada perencanaan program supervisi periode berikutnya.');

  const isi = `
    ${renderKopHTML(profil)}
    <h1>Laporan Hasil Supervisi Akademik</h1>
    <p class="sub">Tahun Pelajaran ${esc(ta)}</p>

    <h2>A. Identitas</h2>
    <table class="ident">
      <tr><td class="l">Nama Madrasah</td><td class="s">:</td><td>${esc(profil?.nama || '-')}</td></tr>
      <tr><td class="l">Tahun Pelajaran</td><td class="s">:</td><td>${esc(ta)}</td></tr>
      <tr><td class="l">Jumlah guru disupervisi</td><td class="s">:</td><td>${rekap.length} orang (${selesai} selesai dinilai, ${terkunci} nilai final/terkunci)</td></tr>
      <tr><td class="l">Kepala Madrasah</td><td class="s">:</td><td>${esc(profil?.kepala_sekolah_nama || '-')}</td></tr>
    </table>

    <h2>B. Rekapitulasi Nilai</h2>
    <table class="data">
      <thead><tr>
        <th style="width:28px">No</th><th>Nama Guru</th><th>Mata Pelajaran</th><th>Supervisor</th>
        ${stages.map((t) => `<th style="text-transform:capitalize">${esc(t)}</th>`).join('')}
        <th>Nilai Akhir</th><th>Predikat</th>
      </tr></thead>
      <tbody>${barisRekap || `<tr><td colspan="${6 + stages.length}" class="c">Belum ada penugasan supervisi.</td></tr>`}</tbody>
    </table>
    <p class="muted">Nilai indikator = skor perolehan ÷ skor maksimal × 100. Predikat: Sangat Baik (91–100), Baik (76–90), Cukup (61–75), Kurang (&lt; 61).</p>

    <div class="avoid">
    <h2>C. Distribusi Predikat</h2>
    <table class="data">
      <thead><tr><th>Predikat</th><th style="width:110px">Jumlah Guru</th><th style="width:110px">Persentase</th></tr></thead>
      <tbody>
        ${distribusi.map((d) => `<tr><td>${d.k}</td><td class="c">${d.n}</td><td class="c">${persen(d.n)}</td></tr>`).join('')}
        <tr><td>Belum dinilai</td><td class="c">${belum}</td><td class="c">${persen(belum)}</td></tr>
        <tr class="total"><td>Jumlah</td><td class="c">${rekap.length}</td><td class="c">${rekap.length ? '100%' : '0%'}</td></tr>
      </tbody>
    </table>
    <p>Rata-rata nilai madrasah: <b>${rataMadrasah === null ? '-' : rataMadrasah.toFixed(2)}</b> (${predikatDari(rataMadrasah === null ? null : rataMadrasah)}); nilai tertinggi ${tertinggi === null ? '-' : tertinggi.toFixed(2)}, terendah ${terendah === null ? '-' : terendah.toFixed(2)}.</p>
    </div>

    <h2>D. Analisis Indikator</h2>
    ${indikatorStats.length ? `
    <p>Indikator dengan capaian rata-rata di bawah ${BATAS_BAIK} (perlu ditingkatkan):</p>
    ${lemah.length ? `<table class="data">
      <thead><tr><th style="width:28px">No</th><th>Indikator</th><th>Dokumen / Tahap</th><th style="width:80px">Rata-rata</th></tr></thead>
      <tbody>${lemah.map((s, i) => `<tr><td class="c">${i + 1}</td><td>${esc(s.nama_indikator)}</td><td>${esc(s.nama_dokumen)} / ${esc(s.tahap)}</td><td class="c">${s.rata_rata.toFixed(2)}</td></tr>`).join('')}</tbody>
    </table>` : '<p class="muted">Tidak ada — seluruh indikator mencapai kategori Baik.</p>'}
    <p>Indikator dengan capaian tertinggi: ${kuat.map((s) => `${esc(s.nama_indikator)} (${s.rata_rata.toFixed(2)})`).join('; ') || '-'}.</p>
    ` : '<p class="muted">Belum ada nilai indikator yang dapat dianalisis.</p>'}

    <div class="avoid">
    <h2>E. Simpulan dan Rekomendasi Tindak Lanjut</h2>
    <p>Berdasarkan hasil supervisi akademik terhadap ${dinilai.length} dari ${rekap.length} guru, rata-rata capaian madrasah berada pada kategori <b>${predikatDari(rataMadrasah === null ? null : rataMadrasah)}</b>. Rekomendasi tindak lanjut:</p>
    <ol>${rekomendasi.map((r) => `<li>${r}</li>`).join('')}</ol>
    <p>Catatan tambahan:</p>
    <div class="box"></div>
    </div>

    ${blokTtd([
      { atas: '', jabatan: 'Penyusun / Koordinator Supervisi', nama: input.penyusunNama, nip: input.penyusunNip },
      { atas: `${kotaKedudukan(profil) || '..............'}, ${tanggalCetak()}`, jabatan: 'Kepala Madrasah', nama: profil?.kepala_sekolah_nama, nip: profil?.kepala_sekolah_nip },
    ])}
  `;
  return dokumenHtml(`Laporan Hasil Supervisi ${ta}`, isi);
}

// ─── 2. Lembar Hasil Supervisi per guru ──────────────────────────────────────

export interface LembarGuruInput {
  penugasan: RekapRow & { guru_kelas?: string };
  dokumen: any[]; // bentuk GET /e-supervisi/dokumen (induk + sub_indikators)
  nilaiRows: { indikator_id: number; nilai_mentah: string | null; catatan?: string | null }[];
  profil?: ProfilSekolah | null;
  tahunAjaran?: TahunAjaranInfo | null;
}

export function generateLembarHasilGuruHtml(input: LembarGuruInput): string {
  const { penugasan: p, dokumen, nilaiRows, profil } = input;
  const ta = labelTahunAjaran(input.tahunAjaran);
  const nilaiMap = new Map(nilaiRows.map((n) => [Number(n.indikator_id), n]));
  const flat = dokumen.map((d) => ({ ...d, sv_indikator: (d.indikators || []).flatMap((i: any) => [i, ...(i.sub_indikators || [])]) }));
  const dinilai = indikatorDinilai(flat);
  const stages = Array.from(new Set(dokumen.map((d) => String(d.tahap))));
  const hasil = hitungHasil(dinilai, nilaiRows, stages);

  const perbaikan: { nama: string; dokumen: string; nilai: number | null }[] = [];
  const catatanList: string[] = [];

  const tabelPerTahap = stages.map((tahap) => {
    const docs = dokumen.filter((d) => String(d.tahap) === tahap);
    const body = docs.map((d) => {
      const rows: string[] = [`<tr class="grup"><td colspan="4">${esc(d.nama_dokumen)}</td></tr>`];
      const nilaiDok: number[] = [];
      (d.indikators || []).forEach((ind: any, i: number) => {
        const baris = (x: any, no: string, sub: boolean) => {
          const dapatDinilai = dinilai.has(Number(x.id));
          const n = nilaiMap.get(Number(x.id));
          const v = dapatDinilai ? konversiNilai(x.skala_config, n?.nilai_mentah) : null;
          if (v !== null) nilaiDok.push(v);
          if (dapatDinilai && (v === null || v < BATAS_BAIK)) perbaikan.push({ nama: x.nama_indikator, dokumen: d.nama_dokumen, nilai: v });
          if (n?.catatan?.trim()) catatanList.push(`${d.nama_dokumen}: ${n.catatan.trim()}`);
          const skor = dapatDinilai ? (bakukanMentah(x.skala_config, n?.nilai_mentah) ?? '-') : '';
          return `<tr>
            <td class="c">${no}</td>
            <td style="${sub ? 'padding-left:22px' : 'font-weight:' + (dapatDinilai ? 'normal' : 'bold')}">${esc(x.nama_indikator)}</td>
            <td class="c">${esc(skor)}</td>
            <td class="c">${dapatDinilai ? angka(v) : ''}</td>
          </tr>`;
        };
        rows.push(baris(ind, String(i + 1), false));
        (ind.sub_indikators || []).forEach((s: any, j: number) => rows.push(baris(s, `${i + 1}.${j + 1}`, true)));
      });
      const rata = nilaiDok.length ? nilaiDok.reduce((a, b) => a + b, 0) / nilaiDok.length : null;
      rows.push(`<tr class="total"><td colspan="3" class="r">Rata-rata ${esc(d.nama_dokumen)}</td><td class="c">${angka(rata)}</td></tr>`);
      return rows.join('');
    }).join('');
    return `
      <h2 style="text-transform:capitalize">Tahap ${esc(tahap)} — Nilai ${angka(hasil.per_tahap[tahap])}</h2>
      <table class="data">
        <thead><tr><th style="width:40px">No</th><th>Indikator</th><th style="width:60px">Skor</th><th style="width:70px">Nilai</th></tr></thead>
        <tbody>${body || '<tr><td colspan="4" class="c">Belum ada indikator.</td></tr>'}</tbody>
      </table>`;
  }).join('');

  const isi = `
    ${renderKopHTML(profil)}
    <h1>Lembar Hasil Supervisi Akademik</h1>
    <p class="sub">Tahun Pelajaran ${esc(ta)}</p>
    <table class="ident">
      <tr><td class="l">Nama Guru</td><td class="s">:</td><td>${esc(p.guru_nama)}</td></tr>
      <tr><td class="l">NIP</td><td class="s">:</td><td>${esc(p.guru_nip || '-')}</td></tr>
      <tr><td class="l">Mata Pelajaran / Kelas</td><td class="s">:</td><td>${esc(p.guru_mapel || '-')}${p.guru_kelas ? ` / ${esc(p.guru_kelas)}` : ''}</td></tr>
      <tr><td class="l">Supervisor</td><td class="s">:</td><td>${esc(p.supervisor_nama || '-')}${p.supervisor_nip ? ` (NIP. ${esc(p.supervisor_nip)})` : ''}</td></tr>
      <tr><td class="l">Status Penilaian</td><td class="s">:</td><td>${p.status === 'terkunci' ? 'Final (terkunci)' : 'Belum final'} — ${hasil.dinilai} dari ${hasil.total} indikator dinilai</td></tr>
    </table>

    ${tabelPerTahap || '<p class="muted">Belum ada instrumen penilaian pada tahun pelajaran ini.</p>'}

    <div class="avoid">
    <h2>Rekapitulasi</h2>
    <table class="data">
      <thead><tr>${stages.map((t) => `<th style="text-transform:capitalize">${esc(t)}</th>`).join('')}<th>Nilai Akhir</th><th>Predikat</th></tr></thead>
      <tbody><tr>${stages.map((t) => `<td class="c">${angka(hasil.per_tahap[t])}</td>`).join('')}<td class="c"><b>${angka(hasil.rata_rata)}</b></td><td class="c">${esc(hasil.predikat)}</td></tr></tbody>
    </table>
    </div>

    <h2>Catatan Supervisor</h2>
    <div class="box">${catatanList.length ? catatanList.map(esc).join('\n') : ''}</div>

    <div class="avoid">
    <h2>Rencana Tindak Lanjut</h2>
    <table class="data">
      <thead><tr><th style="width:28px">No</th><th>Aspek yang Perlu Ditingkatkan</th><th style="width:70px">Nilai</th><th>Bentuk Tindak Lanjut</th><th style="width:90px">Waktu</th></tr></thead>
      <tbody>
        ${perbaikan.slice(0, 10).map((x, i) => `<tr><td class="c">${i + 1}</td><td>${esc(x.nama)}<br><span class="muted">${esc(x.dokumen)}</span></td><td class="c">${x.nilai === null ? 'Belum dinilai' : x.nilai.toFixed(2)}</td><td></td><td></td></tr>`).join('')}
        ${perbaikan.length === 0 ? '<tr><td class="c">1</td><td>Mempertahankan dan berbagi praktik baik pembelajaran</td><td class="c">-</td><td></td><td></td></tr>' : ''}
        <tr class="garis"><td></td><td></td><td></td><td></td><td></td></tr>
      </tbody>
    </table>
    </div>

    ${blokTtd([
      { atas: '', jabatan: 'Guru yang Disupervisi', nama: p.guru_nama, nip: p.guru_nip },
      { atas: `${kotaKedudukan(profil) || '..............'}, ${tanggalCetak()}`, jabatan: 'Supervisor', nama: p.supervisor_nama, nip: p.supervisor_nip },
    ])}
    <div class="ttd" style="justify-content:center">
      <div style="flex:0 0 50%">
        <div>Mengetahui,</div>
        <div>Kepala Madrasah</div>
        <div class="nama">${profil?.kepala_sekolah_nama ? esc(profil.kepala_sekolah_nama) : '..............................................'}</div>
        <div>NIP. ${profil?.kepala_sekolah_nip ? esc(profil.kepala_sekolah_nip) : '..............................'}</div>
      </div>
    </div>
  `;
  return dokumenHtml(`Lembar Hasil Supervisi ${p.guru_nama}`, isi);
}
