-- Klinik Pembelajaran: perbaiki teks notifikasi pengajuan + tautannya
-- Date: 2026-08-21
--
-- Dua masalah pada trigger lama (20260417_klinik_pembelajaran_init.sql):
--
--  1. Pesannya selalu berbunyi "Guru <nama_guru> mengajukan jadwal klinik".
--     Sejak 20260812_klinik_siswa_ajuan.sql pengajuan juga bisa datang dari
--     kelompok siswa (initiator_type = 'SISWA'); pada kasus itu nama_guru
--     adalah guru pengampu yang DITUNJUK siswa, bukan pihak yang mengajukan.
--
--  2. Tautannya memakai format SPA lama '/dashboard?page=Klinik'. Middleware
--     masih mengalihkannya, tapi hasilnya '/Klinik' (huruf besar) dan bukan
--     route asli '/klinik' pasca migrasi App Router. Sekalian diarahkan ke
--     tab Approval supaya reviewer langsung mendarat di daftar yang benar.

CREATE OR REPLACE FUNCTION notify_klinik_slot_request()
RETURNS TRIGGER AS $$
DECLARE
    v_pengaju TEXT;
    v_nama_pengaju TEXT;
BEGIN
    IF NEW.initiator_type = 'SISWA' THEN
        SELECT nama INTO v_nama_pengaju FROM users WHERE id = NEW.initiator_siswa_id LIMIT 1;
        v_pengaju := 'Siswa ' || COALESCE(v_nama_pengaju, 'tidak diketahui')
                     || ' mengajukan klinik kelompok bersama ' || COALESCE(NEW.nama_guru, 'guru pengampu');
    ELSE
        v_pengaju := 'Guru ' || COALESCE(NEW.nama_guru, 'tidak diketahui') || ' mengajukan jadwal klinik';
    END IF;

    PERFORM send_notification(
        'klinik_request',
        'Permintaan Klinik Baru',
        v_pengaju || ': ' || COALESCE(NEW.mapel, '-') || ' pada ' || NEW.tanggal::TEXT,
        '/klinik?tab=approval',
        'ADMIN',
        NULL,
        'klinik_slots',
        NEW.id
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Tautan notifikasi persetujuan disamakan formatnya.
CREATE OR REPLACE FUNCTION notify_klinik_slot_approved()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.status = 'pending' AND NEW.status = 'open' THEN
        PERFORM send_notification(
            'klinik_approved',
            'Jadwal Klinik Disetujui',
            'Jadwal Anda untuk ' || COALESCE(NEW.mapel, '-') || ' pada ' || NEW.tanggal::TEXT || ' telah disetujui.',
            '/klinik?tab=my_sessions',
            NULL,
            (SELECT auth_id FROM users WHERE id = NEW.guru_id LIMIT 1),
            'klinik_slots',
            NEW.id
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
