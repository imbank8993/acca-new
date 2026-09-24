/**
 * lib/print — Print & Document Generation Utilities
 *
 * Organized as follows:
 *
 *   constants.ts      — Shared values (template type keys, fallback paths, cache TTL)
 *   template-manager — Resolve template URL from cache / DB / public file
 *   docx-generator   — Render a .docx template with data via docxtemplater
 *   html-print       — Self-contained HTML print (Rekam Medis UKS)
 *
 * Example usage:
 *
 *   import { resolveTemplate, generateDocx } from '@/lib/print';
 *   const template = await resolveTemplate('IZIN_SINGLE');
 *   if (template) await generateDocx({ templateUrl: template.url, data, outputFilename });
 */

// ── Re-exports ─────────────────────────────────────────────────
export { TEMPLATE_TYPE, TEMPLATE_FILE_FALLBACKS, type TemplateType } from './constants';

export {
  fetchTemplateMap,
  clearTemplateCache,
  resolveTemplate,
  getTemplateUrl,
  type CachedTemplateMap,
} from './template-manager';

export { generateDocx, type DocxGenerateOptions } from './docx-generator';

export { generateRekamMedis } from './html-print';
export { buildRekapPrintHtml } from './rekam-medis-letter';
export { resolvePrintAssetUrl, A4_PAGE } from './print-utils';