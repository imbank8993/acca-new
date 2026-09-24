-- Lingkup hari libur: libur bisa berlaku untuk seluruh madrasah, untuk tingkat
-- tertentu, atau untuk daftar kelas tertentu.
--
-- Kolom ini sudah lama diasumsikan ada oleh apps/web/lib/libur.ts (komentarnya
-- menyebut "migrasi 20260827") dan dikirim oleh form tab Data Libur, tetapi
-- belum pernah benar-benar dibuat — sehingga pilihan lingkup dibuang diam-diam
-- oleh server dan semua baris selalu kembali sebagai "Semua".
--
-- Aditif dan idempoten: menambah dua kolom nullable/berdefault, tidak mengubah
-- maupun menghapus data yang ada. Baris lama punya lingkup NULL dan
-- target_kelas '{}', yang dibaca sebagai 'semua' — perilakunya persis seperti
-- sebelum kolom ini ada.

ALTER TABLE public.libur
  ADD COLUMN IF NOT EXISTS lingkup      text,
  ADD COLUMN IF NOT EXISTS target_kelas text[] NOT NULL DEFAULT '{}';
