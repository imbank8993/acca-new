import 'server-only'
import { prisma } from './prisma'
import { createPrismaDbAdapter } from './prisma-db-adapter'

/**
 * Akses database sisi server untuk kode yang masih ditulis bergaya klien Supabase
 * (`.from(tabel).select(...)`).
 *
 * SEBELUMNYA berkas ini bernama `lib/supabase-admin.ts` dan mengekspor
 * `supabaseAdmin`. Nama itu tinggal warisan: isinya sudah lama bukan Supabase.
 * Yang ada di dalamnya adalah `Proxy` yang membelokkan setiap `.from()` ke
 * `createPrismaDbAdapter(prisma)` — artinya seluruh query sudah berjalan di
 * PostgreSQL VPS lewat Prisma.
 *
 * Namanya diganti karena benar-benar menyesatkan: pencarian `supabaseAdmin` di
 * repo ini memunculkan puluhan hasil yang tampak seperti akses Supabase padahal
 * bukan, dan itu sempat membuat kesimpulan audit salah. Pola yang sama di
 * `keuangan.service.ts` dan `klinik.service.ts` sudah ikut dirapikan menjadi `db`.
 *
 * Klien Supabase yang asli sudah DIHAPUS dari berkas ini. Dulu ia tetap dibuat
 * untuk melayani properti selain `.from` (mis. `.auth`), tetapi tidak ada satu
 * pemakai pun yang tersisa setelah `lib/sync-auth-role.ts` dihapus.
 *
 * Untuk Supabase Storage — satu-satunya bagian Supabase yang memang masih
 * dipakai, khusus MENGHAPUS berkas lama — lihat `lib/storage/supabase-storage.ts`,
 * yang membuat kliennya sendiri.
 */
export const dbAdmin = createPrismaDbAdapter(prisma)
