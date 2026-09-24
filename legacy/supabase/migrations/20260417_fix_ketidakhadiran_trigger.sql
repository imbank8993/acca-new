-- Migration: Fix Ketidakhadiran Trigger Column Names
-- Date: 2026-04-17
-- Reason: The previous notification trigger used 'nama_siswa' and 'tanggal' which don't exist in 'ketidakhadiran' table.

CREATE OR REPLACE FUNCTION notify_on_ketidakhadiran()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    PERFORM send_notification(
        'ketidakhadiran_baru',
        'Ketidakhadiran Siswa Baru',
        'Ketidakhadiran: ' || COALESCE(NEW.nama, '-') || ' | ' || 
        COALESCE(NEW.jenis, '-') || ' | ' || COALESCE(NEW.tgl_mulai::TEXT, '-'),
        '/dashboard?page=Ketidakhadiran',
        'ADMIN',
        NULL,
        'ketidakhadiran',
        NEW.id
    );
    RETURN NEW;
END;
$$;

-- Trigger already exists, so it will now use the updated function.
