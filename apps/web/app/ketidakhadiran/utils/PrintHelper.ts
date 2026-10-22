/**
 * PrintHelper — Thin compatibility shim
 *
 * All heavy logic has been moved to lib/print/. This file exists only to
 * maintain backward compatibility for existing import paths:
 *
 *   import { generateFromTemplate, ... } from '@/app/ketidakhadiran/utils/PrintHelper'
 *
 * For new code, prefer importing directly from lib/print:
 *
 *   import { generateDocx, resolveTemplate, ... } from '@/lib/print'
 */

// ── Re-exports (match the original exported names) ─────────────
export {
  fetchTemplateMap as getTemplateUrls,
  clearTemplateCache,
  resolveTemplate,
  getTemplateUrl,
} from '@/lib/print/template-manager';

// Re-export both names so existing call sites keep working
export { generateDocx } from '@/lib/print/docx-generator';

import { generateDocx } from '@/lib/print/docx-generator';

/**
 * Compatibility wrapper: accepts 3 positional args (old signature).
 * Internally delegates to generateDocx(options).
 */
export async function generateFromTemplate(
  templateUrl: string,
  data: Record<string, unknown>,
  outputFilename: string,
  qrCodeUrl?: string,
): Promise<void> {
  return generateDocx({ templateUrl, data, outputFilename, qrCodeUrl });
}

export { generateRekamMedis } from '@/lib/print/html-print';

// Browser callers use the authenticated PDF endpoints. Do not re-export the
// legacy pdf-letter module here: it imports Prisma and Node HTTPS at runtime.

// ── formatDataForPrint — kept here for backward compatibility ──
import type { KetidakhadiranRow } from './types';

function formatDate(dateString: string | undefined): string {
  if (!dateString) return '-';
  return new Date(dateString).toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function getDayName(dateString: string | undefined): string {
  if (!dateString) return '-';
  return new Date(dateString).toLocaleDateString('id-ID', { weekday: 'long' });
}

/**
 * Format a KetidakhadiranRow for use in docxtemplater templates.
 * Adds computed fields like formatted dates, day names, and template-friendly labels.
 */
export function formatDataForPrint(row: KetidakhadiranRow) {
  const hari_mulai = getDayName(row.tgl_mulai);
  const hari_selesai = getDayName(row.tgl_selesai);
  const isSameDay = row.tgl_mulai === row.tgl_selesai;

  // Split Keterangan by '|'
  const ketParts = (row.keterangan || '').split('|').map((s: string) => s.trim());
  const ket_1 = ketParts[0] || '';
  const ket_2 = ketParts[1] || '';
  const ket_3 = ketParts[2] || '';

  const tgl_mulai_fmt = formatDate(row.tgl_mulai);
  const tgl_selesai_fmt = formatDate(row.tgl_selesai);

  return {
    ...row,
    tgl_mulai_fmt,
    tgl_selesai_fmt,
    tgl_range: isSameDay ? tgl_mulai_fmt : `${tgl_mulai_fmt} s.d. ${tgl_selesai_fmt}`,

    hari_mulai,
    hari_selesai,
    hari_range: isSameDay ? hari_mulai : `${hari_mulai} s.d. ${hari_selesai}`,

    // Keterangan Parts
    keterangan: (row.keterangan || '').replace(/\|/g, ', '), // Clean version for standard view
    ket_1,
    ket_2,
    ket_3,

    is_one_day: isSameDay,
    is_multi_day: !isSameDay,

    today: formatDate(new Date().toISOString()),
    today_hari: getDayName(new Date().toISOString()),
    current_year: new Date().getFullYear(),
    is_izin: row.jenis === 'IZIN',
    is_sakit: row.jenis === 'SAKIT',
  };
}
