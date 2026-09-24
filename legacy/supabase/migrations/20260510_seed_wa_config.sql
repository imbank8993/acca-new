-- =====================================================
-- Seed WA configuration from existing working values
-- Generated: 2026-05-10
-- Purpose: Populate WA config with working values
-- =====================================================
--
-- CATATAN KEAMANAN (2026-09-10):
-- Berkas ini semula memuat token Fonnte asli sebagai teks biasa, dan sudah
-- terlanjur ikut ter-push ke repo. Nilainya diganti placeholder di sini, TAPI
-- itu tidak membatalkan kebocoran yang sudah terjadi — token lamanya wajib
-- dirotasi di dashboard Fonnte.
--
-- Isi token yang baru lewat halaman Pengaturan aplikasi (site_settings), atau
-- jalankan UPDATE di bawah secara manual dengan nilai sebenarnya. JANGAN
-- menuliskan token asli kembali ke berkas ini.

-- PIKET
UPDATE site_settings SET value = '<ISI_TOKEN_FONNTE>' WHERE key = 'wa_token_piket';
UPDATE site_settings SET value = '<ISI_ID_GRUP_WA>' WHERE key = 'wa_target_piket';
UPDATE site_settings SET value = 'true' WHERE key = 'notif_wa_piket';

-- KETIDAKHADIRAN
UPDATE site_settings SET value = '<ISI_TOKEN_FONNTE>' WHERE key = 'wa_token_ketidakhadiran';
UPDATE site_settings SET value = '<ISI_ID_GRUP_WA>' WHERE key = 'wa_target_ketidakhadiran';
UPDATE site_settings SET value = 'true' WHERE key = 'notif_wa_ketidakhadiran';

-- PTSP
UPDATE site_settings SET value = '<ISI_TOKEN_FONNTE>' WHERE key = 'wa_token_ptsp';
UPDATE site_settings SET value = '<ISI_ID_GRUP_WA>' WHERE key = 'wa_target_ptsp';
UPDATE site_settings SET value = 'true' WHERE key = 'notif_wa_ptsp';

-- Verify
SELECT key, label, value, is_active FROM site_settings WHERE key LIKE 'wa_%' OR key LIKE 'notif_wa_%';
