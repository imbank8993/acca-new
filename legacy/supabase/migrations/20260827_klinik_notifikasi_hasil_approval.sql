-- Klinik Pembelajaran: persetujuan guru pengampu + notifikasi ke semua pihak
-- Date: 2026-08-27
--
-- A. ALUR BARU untuk pengajuan kelompok siswa (initiator_type = 'SISWA')
--
--    Sebelumnya siswa menunjuk seorang guru dan slot itu langsung memakai
--    guru_id guru tersebut — guru baru tahu setelah reviewer menyetujuinya, dan
--    tidak pernah sekali pun menyatakan bersedia. Sekarang dua tahap:
--
--      pending_guru  siswa mengajukan; guru yang DITUNJUK dikabari & memutuskan
--            |
--            +-- bersedia --> pending   diteruskan ke ADMIN/OP_KLINIK/WKM_AKADEMIK
--            |                   |
--            |                   +-- setuju --> open
--            |                   +-- tolak  --> cancelled
--            |
--            +-- menolak  --> cancelled
--
--    Sesi yang dibuka guru sendiri tetap lahir langsung di status 'pending':
--    pengajunya sudah gurunya sendiri, tidak ada yang perlu dimintai kesediaan.
--
--    Kolom `status` sudah VARCHAR(20) tanpa CHECK constraint, jadi nilai baru
--    'pending_guru' tidak butuh perubahan skema.
--
-- B. Alasan penolakan
--
--    Penolakan (oleh guru maupun reviewer) selama ini tidak menyimpan alasan
--    apa pun, dan slotnya sekaligus lenyap dari semua tab yang bisa dilihat
--    siswa — pengaju tidak punya cara mengetahui apa yang terjadi.
--
-- C. Notifikasi
--
--    Trigger lama (20260821) hanya mengabari `guru_id`, dan hanya pada transisi
--    pending -> open. Sekarang setiap keputusan dikabarkan ke pihak yang menunggu.

ALTER TABLE klinik_slots ADD COLUMN IF NOT EXISTS catatan_penolakan TEXT;

COMMENT ON COLUMN klinik_slots.catatan_penolakan IS
  'Alasan penolakan, diisi guru pengampu (pending_guru -> cancelled) atau reviewer (pending -> cancelled).';

COMMENT ON COLUMN klinik_slots.status IS
  'pending_guru (menunggu kesediaan guru pengampu, khusus pengajuan siswa) -> pending (menunggu reviewer) -> open -> full -> finished -> paid. cancelled = ditolak/batal.';

CREATE INDEX IF NOT EXISTS idx_klinik_slots_status ON klinik_slots(status);

-- ── Notifikasi saat pengajuan DIBUAT ──────────────────────────────────────────
-- Pengajuan siswa kini singgah dulu ke guru pengampu, jadi yang dikabari saat
-- INSERT adalah guru tersebut — bukan lagi reviewer, yang belum berkepentingan.
CREATE OR REPLACE FUNCTION notify_klinik_slot_request()
RETURNS TRIGGER AS $$
DECLARE
    v_nama_pengaju TEXT;
    v_auth_guru    UUID;
BEGIN
    IF NEW.initiator_type = 'SISWA' THEN
        SELECT nama INTO v_nama_pengaju FROM users WHERE id = NEW.initiator_siswa_id LIMIT 1;
        SELECT auth_id INTO v_auth_guru FROM users WHERE id = NEW.guru_id LIMIT 1;

        IF v_auth_guru IS NOT NULL THEN
            PERFORM send_notification(
                'klinik_request',
                'Permintaan Klinik dari Siswa',
                COALESCE(v_nama_pengaju, 'Seorang siswa')
                    || ' meminta Anda mengampu klinik ' || COALESCE(NEW.mapel, '-')
                    || ' pada ' || NEW.tanggal::TEXT || '. Mohon konfirmasi kesediaan Anda.',
                '/klinik?tab=my_sessions',
                NULL, v_auth_guru, 'klinik_slots', NEW.id::TEXT
            );
        END IF;
    ELSE
        PERFORM send_notification(
            'klinik_request',
            'Permintaan Klinik Baru',
            'Guru ' || COALESCE(NEW.nama_guru, 'tidak diketahui') || ' mengajukan jadwal klinik: '
                || COALESCE(NEW.mapel, '-') || ' pada ' || NEW.tanggal::TEXT,
            '/klinik?tab=approval',
            'ADMIN', NULL, 'klinik_slots', NEW.id::TEXT
        );
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ── Notifikasi saat status pengajuan BERUBAH ─────────────────────────────────
CREATE OR REPLACE FUNCTION notify_klinik_slot_approved()
RETURNS TRIGGER AS $$
DECLARE
    v_auth_guru    UUID;
    v_auth_siswa   UUID;
    v_nama_pengaju TEXT;
    v_judul TEXT;
    v_pesan TEXT;
    v_ekor  TEXT := '';
BEGIN
    SELECT auth_id INTO v_auth_guru  FROM users WHERE id = NEW.guru_id LIMIT 1;

    -- Pengaju boleh menyunting pengajuannya selagi 'pending_guru', termasuk
    -- MENGGANTI guru pengampu (lihat update_slot). Guru pengganti tidak akan
    -- pernah tahu kalau hanya INSERT yang memicu undangan — permintaannya akan
    -- menggantung selamanya di daftar seseorang yang sudah tidak ditunjuk.
    IF NEW.status = 'pending_guru' AND OLD.guru_id IS DISTINCT FROM NEW.guru_id THEN
        SELECT nama INTO v_nama_pengaju FROM users WHERE id = NEW.initiator_siswa_id LIMIT 1;
        IF v_auth_guru IS NOT NULL THEN
            PERFORM send_notification(
                'klinik_request',
                'Permintaan Klinik dari Siswa',
                COALESCE(v_nama_pengaju, 'Seorang siswa')
                    || ' meminta Anda mengampu klinik ' || COALESCE(NEW.mapel, '-')
                    || ' pada ' || NEW.tanggal::TEXT || '. Mohon konfirmasi kesediaan Anda.',
                '/klinik?tab=my_sessions',
                NULL, v_auth_guru, 'klinik_slots', NEW.id::TEXT
            );
        END IF;
    END IF;

    IF OLD.status IS NOT DISTINCT FROM NEW.status THEN
        RETURN NEW;
    END IF;

    IF NEW.initiator_type = 'SISWA' AND NEW.initiator_siswa_id IS NOT NULL THEN
        SELECT auth_id INTO v_auth_siswa FROM users WHERE id = NEW.initiator_siswa_id LIMIT 1;
    END IF;

    IF NEW.catatan_penolakan IS NOT NULL AND NEW.catatan_penolakan <> '' THEN
        v_ekor := ' Alasan: ' || NEW.catatan_penolakan;
    END IF;

    -- 1. Guru pengampu menyatakan bersedia -> pengajuan naik ke meja reviewer.
    IF OLD.status = 'pending_guru' AND NEW.status = 'pending' THEN
        PERFORM send_notification(
            'klinik_request',
            'Permintaan Klinik Baru',
            'Guru ' || COALESCE(NEW.nama_guru, 'tidak diketahui')
                || ' bersedia mengampu klinik kelompok ' || COALESCE(NEW.mapel, '-')
                || ' pada ' || NEW.tanggal::TEXT || '. Menunggu persetujuan Anda.',
            '/klinik?tab=approval',
            'ADMIN', NULL, 'klinik_slots', NEW.id::TEXT
        );
        IF v_auth_siswa IS NOT NULL THEN
            PERFORM send_notification(
                'klinik_approved',
                'Guru Bersedia Mengampu',
                COALESCE(NEW.nama_guru, 'Guru pengampu') || ' bersedia mengampu klinik '
                    || COALESCE(NEW.mapel, '-') || '. Menunggu persetujuan admin.',
                '/klinik?tab=kelompok',
                NULL, v_auth_siswa, 'klinik_slots', NEW.id::TEXT
            );
        END IF;
        RETURN NEW;
    END IF;

    -- 2. Guru pengampu menolak -> hanya pengaju yang perlu tahu.
    IF OLD.status = 'pending_guru' AND NEW.status = 'cancelled' THEN
        IF v_auth_siswa IS NOT NULL THEN
            PERFORM send_notification(
                'klinik_approved',
                'Pengajuan Klinik Ditolak Guru',
                COALESCE(NEW.nama_guru, 'Guru yang Anda tunjuk')
                    || ' tidak dapat mengampu klinik ' || COALESCE(NEW.mapel, '-')
                    || ' pada ' || NEW.tanggal::TEXT || '.' || v_ekor,
                '/klinik?tab=kelompok',
                NULL, v_auth_siswa, 'klinik_slots', NEW.id::TEXT
            );
        END IF;
        RETURN NEW;
    END IF;

    -- 3. Keputusan reviewer. Guru DAN pengaju sama-sama dikabari.
    IF OLD.status = 'pending' AND NEW.status IN ('open', 'cancelled') THEN
        IF NEW.status = 'open' THEN
            v_judul := 'Jadwal Klinik Disetujui';
            v_pesan := 'Sesi klinik ' || COALESCE(NEW.mapel, '-')
                       || ' pada ' || NEW.tanggal::TEXT || ' telah disetujui.';
        ELSE
            v_judul := 'Pengajuan Klinik Ditolak';
            v_pesan := 'Pengajuan klinik ' || COALESCE(NEW.mapel, '-')
                       || ' pada ' || NEW.tanggal::TEXT || ' tidak disetujui.' || v_ekor;
        END IF;

        IF v_auth_guru IS NOT NULL THEN
            PERFORM send_notification(
                'klinik_approved', v_judul, v_pesan, '/klinik?tab=my_sessions',
                NULL, v_auth_guru, 'klinik_slots', NEW.id::TEXT
            );
        END IF;
        IF v_auth_siswa IS NOT NULL THEN
            PERFORM send_notification(
                'klinik_approved', v_judul, v_pesan,
                CASE WHEN NEW.status = 'open' THEN '/klinik?tab=available' ELSE '/klinik?tab=kelompok' END,
                NULL, v_auth_siswa, 'klinik_slots', NEW.id::TEXT
            );
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
