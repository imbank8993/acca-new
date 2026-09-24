-- Fix trigger for agenda_akademik which had wrong column references
CREATE OR REPLACE FUNCTION notify_on_agenda_akademik()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    PERFORM send_notification(
        'agenda_akademik_baru',
        'Agenda Akademik Baru',
        COALESCE(NEW.judul, '-') || ' — ' ||
        COALESCE(NEW.tanggal_mulai::TEXT, '-') || ' s/d ' || COALESCE(NEW.tanggal_selesai::TEXT, NEW.tanggal_mulai::TEXT, '-'),
        '/dashboard?page=AgendaAkademik',
        'ADMIN',
        NULL,
        'agenda_akademik',
        NEW.id
    );
    RETURN NEW;
END;
$$;
