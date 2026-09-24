-- Buang kolom kredensial lama `public.users.password_hash`.
--
-- Kolom ini menyimpan password sebagai TEKS POLOS untuk 79 akun (2 sisanya
-- bcrypt). Login sudah tidak pernah membacanya lagi — cabang cadangan di
-- AuthService dicabut, dan tidak ada kode lain yang menulis atau menyeleksinya.
-- Satu-satunya tempat kredensial sekarang: `auth.users.encrypted_password`.
--
-- JALANKAN SETELAH scripts/reset-plaintext-passwords.js --apply.
-- Urutannya penting: satu akun (peran ORANG_TUA) belum punya baris auth_users,
-- sehingga sebelum skrip itu jalan, kolom ini adalah satu-satunya kredensialnya
-- dan menghapusnya lebih dulu akan mengunci akun tersebut.
--
-- Tidak reversibel: nilai lamanya hilang. Itu memang tujuannya — tapi pastikan
-- cadangan basis data terakhir Anda tidak ikut terpakai untuk memulihkan kolom
-- ini di kemudian hari.

ALTER TABLE public.users DROP COLUMN IF EXISTS password_hash;
