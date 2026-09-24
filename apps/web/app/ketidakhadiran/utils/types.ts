/** Shared TypeScript types for the ketidakhadiran feature */

export interface KetidakhadiranRow {
  id?: string | number;
  nisn?: string;
  nama?: string;
  kelas?: string;
  jenis?: 'IZIN' | 'SAKIT' | 'TUGAS';
  status?: string;
  tgl_mulai?: string;
  tgl_selesai?: string;
  keterangan?: string;
  foto_url?: string;
  file_url?: string;
  lampiran_count?: number;
  lampiran_guru_ids?: string[];
  lampiran_siswa_ids?: string[];
  nomor_surat?: string;
  perkara?: string;
  lampiran?: string;
  kepada?: string;
  alamat_tujuan?: string;
  pembuka?: string;
  paragraf?: string;
  penutup?: string;
  tempat_ttd?: string;
  tanggal_ttd?: string;
  pejabat_nama?: string;
  pejabat_jabatan?: string;
  pejabat_nip?: string;
  created_by?: string;
  created_at?: string;
  // Rekam Medik fields
  tindakan?: string;
  tindak_lanjut?: string;
  petugas_nama?: string;
}