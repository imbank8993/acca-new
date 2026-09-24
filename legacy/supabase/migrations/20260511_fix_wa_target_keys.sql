-- Migration: Fix WA target key naming for ketidakhadiran
-- wa_target_ketidakhadiran (singular) → wa_targets_ketidakhadiran (plural)
-- This matches the key used in wa-sender.ts and WhatsAppTab.tsx

-- =====================================================
-- 1. Fix: Rename incorrect key
-- =====================================================
DO $$
BEGIN
    -- If old key exists with value, update the new key
    IF EXISTS (SELECT 1 FROM site_settings WHERE key = 'wa_target_ketidakhadiran') THEN
        -- Check if new key already exists
        IF EXISTS (SELECT 1 FROM site_settings WHERE key = 'wa_targets_ketidakhadiran') THEN
            -- Merge: copy value from old to new, then delete old
            UPDATE site_settings s
            SET value = old.value, updated_at = NOW()
            FROM site_settings old
            WHERE s.key = 'wa_targets_ketidakhadiran' AND old.key = 'wa_target_ketidakhadiran';

            DELETE FROM site_settings WHERE key = 'wa_target_ketidakhadiran';
            RAISE NOTICE 'Merged wa_target_ketidakhadiran into wa_targets_ketidakhadiran and deleted old key';
        ELSE
            -- Simply rename
            UPDATE site_settings SET key = 'wa_targets_ketidakhadiran' WHERE key = 'wa_target_ketidakhadiran';
            RAISE NOTICE 'Renamed wa_target_ketidakahankan to wa_targets_ketidakhadiran';
        END IF;
    ELSE
        RAISE NOTICE 'wa_target_ketidakhadiran not found, skipping rename';
    END IF;
END $$;

-- =====================================================
-- 2. Ensure wa_targets_ketidakhadiran has correct value
-- =====================================================
INSERT INTO site_settings (key, label, description, value, is_active, created_at, updated_at)
VALUES (
    'wa_targets_ketidakhadiran',
    'Target WA Ketidakhadiran',
    'JSON array target untuk notifikasi ketidakhadiran. Format: [{id, name, code}]',
    '[{"id":"1","name":"Grup Guru","code":"120363407327239145@g.us"}]',
    true,
    NOW(),
    NOW()
)
ON CONFLICT (key) DO UPDATE SET
    label = EXCLUDED.label,
    description = EXCLUDED.description,
    value = EXCLUDED.value,
    updated_at = NOW();

-- =====================================================
-- 3. Also fix piket if same issue exists
-- =====================================================
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM site_settings WHERE key = 'wa_target_piket') THEN
        IF EXISTS (SELECT 1 FROM site_settings WHERE key = 'wa_targets_piket') THEN
            UPDATE site_settings s
            SET value = old.value, updated_at = NOW()
            FROM site_settings old
            WHERE s.key = 'wa_targets_piket' AND old.key = 'wa_target_piket';
            DELETE FROM site_settings WHERE key = 'wa_target_piket';
        ELSE
            UPDATE site_settings SET key = 'wa_targets_piket' WHERE key = 'wa_target_piket';
        END IF;
    END IF;
END $$;

INSERT INTO site_settings (key, label, description, value, is_active, created_at, updated_at)
VALUES (
    'wa_targets_piket',
    'Target WA Piket',
    'JSON array target untuk notifikasi piket. Format: [{id, name, code}]',
    '[{"id":"1","name":"Grup Guru","code":"120363407327239145@g.us"}]',
    true,
    NOW(),
    NOW()
)
ON CONFLICT (key) DO UPDATE SET
    label = EXCLUDED.label,
    description = EXCLUDED.description,
    value = EXCLUDED.value,
    updated_at = NOW();

-- =====================================================
-- 4. Also fix PTSP if same issue exists
-- =====================================================
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM site_settings WHERE key = 'wa_target_ptsp') THEN
        IF EXISTS (SELECT 1 FROM site_settings WHERE key = 'wa_targets_ptsp') THEN
            UPDATE site_settings s
            SET value = old.value, updated_at = NOW()
            FROM site_settings old
            WHERE s.key = 'wa_targets_ptsp' AND old.key = 'wa_target_ptsp';
            DELETE FROM site_settings WHERE key = 'wa_target_ptsp';
        ELSE
            UPDATE site_settings SET key = 'wa_targets_ptsp' WHERE key = 'wa_target_ptsp';
        END IF;
    END IF;
END $$;

INSERT INTO site_settings (key, label, description, value, is_active, created_at, updated_at)
VALUES (
    'wa_targets_ptsp',
    'Target WA PTSP',
    'JSON array target untuk notifikasi PTSP. Format: [{id, name, code}]',
    '[{"id":"1","name":"Grup Guru","code":"120363407327239145@g.us"}]',
    true,
    NOW(),
    NOW()
)
ON CONFLICT (key) DO UPDATE SET
    label = EXCLUDED.label,
    description = EXCLUDED.description,
    value = EXCLUDED.value,
    updated_at = NOW();

-- =====================================================
-- 5. Verify: Show all WA-related settings
-- =====================================================
SELECT key, label, value, is_active, updated_at
FROM site_settings
WHERE key LIKE 'wa_%' OR key LIKE 'notif_wa_%'
ORDER BY key;