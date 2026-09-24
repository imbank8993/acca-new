-- ═══════════════════════════════════════════════════════════════
-- PTSP Bidirectional Status Sync via Database Triggers
-- Syncs status AND catatan_admin automatically on every UPDATE
-- ═══════════════════════════════════════════════════════════════

-- ── Trigger: ptsp_sosialisasi ───────────────────────────────────────────────
CREATE OR REPLACE FUNCTION trg_ptsp_sync_sosialisasi()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    -- Child → Master: sync status/catatan_admin to ptsp_master_tracking
    IF NEW.status IS DISTINCT FROM OLD.status OR NEW.catatan_admin IS DISTINCT FROM OLD.catatan_admin THEN
        UPDATE ptsp_master_tracking
        SET status = NEW.status,
            catatan_admin = COALESCE(NEW.catatan_admin, catatan_admin)
        WHERE id::text = NEW.tracking_token::text;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_ptsp_sync_sosialisasi ON ptsp_sosialisasi;
CREATE TRIGGER trg_ptsp_sync_sosialisasi
    AFTER UPDATE ON ptsp_sosialisasi
    FOR EACH ROW EXECUTE FUNCTION trg_ptsp_sync_sosialisasi();

-- ── Trigger: ptsp_master_tracking ───────────────────────────────────────────
CREATE OR REPLACE FUNCTION trg_ptsp_sync_master()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
    v_child_table TEXT;
BEGIN
    IF NEW.status IS DISTINCT FROM OLD.status OR NEW.catatan_admin IS DISTINCT FROM OLD.catatan_admin THEN
        -- Master → Child: find child table and sync status/catatan_admin
        SELECT table_name INTO v_child_table
        FROM ptsp_master_tracking
        WHERE id = NEW.id;

        IF v_child_table IS NOT NULL AND v_child_table != 'ptsp_master_tracking' THEN
            EXECUTE format(
                'UPDATE %I SET status = $1, catatan_admin = COALESCE($2, catatan_admin) WHERE tracking_token::text = $3',
                v_child_table
            ) USING NEW.status, NEW.catatan_admin, NEW.id::text;
        END IF;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_ptsp_sync_master ON ptsp_master_tracking;
CREATE TRIGGER trg_ptsp_sync_master
    AFTER UPDATE ON ptsp_master_tracking
    FOR EACH ROW EXECUTE FUNCTION trg_ptsp_sync_master();
