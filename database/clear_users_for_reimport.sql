-- =====================================================
-- CLEAR ALL USERS DATA FOR RE-IMPORT
-- Jalankan di Supabase SQL Editor
-- ⚠️ PERINGATAN: Ini akan menghapus SEMUA data user!
-- =====================================================

-- 1. Hapus tabel-tabel yang punya FK ke public.users(id)
TRUNCATE TABLE public.document_shares CASCADE;
TRUNCATE TABLE public.user_documents CASCADE;
TRUNCATE TABLE public.document_folders CASCADE;
TRUNCATE TABLE public.folder_shares CASCADE;
TRUNCATE TABLE public.user_settings CASCADE;

-- 2. Hapus data LCKH yang terkait user
TRUNCATE TABLE public.lckh_entries CASCADE;

-- 3. Hapus semua user dari auth.users (Supabase Auth)
--    Ini akan menghapus session & auth data
DELETE FROM auth.users;

-- 4. Hapus semua data dari tabel public.users
TRUNCATE TABLE public.users CASCADE;

-- 5. Reset sequence ID supaya mulai dari 1 lagi
ALTER SEQUENCE users_id_seq RESTART WITH 1;

-- =====================================================
-- SELESAI! Sekarang bisa import ulang data users.
-- Setelah import, user perlu login ulang agar 
-- auth_id otomatis dibuat.
-- =====================================================
