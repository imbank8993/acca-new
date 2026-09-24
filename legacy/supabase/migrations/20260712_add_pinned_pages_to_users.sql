-- Pin halaman sidebar disimpan per user di DB agar permanen
-- (sebelumnya hanya localStorage: hilang saat ganti browser / clear data).
-- Jalankan manual via Dashboard SQL Editor.

ALTER TABLE users ADD COLUMN IF NOT EXISTS pinned_pages JSONB NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN users.pinned_pages IS
    'Daftar id halaman yang disematkan (bintang) di sidebar, mis. ["jurnal","lckh"]. Dikelola via /api/user/pinned-pages.';
