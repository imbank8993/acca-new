-- Fix jadwal_piket column types + wrong FK
-- Error: "invalid input syntax for type bigint: ACCA-005"
-- Root cause: jadwal_piket.nip FK wrongly references master_guru.id (BIGINT) instead of master_guru.nip (TEXT)
--             kode_guru is also BIGINT but should be TEXT

BEGIN;

-- 1. Drop the wrong FK (jadwal_piket.nip -> master_guru.id)
ALTER TABLE jadwal_piket DROP CONSTRAINT IF EXISTS jadwal_piket_nip_fkey;

-- 2. Drop any CHECK constraints
ALTER TABLE jadwal_piket DROP CONSTRAINT IF EXISTS jadwal_piket_kode_guru_check;
ALTER TABLE jadwal_piket DROP CONSTRAINT IF EXISTS jadwal_piket_nip_check;

-- 3. Fix kode_guru: BIGINT -> TEXT
ALTER TABLE jadwal_piket ALTER COLUMN kode_guru TYPE TEXT USING kode_guru::TEXT;

-- 4. Fix nip: BIGINT -> TEXT
ALTER TABLE jadwal_piket ALTER COLUMN nip TYPE TEXT USING nip::TEXT;

-- 5. Add correct FK: jadwal_piket.nip -> master_guru.nip
ALTER TABLE jadwal_piket
    ADD CONSTRAINT jadwal_piket_nip_fkey
    FOREIGN KEY (nip) REFERENCES master_guru(nip)
    ON UPDATE CASCADE ON DELETE RESTRICT;

COMMIT;
