-- Rename guru_id to nip in jadwal_guru
DO $$ 
BEGIN
    IF EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'jadwal_guru' AND column_name = 'guru_id') THEN
        ALTER TABLE jadwal_guru RENAME COLUMN guru_id TO nip;
    END IF;
END $$;

-- Rename guru_id to nip in absensi_sesi
DO $$ 
BEGIN
    IF EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'absensi_sesi' AND column_name = 'guru_id') THEN
        ALTER TABLE absensi_sesi RENAME COLUMN guru_id TO nip;
    END IF;
END $$;

-- Rename petugas_guru_id to petugas_nip in ketidakhadiran
DO $$ 
BEGIN
    IF EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'ketidakhadiran' AND column_name = 'petugas_guru_id') THEN
        ALTER TABLE ketidakhadiran RENAME COLUMN petugas_guru_id TO petugas_nip;
    END IF;
END $$;

-- Ensure users table is updated (in case previous optional migration didn't catch it)
DO $$ 
BEGIN
    IF EXISTS (SELECT FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'guru_id') THEN
        ALTER TABLE users RENAME COLUMN guru_id TO nip;
    END IF;
END $$;
