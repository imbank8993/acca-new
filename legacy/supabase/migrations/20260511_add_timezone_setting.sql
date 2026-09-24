-- Add timezone setting to site_settings
-- This allows schools to configure their timezone (WIB, WITA, WIT)

INSERT INTO site_settings (key, label, description, value, message)
VALUES (
    'timezone',
    'Zona Waktu',
    'Pengaturan zona waktu sekolah (Asia/Jakarta=WIB, Asia/Makassar=WITA, Asia/Jayapura=WIT)',
    'Asia/Makassar',
    NULL
)
ON CONFLICT (key) DO NOTHING;