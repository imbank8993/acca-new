-- =====================================================
-- Migration: Insert WA configuration to site_settings
-- Generated: 2026-05-10
-- Purpose: Enable WA auto-messages with per-feature config
-- =====================================================

-- PIKET
INSERT INTO site_settings (key, label, description, value, is_active, created_at, updated_at)
VALUES ('wa_token_piket', 'Token API WA Piket', 'Token API untuk notifikasi laporan piket', '', true, NOW(), NOW())
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();

INSERT INTO site_settings (key, label, description, value, is_active, created_at, updated_at)
VALUES ('wa_target_piket', 'Target WA Piket', 'Group ID atau nomor WA untuk notifikasi piket', '', true, NOW(), NOW())
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();

INSERT INTO site_settings (key, label, description, value, is_active, created_at, updated_at)
VALUES ('notif_wa_piket', 'Notifikasi WA Piket', 'Aktifkan notifikasi WA piket', 'false', true, NOW(), NOW())
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();

-- KETIDAKHADIRAN
INSERT INTO site_settings (key, label, description, value, is_active, created_at, updated_at)
VALUES ('wa_token_ketidakhadiran', 'Token API WA Ketidakhadiran', 'Token API untuk notifikasi ketidakhadiran', '', true, NOW(), NOW())
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();

INSERT INTO site_settings (key, label, description, value, is_active, created_at, updated_at)
VALUES ('wa_target_ketidakhadiran', 'Target WA Ketidakhadiran', 'Group ID atau nomor WA untuk notifikasi ketidakhadiran', '', true, NOW(), NOW())
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();

INSERT INTO site_settings (key, label, description, value, is_active, created_at, updated_at)
VALUES ('notif_wa_ketidakhadiran', 'Notifikasi WA Ketidakhadiran', 'Aktifkan notifikasi WA ketidakhadiran', 'false', true, NOW(), NOW())
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();

-- PTSP
INSERT INTO site_settings (key, label, description, value, is_active, created_at, updated_at)
VALUES ('wa_token_ptsp', 'Token API WA PTSP', 'Token API untuk notifikasi PTSP', '', true, NOW(), NOW())
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();

INSERT INTO site_settings (key, label, description, value, is_active, created_at, updated_at)
VALUES ('wa_target_ptsp', 'Target WA PTSP', 'Group ID atau nomor WA untuk notifikasi PTSP', '', true, NOW(), NOW())
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();

INSERT INTO site_settings (key, label, description, value, is_active, created_at, updated_at)
VALUES ('notif_wa_ptsp', 'Notifikasi WA PTSP', 'Aktifkan notifikasi WA PTSP', 'false', true, NOW(), NOW())
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW();

-- Verify
SELECT key, label, value, is_active FROM site_settings WHERE key LIKE 'wa_%' OR key LIKE 'notif_wa_%';
