/**
 * Helper penyusun tampilan menu.
 *
 * Resolusi halaman efektif (union role_pages + overrides) sudah pindah ke
 * backend NestJS di atas PostgreSQL VPS — lihat `backend/src/access/`.
 * Yang tersisa di sini murni presentasi: mengubah daftar page id menjadi
 * string `Label=id,...` yang dipakai `parsePages()` untuk membangun sidebar.
 */
import { PAGE_LABELS, humanize } from './sidebar-menu'

/** Build the legacy `Label=id,...` pages string from a list of ids. */
export function toPagesString(ids: string[]): string {
  return ids.map(id => `${PAGE_LABELS[id] || humanize(id)}=${id}`).join(',')
}
