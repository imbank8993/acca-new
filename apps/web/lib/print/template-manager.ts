/**
 * Template Manager
 * Single source of truth for resolving document templates.
 *
 * Resolution priority:
 *   1. In-memory cache (last 60s)
 *   2. Database (surat_templates table via /api/surat/templates/urls)
 *   3. Returns null if no template found — NO FALLBACK
 *
 * Call clearTemplateCache() after uploading a new template via the admin panel.
 */

import { TEMPLATE_CACHE_TTL_MS, type TemplateType } from './constants';

/** Shape of the data returned by GET /api/surat/templates/urls */
export interface CachedTemplateMap {
  [jenis_surat: string]: {
    id: string;
    nama_template: string;
    /** HTML string (stored directly in DB) — used as a fallback content source */
    template_html: string | null;
  };
}

interface TemplateResult {
  /** URL to fetch — either a public file path or an API path */
  url: string;
  /** What source provided this template */
  source: 'cache' | 'database' | 'file';
}

// ── Module-level cache ──────────────────────────────────────────
let _cache: CachedTemplateMap | null = null;
let _cacheTime = 0;

/**
 * Fetch and cache all templates from the database.
 * Returns the cached map on subsequent calls within TEMPLATE_CACHE_TTL_MS.
 */
export async function fetchTemplateMap(): Promise<CachedTemplateMap> {
  const now = Date.now();
  if (_cache && (now - _cacheTime) < TEMPLATE_CACHE_TTL_MS) {
    return _cache;
  }

  try {
    const res = await fetch('/api/surat/templates/urls');
    const json: { ok: boolean; data?: CachedTemplateMap } = await res.json();
    if (json.ok && json.data) {
      _cache = json.data;
      _cacheTime = now;
    }
  } catch (e) {
    console.warn('[template-manager] Failed to fetch template URLs from API:', e);
  }

  // Return whatever we have (may be stale or null — caller handles null case)
  return _cache || {};
}

/**
 * Invalidate the in-memory template cache.
 * Call this after the user uploads/changes a template in the admin panel.
 */
export function clearTemplateCache(): void {
  _cache = null;
  _cacheTime = 0;
}

/**
 * Resolve a template type to a URL.
 *
 * @param type        Template type key (e.g. 'IZIN_SINGLE', 'TUGAS_GROUP')
 * @returns           Template URL + source indicator, or null if no template found
 *
 * Resolution rules:
 *   1. template_html must be a valid HTTP(S) URL — raw HTML content is NOT a fetchable URL
 *   2. If template_html is null, empty, or raw HTML → returns null (NO FALLBACK)
 *   3. The caller decides what to do with the URL (fetch and render as docx)
 */
export async function resolveTemplate(type: TemplateType): Promise<TemplateResult | null> {
  const templateMap = await fetchTemplateMap();

  if (templateMap[type]) {
    const dbEntry = templateMap[type];
    // Only return a URL if template_html is a valid http(s) URL
    if (dbEntry?.template_html && typeof dbEntry.template_html === 'string' && dbEntry.template_html.trim().startsWith('http')) {
      return { url: dbEntry.template_html.trim(), source: 'database' };
    }
  }

  // NO FALLBACK — returns null so the caller shows "Admin belum mengatur template"
  return null;
}

/**
 * Convenience: resolve + check if template exists.
 * Returns undefined if the template can't be resolved.
 */
export async function getTemplateUrl(type: TemplateType): Promise<string | undefined> {
  const result = await resolveTemplate(type);
  return result?.url;
}