export interface CatatanBlock {
  type: 'paragraph' | 'checklist' | 'list-item';
  text: string;
  checked?: boolean; // only for checklist
}

export interface Catatan {
  id: number;
  user_id: number;
  jenis: 'catatan' | 'list';
  judul: string;
  isi: CatatanBlock[];
  label: string[];
  warna: CatatanWarna;
  tanggal_agenda: string | null; // YYYY-MM-DD
  waktu_agenda: string | null;   // HH:mm
  tempat_agenda: string | null;
  status: CatatanStatus;
  version: number;
  created_at: string;
  updated_at: string;
  trashed_at: string | null;
}

export type CatatanStatus = 'active' | 'pinned' | 'archived' | 'trashed';
export type CatatanJenis = 'catatan' | 'list';
export type CatatanWarna = `#${string}` | 'default' | 'red' | 'orange' | 'yellow' | 'green' | 'teal' | 'blue' | 'purple' | 'pink' | 'brown' | 'gray';

export interface KalenderAgenda {
  jenis?: CatatanJenis;
  warna?: CatatanWarna;
  id: number;
  judul: string;
  tanggal_agenda: string;
  waktu_agenda: string | null;
  status: CatatanStatus;
}

export interface ExportOptions {
  ids?: number[];
  bulan?: string; // YYYY-MM
  judul_dokumen: string;
  sertakan_kalender: boolean;
  bulan_kalender?: string; // YYYY-MM
}

export const WARNA_OPTIONS: { value: CatatanWarna; label: string; color: string; darkColor: string }[] = [
  { value: 'default', label: 'Default', color: '#ffffff', darkColor: '#1e293b' },
  { value: 'red', label: 'Merah', color: '#fef2f2', darkColor: '#3b1418' },
  { value: 'orange', label: 'Oranye', color: '#fff7ed', darkColor: '#3b2014' },
  { value: 'yellow', label: 'Kuning', color: '#fefce8', darkColor: '#3b3514' },
  { value: 'green', label: 'Hijau', color: '#f0fdf4', darkColor: '#143b1e' },
  { value: 'teal', label: 'Teal', color: '#f0fdfa', darkColor: '#143b35' },
  { value: 'blue', label: 'Biru', color: '#eff6ff', darkColor: '#14203b' },
  { value: 'purple', label: 'Ungu', color: '#faf5ff', darkColor: '#2d143b' },
  { value: 'pink', label: 'Merah Muda', color: '#fdf2f8', darkColor: '#3b1430' },
  { value: 'brown', label: 'Cokelat', color: '#faf5f0', darkColor: '#3b2a14' },
  { value: 'gray', label: 'Abu-abu', color: '#f8fafc', darkColor: '#1e2433' },
];

export const STATUS_LABELS: Record<CatatanStatus, string> = {
  active: 'Aktif',
  pinned: 'Disematkan',
  archived: 'Diarsipkan',
  trashed: 'Sampah',
};
