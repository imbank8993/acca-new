-- Add audience column to informasi_akademik for per-role visibility
-- Values: 'umum' (all roles), 'guru', 'siswa', 'none' (hidden)
ALTER TABLE informasi_akademik
ADD COLUMN IF NOT EXISTS audience text DEFAULT 'umum';

UPDATE informasi_akademik SET audience = 'umum' WHERE audience IS NULL;

-- Keep legacy hidden documents hidden under the new scheme
UPDATE informasi_akademik SET audience = 'none' WHERE show_on_landing = false;
