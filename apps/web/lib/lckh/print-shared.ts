/**
 * Shared helpers for LCKH print documents (Lembar Pengesahan & Lampiran).
 *
 * Both prints run entirely client-side as HTML → browser Print/Save-as-PDF.
 * These pure functions keep the KOP (letterhead) and signatory logic in one
 * place so the two documents stay visually consistent.
 */

/** Jenjang yang menampilkan baris "Kementerian Agama" pada KOP. */
const MADRASAH_JENJANG = ['MI', 'MTs', 'MA', 'MAK'];

const MONTH_NAMES = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
];

export interface ProfilSekolah {
    nama?: string | null;
    jenjang?: string | null;
    jenis?: string | null;
    alamat?: string | null;
    desa_kelurahan?: string | null;
    kecamatan?: string | null;
    kabupaten_kota?: string | null;
    provinsi?: string | null;
    kode_pos?: string | null;
    telepon?: string | null;
    email?: string | null;
    website?: string | null;
    logo_url?: string | null;
    kepala_sekolah_nama?: string | null;
    kepala_sekolah_nip?: string | null;
}

/** Minimal HTML escaping for text interpolated into the print markup. */
function esc(v: unknown): string {
    if (v === null || v === undefined) return '';
    return String(v)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

/**
 * Kota kedudukan untuk baris tanda tangan ("<Kota>, <tanggal>").
 * Membuang awalan "Kabupaten"/"Kota" agar hasilnya ringkas (mis. "Gowa").
 */
export function kotaKedudukan(profil: ProfilSekolah | null | undefined): string {
    const raw = (profil?.kabupaten_kota || '').trim();
    if (!raw) return '';
    return raw.replace(/^(kabupaten|kota)\s+/i, '').trim();
}

/**
 * Label kabupaten/kota untuk baris KOP ("KANTOR KEMENTERIAN AGAMA ...").
 * Jika nilai profil belum memuat awalan "Kabupaten"/"Kota", ditambahkan
 * "Kabupaten" (default madrasah). Admin bisa menulis "Kota X" untuk menimpa.
 */
export function kabupatenKotaLabel(profil: ProfilSekolah | null | undefined): string {
    const raw = (profil?.kabupaten_kota || '').trim();
    if (!raw) return '';
    if (/^(kabupaten|kota)\s+/i.test(raw)) return raw;
    return `Kabupaten ${raw}`;
}

/**
 * Membangun KOP surat (letterhead) resmi dari data profil_sekolah.
 * Untuk jenjang madrasah, dua baris "Kementerian Agama" ditambahkan otomatis.
 * Mengembalikan string HTML (dipakai di kedua dokumen cetak).
 */
export function renderKopHTML(profil: ProfilSekolah | null | undefined): string {
    const p = profil || {};
    const isMadrasah = MADRASAH_JENJANG.includes((p.jenjang || '').trim());
    const namaMadrasah = (p.nama || 'MADRASAH').toUpperCase();

    // Baris alamat: gabungkan komponen yang tersedia.
    const alamatParts = [
        p.alamat,
        p.desa_kelurahan ? `Kel./Desa ${p.desa_kelurahan}` : '',
        p.kecamatan ? `Kec. ${p.kecamatan}` : '',
        p.kabupaten_kota,
        p.provinsi,
        p.kode_pos,
    ].filter((x) => x && String(x).trim());
    const alamatLine = alamatParts.join(', ');

    // Baris kontak.
    const kontakParts = [
        p.telepon ? `Telp. ${p.telepon}` : '',
        p.email ? `Pos-el: ${p.email}` : '',
        p.website ? `Laman: ${p.website}` : '',
    ].filter((x) => x && String(x).trim());
    const kontakLine = kontakParts.join(' · ');

    const kemenagLines = isMadrasah
        ? `<div class="kop-kemenag">KEMENTERIAN AGAMA REPUBLIK INDONESIA</div>
           <div class="kop-kemenag">KANTOR KEMENTERIAN AGAMA ${esc(kabupatenKotaLabel(p).toUpperCase())}</div>`
        : '';

    const logo = p.logo_url
        ? `<img src="${esc(p.logo_url)}" class="kop-logo" alt="Logo" />`
        : '<div class="kop-logo"></div>';

    return `
    <div class="kop">
      ${logo}
      <div class="kop-text">
        ${kemenagLines}
        <div class="kop-nama">${esc(namaMadrasah)}</div>
        ${alamatLine ? `<div class="kop-alamat">${esc(alamatLine)}</div>` : ''}
        ${kontakLine ? `<div class="kop-alamat">${esc(kontakLine)}</div>` : ''}
      </div>
    </div>
    <div class="kop-rule-thick"></div>
    <div class="kop-rule-thin"></div>`;
}

/** CSS yang menyertai renderKopHTML. Sisipkan sekali di dalam <style>. */
export const KOP_CSS = `
  .kop { display: flex; align-items: center; gap: 14px; }
  .kop-logo { width: 80px; height: 80px; object-fit: contain; flex-shrink: 0; }
  .kop-text { flex: 1; text-align: center; }
  .kop-kemenag { font-size: 12pt; font-weight: bold; text-transform: uppercase; line-height: 1.25; }
  .kop-nama { font-size: 15pt; font-weight: bold; text-transform: uppercase; line-height: 1.25; }
  .kop-alamat { font-size: 9pt; color: #222; line-height: 1.25; }
  .kop-rule-thick { border-top: 3px solid #000; margin-top: 6px; }
  .kop-rule-thin { border-top: 1px solid #000; margin-top: 2px; margin-bottom: 16px; }
`;

/** Kop berpusat pada lebar halaman dengan logo di kiri, seperti laporan Guru Asuh. */
export const CENTERED_KOP_CSS = `${KOP_CSS}
  .kop { position: relative; display: block; }
  .kop-logo { position: absolute; left: 0; top: 0; margin: 0; }
  .kop-text { width: 100%; }
`;

export interface ApprovalRow {
    level?: string | null;
    status_approval?: string | null;
    approver_id?: string | null;
    approver_name?: string | null;
    approved_at?: string | null;
}

export interface Signatories {
    guru_name: string;
    guru_nip: string;
    waka_name: string;
    waka_nip: string;
    waka_date: string;
    waka_jabatan: string;
    kamad_name: string;
    kamad_nip: string;
    kamad_date: string;
    kota: string;
}

function fmtDate(d?: string | null): string {
    if (!d) return '-';
    try {
        return new Date(d).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
    } catch {
        return '-';
    }
}

/**
 * Menyusun data penanda tangan dari log approval + profil + submission.
 *
 * @param approvals  Baris lckh_approvals (APPROVED).
 * @param nipMap     Peta approver_id -> NIP (hasil lookup tabel users di API).
 * @param profil     Profil sekolah (untuk kepala madrasah).
 * @param submission Submission LCKH (untuk nama & NIP guru).
 */
export function buildSignatories(
    approvals: ApprovalRow[] | null | undefined,
    nipMap: Record<string, string>,
    profil: ProfilSekolah | null | undefined,
    submission: { nama_guru_snap?: string | null; nip?: string | null },
): Signatories {
    const rows = (approvals || []).filter((a) => a.status_approval === 'APPROVED');

    // Validator = approval WKM_* (atau WAKA lama), bukan KAMAD.
    const wakaRow = rows.find(
        (a) => a.level && a.level !== 'KAMAD' && (a.level.startsWith('WKM') || a.level === 'WAKA'),
    );
    const kamadRow = rows.find((a) => a.level === 'KAMAD');

    const wakaJabatan = wakaRow?.level === 'WKM_KESISWAAN'
        ? 'Wakamad Kesiswaan'
        : 'Wakamad Kurikulum';

    const kamadNip = (kamadRow?.approver_id && nipMap[kamadRow.approver_id])
        || profil?.kepala_sekolah_nip
        || '-';

    return {
        guru_name: submission?.nama_guru_snap || '-',
        guru_nip: submission?.nip || '-',
        waka_name: wakaRow?.approver_name || '-',
        waka_nip: (wakaRow?.approver_id && nipMap[wakaRow.approver_id]) || '-',
        waka_date: fmtDate(wakaRow?.approved_at),
        waka_jabatan: wakaJabatan,
        kamad_name: kamadRow?.approver_name || profil?.kepala_sekolah_nama || '-',
        kamad_nip: kamadNip,
        kamad_date: fmtDate(kamadRow?.approved_at),
        kota: kotaKedudukan(profil),
    };
}

/** Info semester/tahun ajaran dari tanggal periode. */
export function semesterInfo(periodStart?: string | null): { bulan: string; semester: string; tahunAjaran: string } {
    if (!periodStart) return { bulan: '-', semester: '-', tahunAjaran: '-' };
    const d = new Date(periodStart);
    const m = d.getMonth() + 1;
    const y = d.getFullYear();
    const ganjil = m >= 7;
    return {
        bulan: MONTH_NAMES[m - 1] || '-',
        semester: ganjil ? 'Ganjil' : 'Genap',
        tahunAjaran: ganjil ? `${y}/${y + 1}` : `${y - 1}/${y}`,
    };
}
