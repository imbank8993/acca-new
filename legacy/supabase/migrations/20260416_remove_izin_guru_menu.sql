-- ============================================================
-- Remove IzinGuru menu from sidebar
-- Hapus menu "IzinGuru" dari sidebar untuk semua user
-- yang memiliki entry tersebut di kolom pages.
-- Variasi: "IzinGuru", "Izin Guru", "IzinGuru=IzinGuru", dll.
-- ============================================================

-- Hapus semua variasi: dengan/tanpa spasi, dengan/tanpa =IzinGuru, case-insensitive
UPDATE users
SET pages = trim(both ',' from regexp_replace(
        regexp_replace(pages, ',?Izin\s?Guru(?:=IzinGuru)?', 'i', 'g'),
        ',{2,}', ',', 'g'
    ))
WHERE pages ~* 'Izin ?Guru';

-- Verifikasi: tampilkan user yang masih punya IzinGuru
SELECT username, role, pages
FROM users
WHERE pages ~* 'Izin ?Guru';
