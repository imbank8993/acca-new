// ============================================================
// Form Builder - Complete Type Definitions
// Includes Conditional Logic & Advanced Validations
// ============================================================

export type FieldType =
  | 'text'
  | 'textarea'
  | 'number'
  | 'email'
  | 'phone'
  | 'url'
  | 'date'
  | 'time'
  | 'datetime'
  | 'select'
  | 'radio'
  | 'checkbox'
  | 'rating'
  | 'slider'
  | 'file'
  | 'heading'
  | 'paragraph'
  | 'divider'
  | 'page_break';

export interface FieldOption {
  label: string;
  value: string;
  score?: number; // Skor untuk opsi ini (jika fitur skoring diaktifkan)
}

export type ConditionOperator = 'equals' | 'not_equals' | 'contains' | 'is_not_empty' | 'is_empty';

export interface FieldCondition {
  targetFieldId: string;       // Field ID that triggers this condition
  operator: ConditionOperator;  // How to compare
  value?: string;              // Value to compare against
}

export interface FormField {
  id: string;
  type: FieldType;
  label: string;
  description?: string;
  placeholder?: string;
  required?: boolean;
  width?: 'full' | 'half' | 'third';
  options?: FieldOption[];          // select, radio, checkbox

  // Sumber Opsi Dinamis dari Database
  optionSource?: 'manual' | 'database';
  dataSource?: 'guru' | 'students' | 'kelas' | 'mapel';

  // Otomatis Isi Pengguna Logged-In ACCA
  autoFillUser?: 'name' | 'email' | 'nip_nis' | 'none';

  // Validations
  defaultValue?: string;
  minLength?: number;
  maxLength?: number;
  min?: number | string;            // number, date, time, slider
  max?: number | string;            // number, date, time, slider
  step?: number;                    // number, slider
  rows?: number;                    // textarea
  pattern?: string;                 // regex pattern
  patternMessage?: string;          // custom error message for regex
  minSelected?: number;             // checkbox min selection count
  maxSelected?: number;             // checkbox max selection count

  // File settings
  accept?: string;
  maxSize?: number;                 // MB
  multiple?: boolean;

  // Rating & Slider settings
  maxRating?: number;               // e.g., 5 or 10 stars
  photoUrl?: string;                // URL foto subjek yang dinilai (mis. foto guru/pegawai)

  // Heading, Paragraph & Page Break settings
  headingLevel?: 'h1' | 'h2' | 'h3';
  content?: string;                 // paragraph text/HTML
  pageTitle?: string;               // Judul bagian/halaman baru untuk page_break

  // ── Pertanyaan Bercabang (Conditional Logic) ──
  conditionAction?: 'show' | 'hide'; // Default: 'show'
  conditionLogic?: 'and' | 'or';     // Gabungan antar syarat. Default: 'and'
  conditions?: FieldCondition[];

  // ── Opsi Saling Meniadakan ──
  /**
   * Daftar FormField.id yang jawabannya mengunci opsi di field ini:
   * opsi yang sudah dipilih di field-field tersebut tidak ikut ditampilkan.
   * Kosong / tidak diisi = semua opsi selalu tampil.
   */
  excludeChosenFrom?: string[];

  // ── Skoring / Penilaian ──
  enableScoring?: boolean;         // Aktifkan mode kuis / skor untuk field ini
  scoreCategory?: string;          // Kategori skor (misal: "Skor Utama", "Skor Tie Breaker")
}

// ── Kuota & Seleksi Otomatis ──
export type PlacementStage = 'pilihan_1' | 'pilihan_2' | 'cadangan' | 'tidak_diterima';

export interface AllocationChoiceField {
  id: string;      // FormField.id — sumber kebenaran saat konfigurasi
  label: string;   // snapshot label; jawaban di custom_form_responses.data dikunci per label
}

export interface AllocationConfig {
  enabled?: boolean;
  /** Field pilihan, urut prioritas: [Pilihan Pertama, Pilihan Kedua, ...] */
  choiceFields: AllocationChoiceField[];
  /** Kuota per VALUE opsi (mis. { robotik: 25 }). Tidak diisi = tidak dibatasi. */
  quotas: Record<string, number>;
  /** Kategori skor urut prioritas untuk perankingan. '__total__' = total seluruh skor. */
  rankBy: string[];
  /** true = yang tidak tertampung jadi cadangan bernomor, false = langsung tidak diterima */
  waitlist?: boolean;
}

export interface FormSchema {
  display: string;
  description?: string;
  is_active?: boolean; // Whether the form is currently accepting responses
  fields: FormField[];
  allocation?: AllocationConfig;
}

export interface FormRecord {
  id: string;
  title: string;
  is_public: boolean;
  show_in_academic_navbar?: boolean;
  schema: FormSchema;
  created_at: string;
  response_count?: number;
}
