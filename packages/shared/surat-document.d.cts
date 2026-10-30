export function suratFileName(nomor?: string | null, perihal?: string | null): string;
export interface EdaranMetadata {
  jenis_surat?: string | null;
  nomor_surat?: string | null;
  nomor_kode1_nama?: string | null;
  nomor_kode2_nama?: string | null;
  nomor_kode3_nama?: string | null;
  pejabat_jabatan?: string | null;
  penandatangan_jabatan?: string | null;
}
export function edaranDivision(letter?: string | EdaranMetadata | null): 'Akademik' | 'Kesiswaan' | null;
