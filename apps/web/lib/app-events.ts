/**
 * Nama event lintas-komponen di shell dashboard.
 *
 * Dipakai untuk menghubungkan komponen yang bertetangga di layout tapi tidak
 * berbagi state — pola yang sudah ada di app/(dashboard)/layout.tsx
 * ('refresh-user', 'navigate-to-page'). Dikumpulkan di sini supaya Header dan
 * BottomNav tidak perlu saling impor (yang akan menyeret CSS satu sama lain).
 */

/** BottomNav → Header: buka panel notifikasi. */
export const OPEN_NOTIFICATIONS_EVENT = 'acca:open-notifications'

/** Header → BottomNav: jumlah notifikasi belum dibaca (`detail: number`). */
export const NOTIF_COUNT_EVENT = 'acca:notif-count'
