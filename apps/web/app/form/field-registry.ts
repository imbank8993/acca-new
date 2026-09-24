// ============================================================
// Field Registry — 18 Field Types Definition
// Includes icons, descriptions, groupings, and defaults
// ============================================================

import { FieldType, FormField } from './types';

export interface FieldDefinition {
  type: FieldType;
  label: string;
  icon: string;
  description: string;
  defaultField: Omit<FormField, 'id'>;
}

export const FIELD_REGISTRY: FieldDefinition[] = [
  // ── Input Dasar ──
  {
    type: 'text',
    label: 'Teks Singkat',
    icon: 'bi-input-cursor-text',
    description: 'Input teks satu baris (misal: Nama, NISN)',
    defaultField: {
      type: 'text',
      label: 'Teks Singkat',
      placeholder: 'Masukkan teks...',
      required: false,
      width: 'full',
    },
  },
  {
    type: 'textarea',
    label: 'Teks Panjang',
    icon: 'bi-textarea-t',
    description: 'Area teks multi-baris (misal: Alamat, Catatan)',
    defaultField: {
      type: 'textarea',
      label: 'Teks Panjang',
      placeholder: 'Masukkan penjelasan lengkap...',
      required: false,
      width: 'full',
      rows: 4,
    },
  },
  {
    type: 'number',
    label: 'Angka',
    icon: 'bi-123',
    description: 'Input angka kuantitatif',
    defaultField: {
      type: 'number',
      label: 'Angka',
      placeholder: '0',
      required: false,
      width: 'half',
    },
  },
  {
    type: 'email',
    label: 'Email',
    icon: 'bi-envelope',
    description: 'Input alamat email valid',
    defaultField: {
      type: 'email',
      label: 'Alamat Email',
      placeholder: 'contoh@email.com',
      required: false,
      width: 'full',
    },
  },
  {
    type: 'phone',
    label: 'Nomor Telepon',
    icon: 'bi-telephone',
    description: 'Input nomor HP/WhatsApp',
    defaultField: {
      type: 'phone',
      label: 'Nomor Telepon / WA',
      placeholder: '0812xxxxxxxx',
      required: false,
      width: 'half',
    },
  },
  {
    type: 'url',
    label: 'Tautan / URL',
    icon: 'bi-link-45deg',
    description: 'Input link website/drive',
    defaultField: {
      type: 'url',
      label: 'Link Website / Dokumen',
      placeholder: 'https://...',
      required: false,
      width: 'full',
    },
  },

  // ── Waktu & Tanggal ──
  {
    type: 'date',
    label: 'Tanggal',
    icon: 'bi-calendar3',
    description: 'Pemilih tanggal (DD/MM/YYYY)',
    defaultField: {
      type: 'date',
      label: 'Tanggal',
      required: false,
      width: 'half',
    },
  },
  {
    type: 'time',
    label: 'Waktu / Jam',
    icon: 'bi-clock',
    description: 'Pemilih jam & menit (HH:MM)',
    defaultField: {
      type: 'time',
      label: 'Waktu / Jam',
      required: false,
      width: 'half',
    },
  },
  {
    type: 'datetime',
    label: 'Tanggal & Waktu',
    icon: 'bi-calendar-event',
    description: 'Pemilih tanggal sekaligus jam',
    defaultField: {
      type: 'datetime',
      label: 'Tanggal & Waktu',
      required: false,
      width: 'full',
    },
  },

  // ── Pilihan & Skala ──
  {
    type: 'select',
    label: 'Pilihan Dropdown',
    icon: 'bi-chevron-down',
    description: 'Menu tarik-turun (pilihan tunggal)',
    defaultField: {
      type: 'select',
      label: 'Pilihan',
      required: false,
      width: 'full',
      options: [
        { label: 'Pilihan 1', value: 'option_1' },
        { label: 'Pilihan 2', value: 'option_2' },
        { label: 'Pilihan 3', value: 'option_3' },
      ],
    },
  },
  {
    type: 'radio',
    label: 'Pilihan Tunggal (Radio)',
    icon: 'bi-ui-radios',
    description: 'Radio button (pilih 1 dari n)',
    defaultField: {
      type: 'radio',
      label: 'Pilihan Tunggal',
      required: false,
      width: 'full',
      options: [
        { label: 'Pilihan A', value: 'a' },
        { label: 'Pilihan B', value: 'b' },
        { label: 'Pilihan C', value: 'c' },
      ],
    },
  },
  {
    type: 'checkbox',
    label: 'Pilihan Ganda (Checkbox)',
    icon: 'bi-ui-checks',
    description: 'Kotak centang (bisa pilih lebih dari satu)',
    defaultField: {
      type: 'checkbox',
      label: 'Pilihan Ganda',
      required: false,
      width: 'full',
      options: [
        { label: 'Opsi A', value: 'a' },
        { label: 'Opsi B', value: 'b' },
        { label: 'Opsi C', value: 'c' },
      ],
    },
  },
  {
    type: 'rating',
    label: 'Rating',
    icon: 'bi-star-fill',
    description: 'Skala penilaian bintang (1 - 5 atau 1 - 10)',
    defaultField: {
      type: 'rating',
      label: 'Penilaian / Rating',
      required: false,
      width: 'half',
      maxRating: 5,
    },
  },
  {
    type: 'slider',
    label: 'Slider Skala',
    icon: 'bi-sliders',
    description: 'Geser skala angka (misal: 1 s.d 100)',
    defaultField: {
      type: 'slider',
      label: 'Tingkat Kepuasan',
      required: false,
      width: 'full',
      min: 1,
      max: 10,
      step: 1,
    },
  },

  // ── File & Layout ──
  {
    type: 'file',
    label: 'Upload File',
    icon: 'bi-paperclip',
    description: 'Upload dokumen PDF, gambar, dll',
    defaultField: {
      type: 'file',
      label: 'Upload Dokumen',
      required: false,
      width: 'full',
      accept: '.pdf,.jpg,.jpeg,.png',
      maxSize: 5,
      multiple: false,
    },
  },
  {
    type: 'heading',
    label: 'Judul Halaman / Subjudul',
    icon: 'bi-type-h1',
    description: 'Teks judul besar untuk membagi halaman',
    defaultField: {
      type: 'heading',
      label: 'Subjudul Bagian',
      headingLevel: 'h2',
      width: 'full',
    },
  },
  {
    type: 'paragraph',
    label: 'Teks Penjelasan / Instruksi',
    icon: 'bi-text-paragraph',
    description: 'Paragraf instruksi atau deskripsi tambahan',
    defaultField: {
      type: 'paragraph',
      label: 'Teks Instruksi',
      content: 'Silakan isi formulir berikut dengan data yang benar dan sah.',
      width: 'full',
    },
  },
  {
    type: 'divider',
    label: 'Garis Pemisah',
    icon: 'bi-hr',
    description: 'Garis horizontal pemisah antar bagian',
    defaultField: {
      type: 'divider',
      label: 'Garis Pemisah',
      width: 'full',
    },
  },
  {
    type: 'page_break',
    label: 'Pemisah Halaman (Page Break)',
    icon: 'bi-signpost-split',
    description: 'Membagi formulir menjadi beberapa bagian / langkah (Multi-Step)',
    defaultField: {
      type: 'page_break',
      label: 'Halaman Baru',
      pageTitle: 'Bagian Baru',
      width: 'full',
    },
  },
];

export const FIELD_GROUPS = [
  {
    label: 'Input Teks & Data',
    types: ['text', 'textarea', 'number', 'email', 'phone', 'url'] as FieldType[],
  },
  {
    label: 'Tanggal & Waktu',
    types: ['date', 'time', 'datetime'] as FieldType[],
  },
  {
    label: 'Pilihan & Skala',
    types: ['select', 'radio', 'checkbox', 'rating', 'slider'] as FieldType[],
  },
  {
    label: 'Upload & Tata Letak',
    types: ['file', 'heading', 'paragraph', 'divider', 'page_break'] as FieldType[],
  },
];

export function getFieldDef(type: FieldType): FieldDefinition {
  return FIELD_REGISTRY.find((f) => f.type === type) ?? FIELD_REGISTRY[0];
}
