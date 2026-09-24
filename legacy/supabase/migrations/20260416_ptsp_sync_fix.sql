-- Migration: Ensure PTSP bidirectional status sync works
-- ptsp_child.tracking_token = ptsp_master_tracking.id

-- ── 1. Add catatan_admin to ptsp_master_tracking ────────────────────────────
ALTER TABLE ptsp_master_tracking ADD COLUMN IF NOT EXISTS catatan_admin TEXT;

-- ── 2. Add tracking_token to all child tables (if not exists) ────────────────
DO $$
DECLARE
    col_type text;
BEGIN
    -- ptsp_sosialisasi
    SELECT data_type INTO col_type FROM information_schema.columns
    WHERE table_name = 'ptsp_sosialisasi' AND column_name = 'tracking_token';
    IF col_type IS NULL THEN
        ALTER TABLE ptsp_sosialisasi ADD COLUMN tracking_token UUID;
    END IF;

    -- ptsp_buku_tamu
    SELECT data_type INTO col_type FROM information_schema.columns
    WHERE table_name = 'ptsp_buku_tamu' AND column_name = 'tracking_token';
    IF col_type IS NULL THEN
        ALTER TABLE ptsp_buku_tamu ADD COLUMN tracking_token UUID;
    END IF;

    -- ptsp_izin_siswa
    SELECT data_type INTO col_type FROM information_schema.columns
    WHERE table_name = 'ptsp_izin_siswa' AND column_name = 'tracking_token';
    IF col_type IS NULL THEN
        ALTER TABLE ptsp_izin_siswa ADD COLUMN tracking_token UUID;
    END IF;

    -- ptsp_izin_magang
    SELECT data_type INTO col_type FROM information_schema.columns
    WHERE table_name = 'ptsp_izin_magang' AND column_name = 'tracking_token';
    IF col_type IS NULL THEN
        ALTER TABLE ptsp_izin_magang ADD COLUMN tracking_token UUID;
    END IF;

    -- ptsp_legalisir
    SELECT data_type INTO col_type FROM information_schema.columns
    WHERE table_name = 'ptsp_legalisir' AND column_name = 'tracking_token';
    IF col_type IS NULL THEN
        ALTER TABLE ptsp_legalisir ADD COLUMN tracking_token UUID;
    END IF;

    -- ptsp_mutasi_siswa
    SELECT data_type INTO col_type FROM information_schema.columns
    WHERE table_name = 'ptsp_mutasi_siswa' AND column_name = 'tracking_token';
    IF col_type IS NULL THEN
        ALTER TABLE ptsp_mutasi_siswa ADD COLUMN tracking_token UUID;
    END IF;

    -- ptsp_pengganti_ijazah
    SELECT data_type INTO col_type FROM information_schema.columns
    WHERE table_name = 'ptsp_pengganti_ijazah' AND column_name = 'tracking_token';
    IF col_type IS NULL THEN
        ALTER TABLE ptsp_pengganti_ijazah ADD COLUMN tracking_token UUID;
    END IF;

    -- ptsp_peminjaman_sarana
    SELECT data_type INTO col_type FROM information_schema.columns
    WHERE table_name = 'ptsp_peminjaman_sarana' AND column_name = 'tracking_token';
    IF col_type IS NULL THEN
        ALTER TABLE ptsp_peminjaman_sarana ADD COLUMN tracking_token UUID;
    END IF;

    -- ptsp_izin_penelitian
    SELECT data_type INTO col_type FROM information_schema.columns
    WHERE table_name = 'ptsp_izin_penelitian' AND column_name = 'tracking_token';
    IF col_type IS NULL THEN
        ALTER TABLE ptsp_izin_penelitian ADD COLUMN tracking_token UUID;
    END IF;

    -- ptsp_pengaduan
    SELECT data_type INTO col_type FROM information_schema.columns
    WHERE table_name = 'ptsp_pengaduan' AND column_name = 'tracking_token';
    IF col_type IS NULL THEN
        ALTER TABLE ptsp_pengaduan ADD COLUMN tracking_token UUID;
    END IF;
END;
$$;

-- ── 3. Add tracking_token to ptsp_master_tracking if not exists ────────────
ALTER TABLE ptsp_master_tracking ADD COLUMN IF NOT EXISTS tracking_token UUID;

-- ── 4. Sync status from child → master (where already linked) ───────────────
UPDATE ptsp_master_tracking m SET status = c.status
FROM ptsp_sosialisasi c WHERE c.tracking_token::text = m.id::text AND c.status IS NOT NULL;
UPDATE ptsp_master_tracking m SET status = c.status
FROM ptsp_buku_tamu c WHERE c.tracking_token::text = m.id::text AND c.status IS NOT NULL;
UPDATE ptsp_master_tracking m SET status = c.status
FROM ptsp_izin_siswa c WHERE c.tracking_token::text = m.id::text AND c.status IS NOT NULL;
UPDATE ptsp_master_tracking m SET status = c.status
FROM ptsp_izin_magang c WHERE c.tracking_token::text = m.id::text AND c.status IS NOT NULL;
UPDATE ptsp_master_tracking m SET status = c.status
FROM ptsp_legalisir c WHERE c.tracking_token::text = m.id::text AND c.status IS NOT NULL;
UPDATE ptsp_master_tracking m SET status = c.status
FROM ptsp_mutasi_siswa c WHERE c.tracking_token::text = m.id::text AND c.status IS NOT NULL;
UPDATE ptsp_master_tracking m SET status = c.status
FROM ptsp_pengganti_ijazah c WHERE c.tracking_token::text = m.id::text AND c.status IS NOT NULL;
UPDATE ptsp_master_tracking m SET status = c.status
FROM ptsp_peminjaman_sarana c WHERE c.tracking_token::text = m.id::text AND c.status IS NOT NULL;
UPDATE ptsp_master_tracking m SET status = c.status
FROM ptsp_izin_penelitian c WHERE c.tracking_token::text = m.id::text AND c.status IS NOT NULL;
UPDATE ptsp_master_tracking m SET status = c.status
FROM ptsp_pengaduan c WHERE c.tracking_token::text = m.id::text AND c.status IS NOT NULL;

-- ── 5. Create stored functions for API sync ────────────────────────────────────
-- Sync from CHILD table → ptsp_master_tracking
CREATE OR REPLACE FUNCTION ptsp_sync_child_to_master(
    p_child_table   TEXT,
    p_child_id      BIGINT,
    p_status        INTEGER,
    p_catatan_admin TEXT DEFAULT NULL
) RETURNS VOID AS $$
DECLARE
    v_tt TEXT;
    v_real_table TEXT;
BEGIN
    -- Ensure we use the correct table name (with ptsp_ prefix)
    v_real_table := CASE 
        WHEN p_child_table LIKE 'ptsp_%' THEN p_child_table 
        ELSE 'ptsp_' || p_child_table 
    END;

    -- Get the tracking value from child
    EXECUTE format('SELECT tracking_token::text FROM %I WHERE id = $1', v_real_table)
    INTO v_tt USING p_child_id;

    IF v_tt IS NOT NULL THEN
        -- Link can be either master.id OR master.tracking_token
        UPDATE ptsp_master_tracking
        SET status = COALESCE(p_status, status),
            catatan_admin = COALESCE(p_catatan_admin, catatan_admin),
            updated_at = NOW()
        WHERE id::text = v_tt OR tracking_token::text = v_tt;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Sync from MASTER → child table
CREATE OR REPLACE FUNCTION ptsp_sync_master_to_child(
    p_master_id     UUID,
    p_status        INTEGER,
    p_catatan_admin TEXT DEFAULT NULL
) RETURNS VOID AS $$
DECLARE
    v_child_table TEXT;
    v_real_table TEXT;
    v_master_tt TEXT;
BEGIN
    -- Get table name and the token from master
    SELECT table_name, tracking_token::text INTO v_child_table, v_master_tt
    FROM ptsp_master_tracking
    WHERE id = p_master_id;

    IF v_child_table IS NOT NULL AND v_child_table != 'ptsp_master_tracking' THEN
        -- Add 'ptsp_' prefix if missing
        v_real_table := CASE 
            WHEN v_child_table LIKE 'ptsp_%' THEN v_child_table 
            ELSE 'ptsp_' || v_child_table 
        END;

        -- Update child where child.tracking_token matches master.id OR master.tracking_token
        EXECUTE format(
            'UPDATE %I SET status = COALESCE($1, status), catatan_admin = COALESCE($2, catatan_admin) WHERE tracking_token::text = $3 OR tracking_token::text = $4',
            v_real_table
        ) USING p_status, p_catatan_admin, p_master_id::text, v_master_tt;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

