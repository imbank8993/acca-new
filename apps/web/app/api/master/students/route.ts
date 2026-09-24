/**
 * Route data master siswa — GET/POST/PUT/DELETE.
 *
 * Implementasi lama menulis langsung ke Supabase cloud. Sekarang diteruskan ke
 * backend NestJS yang menggunakan Prisma → PostgreSQL VPS (194.233.81.192).
 *
 * Sub-route `/card`, `/bulk-status`, dan `/verify` TIDAK ikut bermigrasi karena
 * mengakses tabel lain (student_cards, siswa_kelas) dengan logika khusus.
 */
import { masterRouteHandlers } from '@/lib/master-proxy';

export const dynamic = 'force-dynamic';

const { GET, POST, PUT, DELETE, OPTIONS } = masterRouteHandlers('siswa');
export { GET, POST, PUT, DELETE, OPTIONS };
