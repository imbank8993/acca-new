/**
 * Pembaca kalender "Hari Libur di Indonesia" milik Google (format iCal).
 *
 * Feed ini publik — tidak perlu API key — tetapi isinya campuran: libur
 * nasional, cuti bersama, dan hari PERINGATAN (Hari Kartini, Hari Ibu, ...)
 * yang bukan hari libur. Karena itu modul ini hanya membaca & mengelompokkan;
 * keputusan apa yang disimpan tetap di tangan admin lewat pratinjau.
 *
 * Fungsi di sini murni (tanpa Nest/Prisma) supaya bisa diuji langsung
 * (apps/api/test/libur-nasional.test.cjs).
 */

/** Bisa diganti lewat env, mis. versi berbahasa Inggris `en.indonesian#holiday@...`. */
export const DEFAULT_ICS_URL =
  'https://calendar.google.com/calendar/ical/id.indonesian%23holiday%40group.v.calendar.google.com/public/basic.ics';

export type KategoriLibur = 'nasional' | 'cuti_bersama' | 'peringatan' | 'lainnya';

export interface EventLiburNasional {
  uid: string;
  /** YYYY-MM-DD, inklusif. */
  tanggal_mulai: string;
  /** YYYY-MM-DD, INKLUSIF — sudah dikoreksi dari DTEND iCal yang eksklusif. */
  tanggal_selesai: string;
  keterangan: string;
  deskripsi: string;
  kategori: KategoriLibur;
}

/** `\n`, `\,`, `\;`, `\\` → karakter aslinya (RFC 5545 §3.3.11). */
function unescapeText(v: string): string {
  return v.replace(/\\([nN,;\\])/g, (_, c) => (c === 'n' || c === 'N' ? '\n' : c));
}

/** Baris yang diawali spasi/tab adalah lanjutan baris sebelumnya (line folding). */
function unfold(ics: string): string[] {
  return ics.replace(/\r\n/g, '\n').replace(/\r/g, '\n').replace(/\n[ \t]/g, '').split('\n');
}

/** `20270101` atau `20270101T000000Z` → `2027-01-01`. */
function icsDate(v: string): string | null {
  const m = /^(\d{4})(\d{2})(\d{2})/.exec(v.trim());
  return m ? `${m[1]}-${m[2]}-${m[3]}` : null;
}

function geserHari(tanggal: string, hari: number): string {
  const [y, m, d] = tanggal.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d) + hari * 86_400_000).toISOString().slice(0, 10);
}

/**
 * Kategori dari judul + deskripsi. Google menandai jenis acara di DESCRIPTION
 * ("Public holiday"/"Observance" pada feed Inggris; padanan Indonesianya pada
 * feed `id.`). Yang tidak dikenali jatuh ke 'lainnya' dan TIDAK dicentang
 * otomatis di pratinjau — lebih aman admin memeriksa daripada salah meliburkan.
 */
export function klasifikasi(judul: string, deskripsi: string): KategoriLibur {
  const j = judul.toLowerCase();
  // Baris pertama deskripsi adalah labelnya. Baris berikutnya berupa petunjuk
  // ("Untuk menyembunyikan peringatan, buka Setelan > Hari libur di
  // Indonesia") yang bisa mengandung kata "libur" padahal acaranya peringatan.
  const label = deskripsi.split('\n')[0].toLowerCase().trim();
  const RE_LIBUR = /public holiday|national holiday|bank holiday|libur (nasional|umum|resmi)/;
  const RE_PERINGATAN = /observance|peringatan|perayaan/;
  if (/cuti bersama|joint holiday|collective leave/.test(j)) return 'cuti_bersama';
  if (RE_PERINGATAN.test(label)) return 'peringatan';
  if (RE_LIBUR.test(label)) return 'nasional';
  // Beberapa feed lama tidak punya DESCRIPTION; judul "Libur ..." cukup jelas.
  if (/^(hari )?libur\b|holiday$/.test(j)) return 'nasional';
  return 'lainnya';
}

/** Urai teks iCal menjadi daftar acara sehari-penuh, terurut per tanggal. */
export function parseIcsLibur(ics: string): EventLiburNasional[] {
  const hasil: EventLiburNasional[] = [];
  let cur: Record<string, string> | null = null;

  for (const baris of unfold(ics)) {
    if (baris === 'BEGIN:VEVENT') {
      cur = {};
      continue;
    }
    if (baris === 'END:VEVENT') {
      if (cur) {
        const mulai = icsDate(cur.DTSTART || '');
        if (mulai) {
          const akhirEksklusif = icsDate(cur.DTEND || '');
          // DTEND tanggal-saja bersifat eksklusif: libur 1 hari = DTSTART 1, DTEND 2.
          let selesai = akhirEksklusif ? geserHari(akhirEksklusif, -1) : mulai;
          if (selesai < mulai) selesai = mulai;
          const keterangan = unescapeText(cur.SUMMARY || '').trim();
          const deskripsi = unescapeText(cur.DESCRIPTION || '').trim();
          if (keterangan) {
            hasil.push({
              uid: cur.UID || `${mulai}|${keterangan}`,
              tanggal_mulai: mulai,
              tanggal_selesai: selesai,
              keterangan,
              deskripsi,
              kategori: klasifikasi(keterangan, deskripsi),
            });
          }
        }
      }
      cur = null;
      continue;
    }
    if (!cur) continue;
    const titikDua = baris.indexOf(':');
    if (titikDua < 0) continue;
    // `DTSTART;VALUE=DATE:20270101` → nama properti tanpa parameter.
    const nama = baris.slice(0, titikDua).split(';')[0].toUpperCase();
    if (!(nama in cur)) cur[nama] = baris.slice(titikDua + 1);
  }

  return hasil.sort((a, b) =>
    a.tanggal_mulai === b.tanggal_mulai
      ? a.keterangan.localeCompare(b.keterangan)
      : a.tanggal_mulai < b.tanggal_mulai ? -1 : 1,
  );
}

/** Daftar tanggal `mulai`..`selesai` inklusif (UTC murni). */
export function rentangTanggalNasional(mulai: string, selesai: string): string[] {
  const out: string[] = [];
  for (let t = mulai; t <= selesai; t = geserHari(t, 1)) out.push(t);
  return out;
}
