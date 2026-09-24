-- Fix for izin_guru notification trigger error: record "new" has no field "user_id"
-- This migration updates the trigger function to lookup the user_id from the users table based on NIP.

CREATE OR REPLACE FUNCTION notify_on_izin_guru_status()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Only proceed if status has changed
    IF OLD.status IS DISTINCT FROM NEW.status THEN
        PERFORM send_notification(
            CASE NEW.status
                WHEN 'disetujui' THEN 'izin_guru_disetujui'
                WHEN 'ditolak'   THEN 'izin_guru_ditolak'
                ELSE 'izin_guru_status_changed'
            END,
            CASE NEW.status
                WHEN 'disetujui' THEN 'Izin Guru Disetujui'
                WHEN 'ditolak'   THEN 'Izin Guru Ditolak'
                ELSE 'Status Izin Guru Berubah'
            END,
            'Pengajuan izin ' || NEW.nama_guru || ': ' || NEW.status,
            '/dashboard?page=IzinGuru',
            NULL,
            (SELECT auth_id FROM public.users WHERE nip = NEW.nip LIMIT 1), -- Lookup user_id via NIP
            'izin_guru',
            NEW.id
        );
    END IF;

    RETURN NEW;
END;
$$;


-- Re-apply trigger just in case (though not strictly necessary as function was updated)
DROP TRIGGER IF EXISTS trg_notify_izin_guru_status ON izin_guru;
CREATE TRIGGER trg_notify_izin_guru_status
    AFTER UPDATE ON izin_guru
    FOR EACH ROW
    EXECUTE FUNCTION notify_on_izin_guru_status();
