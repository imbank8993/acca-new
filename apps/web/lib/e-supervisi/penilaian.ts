/**
 * Aturan penilaian E-Supervisi — fungsi murni tanpa akses basis data.
 *
 * Salinan identik ada di apps/api/src/e-supervisi/penilaian.ts dan apps/web/lib/e-supervisi/penilaian.ts supaya angka
 * yang dilihat supervisor di layar Penilaian, tab Hasil, dan dokumen cetak
 * dihitung dengan rumus yang SAMA dengan server. Ubah keduanya bersamaan.
 *
 * Rumus nilai per indikator (instrumen supervisi akademik):
 *   skala angka  : skor perolehan / skor maksimal x 100   (mis. 3 dari 4 = 75)
 *   skala huruf  : A=100, B=85, C=70, D=50  (atau `opsi` pada konfigurasi)
 *   ya / tidak   : Ya=100, Tidak=0
 * Nilai tahap  = rata-rata nilai indikator yang SUDAH dinilai pada tahap itu.
 * Nilai akhir  = rata-rata nilai tahap yang sudah memiliki nilai.
 */

export type TipeSkala = 'angka' | 'huruf' | 'yatidak' | 'group';

export interface SkalaConfig {
  tipe: TipeSkala;
  min?: number;
  max?: number;
  opsi?: Record<string, number>;
  parent_id?: number;
}

export const TIPE_SKALA: TipeSkala[] = ['angka', 'huruf', 'yatidak', 'group'];
export const OPSI_HURUF: Record<string, number> = { A: 100, B: 85, C: 70, D: 50 };
export const OPSI_YATIDAK: Record<string, number> = { Ya: 100, Tidak: 0 };
/** Rentang skala angka dibatasi agar borang tetap wajar (mis. 1–4, 1–5, 0–10). */
export const RENTANG_ANGKA_MAKS = 10;

export function parseConfig(raw: unknown): any {
  if (raw && typeof raw === 'object') return raw;
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
      return {};
    }
  }
  return {};
}

/**
 * Rapikan konfigurasi skala dari formulir/impor. Mengembalikan pesan galat
 * (string) bila konfigurasi tidak dapat dipakai.
 */
export function normalisasiSkala(raw: unknown): SkalaConfig | string {
  const c = parseConfig(raw);
  const tipeRaw = String(c.tipe || 'angka').trim().toLowerCase().replace(/[\s/_-]/g, '');
  const tipe: TipeSkala | undefined =
    tipeRaw === 'angka' || tipeRaw === 'skala' ? 'angka'
      : tipeRaw === 'huruf' ? 'huruf'
        : tipeRaw === 'yatidak' || tipeRaw === 'ya' ? 'yatidak'
          : tipeRaw === 'group' || tipeRaw === 'label' ? 'group'
            : undefined;
  if (!tipe) return `Tipe skala "${c.tipe}" tidak dikenal (pakai angka, huruf, yatidak, atau group)`;

  if (tipe === 'angka') {
    const min = c.min === undefined || c.min === '' ? 1 : Number(c.min);
    const max = c.max === undefined || c.max === '' ? 4 : Number(c.max);
    if (!Number.isInteger(min) || !Number.isInteger(max)) return 'Skala angka harus bilangan bulat';
    if (min < 0) return 'Skor minimum tidak boleh negatif';
    if (max <= min) return 'Skor maksimum harus lebih besar dari skor minimum';
    if (max - min > RENTANG_ANGKA_MAKS) return `Rentang skala angka maksimal ${RENTANG_ANGKA_MAKS} langkah`;
    return { tipe, min, max };
  }
  if (tipe === 'huruf') return { tipe, opsi: opsiValid(c.opsi) || { ...OPSI_HURUF } };
  if (tipe === 'yatidak') return { tipe, opsi: opsiValid(c.opsi) || { ...OPSI_YATIDAK } };
  return { tipe };
}

function opsiValid(opsi: any): Record<string, number> | null {
  if (!opsi || typeof opsi !== 'object') return null;
  const hasil: Record<string, number> = {};
  for (const [k, v] of Object.entries(opsi)) {
    const n = Number(v);
    if (!k.trim() || !Number.isFinite(n) || n < 0 || n > 100) return null;
    hasil[k.trim()] = n;
  }
  return Object.keys(hasil).length ? hasil : null;
}

/** Pilihan skor yang ditawarkan borang untuk sebuah indikator. */
export function pilihanSkor(raw: unknown): { label: string; value: string }[] {
  const c = normalisasiSkala(raw);
  if (typeof c === 'string' || c.tipe === 'group') return [];
  if (c.tipe === 'angka') {
    return Array.from({ length: c.max! - c.min! + 1 }, (_, i) => ({ label: String(c.min! + i), value: String(c.min! + i) }));
  }
  if (c.tipe === 'yatidak') return [{ label: 'Ya', value: 'Ya' }, { label: 'Tidak', value: 'Tidak' }];
  return Object.keys(c.opsi || OPSI_HURUF).map((k) => ({ label: k, value: k }));
}

/**
 * Nilai 0–100 untuk sebuah skor mentah, atau `null` bila skornya kosong /
 * tidak sah untuk skala tersebut (bukan 0 — skor tak sah tidak boleh diam-diam
 * menjadi nol dan menurunkan rata-rata).
 */
export function konversiNilai(raw: unknown, mentah: unknown): number | null {
  const c = normalisasiSkala(raw);
  if (typeof c === 'string' || c.tipe === 'group') return null;
  const v = String(mentah ?? '').trim();
  if (!v) return null;

  if (c.tipe === 'angka') {
    if (!/^-?\d+$/.test(v)) return null;
    const n = Number(v);
    if (n < c.min! || n > c.max!) return null;
    return bulatkan((n / c.max!) * 100);
  }
  if (c.tipe === 'yatidak') {
    // Data lama menyimpan '100' / '0'.
    const kunci = v === '100' ? 'Ya' : v === '0' ? 'Tidak' : v;
    const cocok = Object.keys(c.opsi!).find((k) => k.toLowerCase() === kunci.toLowerCase());
    return cocok === undefined ? null : c.opsi![cocok];
  }
  const cocok = Object.keys(c.opsi!).find((k) => k.toLowerCase() === v.toLowerCase());
  return cocok === undefined ? null : c.opsi![cocok];
}

/** Skor mentah dalam bentuk baku untuk disimpan (mis. "ya" → "Ya", "b" → "B"). */
export function bakukanMentah(raw: unknown, mentah: unknown): string | null {
  const c = normalisasiSkala(raw);
  const v = String(mentah ?? '').trim();
  if (typeof c === 'string' || c.tipe === 'group' || !v) return null;
  if (c.tipe === 'angka') return konversiNilai(c, v) === null ? null : String(Number(v));
  const kunci = c.tipe === 'yatidak' ? (v === '100' ? 'Ya' : v === '0' ? 'Tidak' : v) : v;
  return Object.keys(c.opsi!).find((k) => k.toLowerCase() === kunci.toLowerCase()) ?? null;
}

export function bulatkan(n: number): number {
  return Math.round(n * 100) / 100;
}

export interface IndikatorDinilai {
  id: number;
  dokumen_id: number;
  tahap: string;
  nama_indikator: string;
  nama_dokumen: string;
  config: any;
}

/**
 * Indikator yang benar-benar diberi skor: aktif, dokumennya aktif, bukan
 * label/group, dan bukan induk yang punya sub-indikator aktif.
 */
export function indikatorDinilai(dokumens: any[]): Map<number, IndikatorDinilai> {
  const hasil = new Map<number, IndikatorDinilai>();
  for (const d of dokumens || []) {
    if (d?.aktif === false) continue;
    const inds = (d.sv_indikator || d.indikators || []).filter((i: any) => i?.aktif !== false);
    const idAktif = new Set(inds.map((i: any) => Number(i.id)));
    const induk = new Set<number>();
    for (const i of inds) {
      const pid = Number(parseConfig(i.skala_config).parent_id);
      if (pid && idAktif.has(pid)) induk.add(pid);
    }
    for (const i of inds) {
      const c = parseConfig(i.skala_config);
      const pid = Number(c.parent_id);
      if (pid && !idAktif.has(pid)) continue; // sub dari induk yang sudah dihapus
      if (c.tipe === 'group' || induk.has(Number(i.id))) continue;
      hasil.set(Number(i.id), {
        id: Number(i.id), dokumen_id: Number(d.id), tahap: String(d.tahap || ''),
        nama_indikator: i.nama_indikator, nama_dokumen: d.nama_dokumen, config: c,
      });
    }
  }
  return hasil;
}

export function predikatDari(nilai: number | null): string {
  if (nilai === null) return '-';
  if (nilai >= 91) return 'Sangat Baik';
  if (nilai >= 76) return 'Baik';
  if (nilai >= 61) return 'Cukup';
  return 'Kurang';
}

export interface HasilPenilaian {
  per_tahap: Record<string, number | null>;
  rata_rata: number | null;
  predikat: string;
  dinilai: number;
  total: number;
  progres: number;
}

/**
 * Hitung nilai satu penugasan dari baris sv_rekam_nilai-nya. Nilai dihitung
 * ulang dari skor mentah (bukan kolom nilai_konversi yang tersimpan) supaya
 * baris lama tetap konsisten dengan rumus yang berlaku.
 */
export function hitungHasil(
  dinilai: Map<number, IndikatorDinilai>,
  rows: { indikator_id: number; nilai_mentah: string | null }[],
  tahapUrut?: string[],
): HasilPenilaian {
  const tahapList = tahapUrut || Array.from(new Set(Array.from(dinilai.values()).map((i) => i.tahap)));
  const kumpulan: Record<string, number[]> = {};
  tahapList.forEach((t) => (kumpulan[t] = []));
  let jumlah = 0;
  for (const r of rows || []) {
    const ind = dinilai.get(Number(r.indikator_id));
    if (!ind) continue;
    const n = konversiNilai(ind.config, r.nilai_mentah);
    if (n === null) continue;
    (kumpulan[ind.tahap] ||= []).push(n);
    jumlah++;
  }
  const per_tahap: Record<string, number | null> = {};
  const nilaiTahap: number[] = [];
  for (const t of Object.keys(kumpulan)) {
    const arr = kumpulan[t];
    per_tahap[t] = arr.length ? bulatkan(arr.reduce((a, b) => a + b, 0) / arr.length) : null;
    if (per_tahap[t] !== null) nilaiTahap.push(per_tahap[t] as number);
  }
  const rata_rata = nilaiTahap.length ? bulatkan(nilaiTahap.reduce((a, b) => a + b, 0) / nilaiTahap.length) : null;
  const total = dinilai.size;
  return {
    per_tahap,
    rata_rata,
    predikat: predikatDari(rata_rata),
    dinilai: jumlah,
    total,
    progres: total ? Math.min(100, Math.round((jumlah / total) * 100)) : 0,
  };
}
