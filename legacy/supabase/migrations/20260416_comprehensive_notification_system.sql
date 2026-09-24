-- Migration: Comprehensive Notification System
-- Events: users, nilai, jurnal, izin_guru, lckh, siswa, piket, jadwal, dll
-- Date: 2026-04-16

-- ============================================================
-- 1. ENHANCE NOTIFICATIONS TABLE
-- Add recipient targeting + source tracking
-- ============================================================
ALTER TABLE notifications
ADD COLUMN IF NOT EXISTS recipient_role VARCHAR(50),
ADD COLUMN IF NOT EXISTS recipient_user_id UUID,
ADD COLUMN IF NOT EXISTS source_table VARCHAR(50),
ADD COLUMN IF NOT EXISTS source_id UUID;

COMMENT ON COLUMN notifications.recipient_role   IS 'Target role(s) for this notification (comma-separated)';
COMMENT ON COLUMN notifications.recipient_user_id IS 'Specific user UUID to target';
COMMENT ON COLUMN notifications.source_table     IS 'Which table triggered this notification';
COMMENT ON COLUMN notifications.source_id        IS 'Row ID in the source table that triggered this';

CREATE INDEX IF NOT EXISTS idx_notifications_recipient_role   ON notifications(recipient_role);
CREATE INDEX IF NOT EXISTS idx_notifications_recipient_user   ON notifications(recipient_user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_source           ON notifications(source_table, source_id);

-- ============================================================
-- 2. HELPER FUNCTION: send_notification
-- Called by triggers; inserts a notification row
-- ============================================================
CREATE OR REPLACE FUNCTION send_notification(
    p_type           VARCHAR,
    p_title          VARCHAR,
    p_message        TEXT,
    p_link           VARCHAR,
    p_recipient_role VARCHAR DEFAULT NULL,
    p_recipient_user_id UUID DEFAULT NULL,
    p_source_table   VARCHAR DEFAULT NULL,
    p_source_id      TEXT    DEFAULT NULL  -- Main storage as TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    new_id UUID;
BEGIN
    INSERT INTO notifications (
        type, title, message, link,
        recipient_role, recipient_user_id,
        source_table, source_id
    ) VALUES (
        p_type, p_title, p_message, p_link,
        p_recipient_role, p_recipient_user_id,
        p_source_table, p_source_id
    )
    RETURNING id INTO new_id;

    RETURN new_id;
END;
$$;

-- Overload for BIGINT source IDs (e.g., users, jurnal)
CREATE OR REPLACE FUNCTION send_notification(
    p_type           VARCHAR,
    p_title          VARCHAR,
    p_message        TEXT,
    p_link           VARCHAR,
    p_recipient_role VARCHAR,
    p_recipient_user_id UUID,
    p_source_table   VARCHAR,
    p_source_id      BIGINT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN send_notification(
        p_type, p_title, p_message, p_link,
        p_recipient_role, p_recipient_user_id,
        p_source_table,
        p_source_id::TEXT
    );
END;
$$;

-- Overload for UUID source IDs (e.g., izin_guru, ketidakhadiran)
CREATE OR REPLACE FUNCTION send_notification(
    p_type           VARCHAR,
    p_title          VARCHAR,
    p_message        TEXT,
    p_link           VARCHAR,
    p_recipient_role VARCHAR,
    p_recipient_user_id UUID,
    p_source_table   VARCHAR,
    p_source_id      UUID
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN send_notification(
        p_type, p_title, p_message, p_link,
        p_recipient_role, p_recipient_user_id,
        p_source_table,
        p_source_id::TEXT
    );
END;
$$;

-- ============================================================
-- 3. TRIGGER: users — new user created
-- ============================================================
CREATE OR REPLACE FUNCTION notify_on_user_create()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    PERFORM send_notification(
        'user_baru',
        'Akun baru terdaftar',
        'Pengguna baru: ' || NEW.nama || ' (' || COALESCE(NEW.role, 'GURU') || ')',
        '/dashboard?page=PengaturanUsers',
        'ADMIN',
        NULL,
        'users',
        NEW.id
    );
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_user_create ON users;
CREATE TRIGGER trg_notify_user_create
    AFTER INSERT ON users
    FOR EACH ROW
    EXECUTE FUNCTION notify_on_user_create();

-- ============================================================
-- 4. TRIGGER: users — user updated (role, status, etc.)
-- ============================================================
CREATE OR REPLACE FUNCTION notify_on_user_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    IF OLD.aktif IS DISTINCT FROM NEW.aktif THEN
        PERFORM send_notification(
            CASE WHEN NEW.aktif THEN 'user_activated' ELSE 'user_deactivated' END,
            CASE WHEN NEW.aktif THEN 'Akun diaktifkan' ELSE 'Akun dinonaktifkan' END,
            CASE
                WHEN NEW.aktif THEN NEW.nama || ' telah diaktifkan'
                ELSE NEW.nama || ' telah dinonaktifkan'
            END,
            '/dashboard?page=PengaturanUsers',
            'ADMIN',
            NULL,
            'users',
            NEW.id
        );
    END IF;

    IF OLD.role IS DISTINCT FROM NEW.role THEN
        PERFORM send_notification(
            'user_role_changed',
            'Role pengguna berubah',
            NEW.nama || ': role berubah dari "' || COALESCE(OLD.role, '-') || '" ke "' || COALESCE(NEW.role, '-') || '"',
            '/dashboard?page=PengaturanUsers',
            'ADMIN',
            NULL,
            'users',
            NEW.id
        );
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_user_update ON users;
CREATE TRIGGER trg_notify_user_update
    AFTER UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION notify_on_user_update();

-- ============================================================
-- 5. TRIGGER: nilai_data — score inserted/updated
-- ============================================================
CREATE OR REPLACE FUNCTION notify_on_nilai_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    PERFORM send_notification(
        'nilai_updated',
        'Nilai diperbarui',
        'Nilai ' || COALESCE(NEW.mapel, '-') || ' kelas ' || COALESCE(NEW.kelas, '-') ||
        ' semester ' || COALESCE(NEW.semester::TEXT, '-') || ' telah diperbarui.',
        '/dashboard?page=Nilai',
        'ADMIN',
        NULL,
        'nilai_data',
        NEW.id
    );
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_nilai_change ON nilai_data;
CREATE TRIGGER trg_notify_nilai_change
    AFTER INSERT OR UPDATE ON nilai_data
    FOR EACH ROW
    EXECUTE FUNCTION notify_on_nilai_change();

-- ============================================================
-- 6. TRIGGER: izin_guru — new izin submitted
-- ============================================================
CREATE OR REPLACE FUNCTION notify_on_izin_guru()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    PERFORM send_notification(
        'izin_guru_baru',
        'Pengajuan Izin Baru',
        NEW.nama_guru || ' mengajukan izin: ' || COALESCE(NEW.jenis, '-') ||
        ' | ' || COALESCE(NEW.keterangan, '-'),
        '/dashboard?page=IzinGuru',
        'ADMIN',
        NULL,
        'izin_guru',
        NEW.id
    );
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_izin_guru ON izin_guru;
CREATE TRIGGER trg_notify_izin_guru
    AFTER INSERT ON izin_guru
    FOR EACH ROW
    EXECUTE FUNCTION notify_on_izin_guru();

-- ============================================================
-- 7. TRIGGER: izin_guru — izin status changed
-- ============================================================
CREATE OR REPLACE FUNCTION notify_on_izin_guru_status()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
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
            (SELECT auth_id FROM public.users WHERE nip = NEW.nip LIMIT 1),  -- Lookup user_id based on NIP
            'izin_guru',
            NEW.id
        );
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_izin_guru_status ON izin_guru;
CREATE TRIGGER trg_notify_izin_guru_status
    AFTER UPDATE ON izin_guru
    FOR EACH ROW
    EXECUTE FUNCTION notify_on_izin_guru_status();

-- ============================================================
-- 8. TRIGGER: lckh_submissions — LCKH submitted
-- ============================================================
CREATE OR REPLACE FUNCTION notify_on_lckh_submit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    PERFORM send_notification(
        'lckh_submitted',
        'LCKH Baru Diajukan',
        'LCKH periode ' || COALESCE(NEW.periode_kode, NEW.bulan || '/' || NEW.tahun::TEXT, '-') ||
        ' diajukan oleh ' || COALESCE(NEW.nama_guru_snap, '-'),
        '/dashboard?page=LckhApproval',
        'ADMIN',
        NULL,
        'lckh_submissions',
        NEW.id
    );
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_lckh_submit ON lckh_submissions;
CREATE TRIGGER trg_notify_lckh_submit
    AFTER INSERT ON lckh_submissions
    FOR EACH ROW
    EXECUTE FUNCTION notify_on_lckh_submit();

-- ============================================================
-- 9. TRIGGER: lckh_submissions — LCKH approved/rejected
-- ============================================================
CREATE OR REPLACE FUNCTION notify_on_lckh_approval()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    IF OLD.status IS DISTINCT FROM NEW.status THEN
        PERFORM send_notification(
            CASE NEW.status
                WHEN 'approved'  THEN 'lckh_disetujui'
                WHEN 'rejected'  THEN 'lckh_ditolak'
                WHEN 'revisi'    THEN 'lckh_revisi'
                ELSE 'lckh_status_changed'
            END,
            CASE NEW.status
                WHEN 'approved'  THEN 'LCKH Disetujui'
                WHEN 'rejected'  THEN 'LCKH Ditolak'
                WHEN 'revisi'    THEN 'LCKH Perlu Revisi'
                ELSE 'Status LCKH Berubah'
            END,
            'LCKH periode ' || COALESCE(NEW.periode_kode, '-') || ': ' || NEW.status,
            '/dashboard?page=LckhApproval',
            NULL,
            NEW.user_id,
            'lckh_submissions',
            NEW.id
        );
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_lckh_approval ON lckh_submissions;
CREATE TRIGGER trg_notify_lckh_approval
    AFTER UPDATE ON lckh_submissions
    FOR EACH ROW
    EXECUTE FUNCTION notify_on_lckh_approval();

-- ============================================================
-- 10. TRIGGER: ketidakhadiran (students) — submitted
-- ============================================================
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

DROP TRIGGER IF EXISTS trg_notify_ketidakhadiran ON ketidakhadiran;
CREATE TRIGGER trg_notify_ketidakhadiran
    AFTER INSERT ON ketidakhadiran
    FOR EACH ROW
    EXECUTE FUNCTION notify_on_ketidakhadiran();

-- ============================================================
-- 11. TRIGGER: siswa_kelas — new student added
-- ============================================================
CREATE OR REPLACE FUNCTION notify_on_siswa_baru()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    PERFORM send_notification(
        'siswa_baru',
        'Siswa Baru Terdaftar',
        COALESCE(NEW.nama_siswa, '-') || ' masuk kelas ' || COALESCE(NEW.kelas, '-'),
        '/dashboard?page=Master',
        'ADMIN',
        NULL,
        'siswa_kelas',
        NEW.id
    );
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_siswa_baru ON siswa_kelas;
CREATE TRIGGER trg_notify_siswa_baru
    AFTER INSERT ON siswa_kelas
    FOR EACH ROW
    EXECUTE FUNCTION notify_on_siswa_baru();

-- ============================================================
-- 12. TRIGGER: journal_piket — piket entry created
-- SKIPPED: table journal_piket does not exist in this project.
--          Use laporan_piket or jadwal_piket if piket notifications are needed.
-- ============================================================
-- CREATE OR REPLACE FUNCTION notify_on_piket_baru()
-- RETURNS TRIGGER
-- LANGUAGE plpgsql
-- SECURITY DEFINER
-- AS $$
-- BEGIN
--     PERFORM send_notification(
--         'piket_baru',
--         'Jurnal Piket Baru',
--         'Jurnal piket tanggal ' || COALESCE(NEW.tanggal::TEXT, '-') ||
--         ' | Shift: ' || COALESCE(NEW.shift, '-'),
--         '/dashboard?page=Piket',
--         NULL,
--         NEW.guru_id,
--         'journal_piket',
--         NEW.id
--     );
--     RETURN NEW;
-- END;
-- $$;
--
-- DROP TRIGGER IF EXISTS trg_notify_piket_baru ON journal_piket;
-- CREATE TRIGGER trg_notify_piket_baru
--     AFTER INSERT ON journal_piket
--     FOR EACH ROW
--     EXECUTE FUNCTION notify_on_piket_baru();

-- ============================================================
-- 13. TRIGGER: jadwal_guru — schedule changed
-- ============================================================
CREATE OR REPLACE FUNCTION notify_on_jadwal_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    PERFORM send_notification(
        'jadwal_berubah',
        'Jadwal Mengajar Berubah',
        'Jadwal guru ' || COALESCE(NEW.nip, '-') || ' kelas ' ||
        COALESCE(NEW.kelas, '-') || ' berubah.',
        '/dashboard?page=JadwalGuru',
        'ADMIN',
        NULL,
        'jadwal_guru',
        NEW.id
    );
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_jadwal_change ON jadwal_guru;
CREATE TRIGGER trg_notify_jadwal_change
    AFTER INSERT OR UPDATE ON jadwal_guru
    FOR EACH ROW
    EXECUTE FUNCTION notify_on_jadwal_change();

-- ============================================================
-- 14. TRIGGER: informasi_akademik — new info posted
-- ============================================================
CREATE OR REPLACE FUNCTION notify_on_informasi()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    PERFORM send_notification(
        'informasi_baru',
        'Informasi Akademik Baru',
        COALESCE(NEW.judul, NEW.title, '-'),
        '/dashboard?page=InformasiAkademik',
        NULL,
        NULL,
        'informasi_akademik',
        NEW.id
    );
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_informasi ON informasi_akademik;
CREATE TRIGGER trg_notify_informasi
    AFTER INSERT ON informasi_akademik
    FOR EACH ROW
    EXECUTE FUNCTION notify_on_informasi();

-- ============================================================
-- 15. TRIGGER: agenda_akademik — new agenda created
-- ============================================================
CREATE OR REPLACE FUNCTION notify_on_agenda_akademik()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    PERFORM send_notification(
        'agenda_akademik_baru',
        'Agenda Akademik Baru',
        COALESCE(NEW.title, NEW.judul, '-') || ' — ' ||
        COALESCE(NEW.start_date::TEXT, '-') || ' s/d ' || COALESCE(NEW.end_date::TEXT, '-'),
        '/dashboard?page=AgendaAkademik',
        'ADMIN',
        NULL,
        'agenda_akademik',
        NEW.id
    );
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_agenda_akademik ON agenda_akademik;
CREATE TRIGGER trg_notify_agenda_akademik
    AFTER INSERT ON agenda_akademik
    FOR EACH ROW
    EXECUTE FUNCTION notify_on_agenda_akademik();

-- ============================================================
-- 16. TRIGGER: pribadi_documents — document shared with user
-- SKIPPED: table pribadi_documents does not exist
-- ============================================================
-- CREATE OR REPLACE FUNCTION notify_on_doc_shared()
-- RETURNS TRIGGER
-- LANGUAGE plpgsql
-- SECURITY DEFINER
-- AS $$
-- BEGIN
--     PERFORM send_notification(
--         'dokumen_dibagikan',
--         'Dokumen Dibagikan',
--         '"' || COALESCE(NEW.file_name, NEW.filename, '-') || '" dibagikan kepada Anda.',
--         '/dashboard?page=PersonalDocuments',
--         NULL,
--         NEW.shared_with_user_id,
--         'pribadi_documents',
--         NEW.id
--     );
--     RETURN NEW;
-- END;
-- $$;
--
-- DROP TRIGGER IF EXISTS trg_notify_doc_shared ON pribadi_documents;
-- CREATE TRIGGER trg_notify_doc_shared
--     AFTER INSERT ON pribadi_documents
--     FOR EACH ROW
--     EXECUTE FUNCTION notify_on_doc_shared();

-- ============================================================
-- 17. TRIGGER: pribadi_folders — folder shared with user
-- SKIPPED: table pribadi_folders does not exist
-- ============================================================
-- CREATE OR REPLACE FUNCTION notify_on_folder_shared()
-- RETURNS TRIGGER
-- LANGUAGE plpgsql
-- SECURITY DEFINER
-- AS $$
-- BEGIN
--     PERFORM send_notification(
--         'folder_dibagikan',
--         'Folder Dibagikan',
--         'Folder "' || COALESCE(NEW.name, NEW.folder_name, '-') || '" dibagikan kepada Anda.',
--         '/dashboard?page=PersonalDocuments',
--         NULL,
--         NEW.shared_with_user_id,
--         'pribadi_folders',
--         NEW.id
--     );
--     RETURN NEW;
-- END;
-- $$;
--
-- DROP TRIGGER IF EXISTS trg_notify_folder_shared ON pribadi_folders;
-- CREATE TRIGGER trg_notify_folder_shared
--     AFTER INSERT ON pribadi_folders
--     FOR EACH ROW
--     EXECUTE FUNCTION notify_on_folder_shared();

-- ============================================================
-- 18. TRIGGER: tagihan_guru — new tagihan created
-- SKIPPED: table tagihan_guru does not exist (nilai_tagihan exists instead)
-- ============================================================
-- CREATE OR REPLACE FUNCTION notify_on_tagihan_baru()
-- RETURNS TRIGGER
-- LANGUAGE plpgsql
-- SECURITY DEFINER
-- AS $$
-- BEGIN
--     PERFORM send_notification(
--         'tagihan_baru',
--         'Tagihan Baru',
--         'Tagihan: ' || COALESCE(NEW.description, NEW.deskripsi, '-') || ' | Rp ' ||
--         COALESCE(NEW.amount::TEXT, '-') || ' | ' || COALESCE(NEW.status, '-'),
--         '/dashboard?page=CatatanKeuangan',
--         'ADMIN',
--         NULL,
--         'tagihan_guru',
--         NEW.id
--     );
--     RETURN NEW;
-- END;
-- $$;
--
-- DROP TRIGGER IF EXISTS trg_notify_tagihan_baru ON tagihan_guru;
-- CREATE TRIGGER trg_notify_tagihan_baru
--     AFTER INSERT ON tagihan_guru
--     FOR EACH ROW
--     EXECUTE FUNCTION notify_on_tagihan_baru();

-- ============================================================
-- 19. TRIGGER: pengembangan_diri_response — survey filled
-- SKIPPED: table pengembangan_diri_response does not exist
--          (pengembangan_diri_responses or survey_pengembangan_diri_responses exist instead)
-- ============================================================
-- CREATE OR REPLACE FUNCTION notify_on_pengembangan_diri()
-- RETURNS TRIGGER
-- LANGUAGE plpgsql
-- SECURITY DEFINER
-- AS $$
-- BEGIN
--     PERFORM send_notification(
--         'survey_pengembangan_diri',
--         'Respon Survey Pengembangan Diri',
--         'Survey oleh: ' || COALESCE(NEW.nama, NEW.name, '-') || ' | Periode: ' ||
--         COALESCE(NEW.periode, '-'),
--         '/dashboard?page=LaporanPengembanganDiri',
--         'ADMIN',
--         NULL,
--         'pengembangan_diri_response',
--         NEW.id
--     );
--     RETURN NEW;
-- END;
-- $$;
--
-- DROP TRIGGER IF EXISTS trg_notify_pengembangan_diri ON pengembangan_diri_response;
-- CREATE TRIGGER trg_notify_pengembangan_diri
--     AFTER INSERT ON pengembangan_diri_response
--     FOR EACH ROW
--     EXECUTE FUNCTION notify_on_pengembangan_diri();