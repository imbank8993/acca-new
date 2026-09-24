-- Migration: PTSP WhatsApp Notification Queue
-- INSERT status=1  → "Data masuk, dalam antrian"
-- UPDATE status=0  → "Permohonan ditolak"
-- UPDATE status=100 → "Permohonan selesai"
-- Queue processed by /api/ptsp/notify-wa cron
-- Date: 2026-04-16

-- ============================================================
-- 1. QUEUE TABLE: ptsp_wa_log
-- Stores pending/sent WA notification records
-- ============================================================
CREATE TABLE IF NOT EXISTS ptsp_wa_log (
    id              BIGSERIAL PRIMARY KEY,
    tracking_id     UUID NOT NULL,
    short_code      VARCHAR(50) NOT NULL,
    no_wa           VARCHAR(30) NOT NULL,
    service_type    VARCHAR(100),
    status_changed  INTEGER NOT NULL,           -- 1 (submit), 0 (ditolak), 100 (selesai)
    catatan_admin   TEXT,
    message_sent    TEXT,
    wa_sent         BOOLEAN DEFAULT FALSE,
    wa_sent_at      TIMESTAMPTZ,
    wa_response     TEXT,
    retry_count     INTEGER DEFAULT 0,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Only service_role can read/write
ALTER TABLE ptsp_wa_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Service role all on ptsp_wa_log" ON ptsp_wa_log;
CREATE POLICY "Service role all on ptsp_wa_log" ON ptsp_wa_log
    FOR ALL USING (auth.role() = 'service_role');

-- Index for fast cron polling
CREATE INDEX IF NOT EXISTS idx_ptsp_wa_log_pending
    ON ptsp_wa_log(wa_sent, created_at)
    WHERE wa_sent = FALSE;

-- ============================================================
-- 1b. FIX: Ubah tracking_id dari BIGINT → UUID jika sudah ada
-- (migration ini mungkin jalan setelah ptsp_wa_log sudah terbuat
--  dengan tracking_id=BIGINT, perlu ALTER agar trigger kompatibel)
-- ============================================================
DO $$
BEGIN
    IF EXISTS (
        SELECT FROM information_schema.columns
        WHERE table_name = 'ptsp_wa_log'
          AND column_name = 'tracking_id'
          AND udt_name = 'int8'
    ) THEN
        -- Baris-baris lama mungkin berisi tracking_id integer (dari migration gagal sebelumnya).
        -- Jika ada, hapus dulu agar tidak bloque alter type.
        DELETE FROM ptsp_wa_log WHERE tracking_id IS NOT NULL;
        -- Baru alter column type.
        ALTER TABLE ptsp_wa_log ALTER COLUMN tracking_id TYPE UUID;
        RAISE NOTICE 'ptsp_wa_log.tracking_id changed from BIGINT to UUID';
    END IF;
END $$;

-- ============================================================
-- 2. TRIGGER FUNCTION: ptsp_wa_on_insert
-- Fires AFTER INSERT on ptsp_master_tracking
-- Sends "data masuk, dalam antrian" WA when new submission arrives (status=1)
-- ============================================================
CREATE OR REPLACE FUNCTION ptsp_wa_on_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Only fire when new row has status=1 (Pending = baru masuk)
    IF NEW.status = 1
       AND NEW.no_wa IS NOT NULL
       AND NEW.no_wa <> ''
    THEN
        INSERT INTO ptsp_wa_log (
            tracking_id,
            short_code,
            no_wa,
            service_type,
            status_changed,
            catatan_admin
        ) VALUES (
            NEW.id,
            COALESCE(NEW.short_code, '-'),
            NEW.no_wa,
            COALESCE(NEW.service_type, NEW.table_name, '-'),
            1,
            NULL
        );
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_ptsp_wa_on_insert ON ptsp_master_tracking;
CREATE TRIGGER trg_ptsp_wa_on_insert
    AFTER INSERT ON ptsp_master_tracking
    FOR EACH ROW
    EXECUTE FUNCTION ptsp_wa_on_insert();

-- ============================================================
-- 3. TRIGGER FUNCTION: ptsp_wa_on_status_change
-- Fires AFTER UPDATE on ptsp_master_tracking
-- Sends WA when status changes to 0 (ditolak) or 100 (selesai)
-- ============================================================
CREATE OR REPLACE FUNCTION ptsp_wa_on_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Only fire on status change to 0 (Ditolak) or 100 (Selesai)
    IF OLD.status IS DISTINCT FROM NEW.status
       AND NEW.status IN (0, 100)
       AND NEW.no_wa IS NOT NULL
       AND NEW.no_wa <> ''
    THEN
        INSERT INTO ptsp_wa_log (
            tracking_id,
            short_code,
            no_wa,
            service_type,
            status_changed,
            catatan_admin
        ) VALUES (
            NEW.id,
            COALESCE(NEW.short_code, '-'),
            NEW.no_wa,
            COALESCE(NEW.service_type, NEW.table_name, '-'),
            NEW.status,
            NEW.catatan_admin
        );
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_ptsp_wa_on_status_change ON ptsp_master_tracking;
CREATE TRIGGER trg_ptsp_wa_on_status_change
    AFTER UPDATE ON ptsp_master_tracking
    FOR EACH ROW
    EXECUTE FUNCTION ptsp_wa_on_status_change();

-- ============================================================
-- 4. site_setting: WA notification toggle
-- Admin can turn PTSP WA notifications on/off from settings page
-- ============================================================
INSERT INTO site_settings (key, label, description, value)
VALUES (
    'notif_wa_ptsp',
    'Notifikasi WA PTSP',
    'Aktifkan notifikasi WhatsApp otomatis saat status PTSP berubah ke 1, 0, atau 100',
    'true'
)
ON CONFLICT (key) DO NOTHING;
