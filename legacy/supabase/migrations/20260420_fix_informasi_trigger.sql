-- Fix trigger for informasi_akademik which had wrong column reference 'judul'
CREATE OR REPLACE FUNCTION notify_on_informasi()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    PERFORM send_notification(
        'informasi_baru',
        'Informasi Akademik Baru',
        COALESCE(NEW.title, '-'), -- Fixed: use NEW.title instead of non-existent NEW.judul
        '/dashboard?page=InformasiAkademik',
        NULL,
        NULL,
        'informasi_akademik',
        NEW.id
    );
    RETURN NEW;
END;
$$;
