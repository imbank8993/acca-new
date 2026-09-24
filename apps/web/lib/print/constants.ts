/**
 * Shared constants for print/document generation
 * Single source of truth for all styled values used across print features.
 * Kept here so print-related modules stay DRY and style values stay in sync.
 */

/** Known template type keys used throughout the app */
export const TEMPLATE_TYPE = {
  IZIN_SINGLE:              'IZIN_SINGLE',
  IZIN_GROUP:                'IZIN_GROUP',
  TUGAS_SINGLE:             'TUGAS_SINGLE',
  TUGAS_GROUP:              'TUGAS_GROUP',
  REKAM_MEDIK:               'REKAM_MEDIK',
  // new types added 2026-05-16
  MENINGGALKAN_ASRAMA:       'MENINGGALKAN_ASRAMA',
  REKOMENDASI_KONTROL:       'REKOMENDASI_KONTROL',
} as const;

export type TemplateType = keyof typeof TEMPLATE_TYPE | string;

/**
 * Fallback mapping: template type → public file path.
 * Used when the database has no entry for a given type.
 * These are the physical .docx files stored under /public/templates/.
 */
export const TEMPLATE_FILE_FALLBACKS: Record<string, string> = {
  IZIN_SINGLE:            '/templates/template_surat_izin_pribadi.docx',
  IZIN_GROUP:             '/templates/template_surat_izin_pribadi_lampiran.docx',
  TUGAS_SINGLE:           '/templates/template_surat_tugas.docx',
  TUGAS_GROUP:            '/templates/template_surat_tugas_lampiran.docx',
  REKAM_MEDIK:            '/templates/template_surat_sakit.docx',
  MENINGGALKAN_ASRAMA:    '/templates/template_surat_izin_akhir_pekan.docx',
  REKOMENDASI_KONTROL:    '/templates/template_surat_rekomendasi_kontrol.docx',
};

/** How long to cache template URLs from the API (milliseconds). */
export const TEMPLATE_CACHE_TTL_MS = 60_000; // 1 minute
