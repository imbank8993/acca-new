-- Klinik Pembelajaran: sesi bentukan Admin + absensi peserta
-- Date: 2026-09-06
--
-- A. SESI BENTUKAN ADMIN (initiator_type = 'ADMIN')
--
--    Sebelumnya sebuah sesi hanya bisa lahir dari dua pihak: guru membuka slot
--    kosong, atau sekelompok siswa mengajukan. Keduanya selalu melewati meja
--    approval. Sekarang admin/OP_KLINIK/WKM_AKADEMIK boleh MEMBENTUK sesi
--    langsung: menunjuk guru pengampu sekaligus menunjuk pesertanya (acak,
--    satu kelas penuh, atau campuran beberapa siswa lintas kelas).
--
--    Sesi jenis ini lahir langsung 'open' (atau 'full' bila kuotanya persis
--    sejumlah peserta yang ditunjuk) — pembuatnya sudah reviewer terakhir,
--    tidak ada pihak lain yang perlu menyetujui.
--
--    `initiator_type` sudah VARCHAR(10) tanpa CHECK constraint, jadi nilai
--    ketiga 'ADMIN' tidak butuh perubahan skema — pola yang sama dipakai
--    status 'pending_guru' di migrasi 20260827.
--
-- B. ABSENSI PESERTA
--
--    Kehadiran menempel pada baris klinik_peserta, BUKAN tabel terpisah:
--    hubungannya selalu 1:1 dengan keikutsertaan, cascade delete sudah gratis,
--    dan setiap pembaca sesi (GET /api/klinik, lib/klinik/laporan-report.ts)
--    sudah memuat klinik_peserta — tabel terpisah memaksa menambah join di
--    banyak tempat sekaligus.
--
--    Kolom `status` yang lama ('registered'/'cancelled') SENGAJA tidak dipakai
--    ulang: nilainya ikut dibaca logika kuota (register/full), jadi menumpang
--    di sana akan mencampur dua urusan yang berbeda.
--
-- PRASYARAT: migrasi 20260812 (initiator_type, initiator_siswa_id) dan
-- 20260827 (catatan_penolakan, status 'pending_guru') harus sudah dijalankan.
-- Cek dulu di SQL Editor:
--   SELECT column_name FROM information_schema.columns WHERE table_name = 'klinik_slots';
--
-- Aman dijalankan berulang.

-- ── A. Sesi bentukan admin ───────────────────────────────────────────────────

ALTER TABLE klinik_slots ADD COLUMN IF NOT EXISTS dibuat_oleh BIGINT REFERENCES users(id);

COMMENT ON COLUMN klinik_slots.dibuat_oleh IS
  'users.id pihak yang membentuk sesi. Diisi untuk initiator_type = ADMIN; guru_id tetap menunjuk guru pengampunya, yang bisa orang lain.';

COMMENT ON COLUMN klinik_slots.initiator_type IS
  'GURU = dibuka guru sendiri (lahir pending). SISWA = pengajuan kelompok siswa (lahir pending_guru). ADMIN = dibentuk admin, peserta ditunjuk & terkunci, lahir langsung open/full.';

-- ── B. Absensi peserta ───────────────────────────────────────────────────────

ALTER TABLE klinik_peserta ADD COLUMN IF NOT EXISTS kehadiran        VARCHAR(1);
ALTER TABLE klinik_peserta ADD COLUMN IF NOT EXISTS kehadiran_at     TIMESTAMPTZ;
ALTER TABLE klinik_peserta ADD COLUMN IF NOT EXISTS kehadiran_sumber VARCHAR(10);
ALTER TABLE klinik_peserta ADD COLUMN IF NOT EXISTS kehadiran_oleh   BIGINT REFERENCES users(id);

-- Nilai baru untuk kolom `status` yang sudah ada (VARCHAR tanpa CHECK):
-- 'ditugaskan' = peserta yang DITUNJUK pembentuk sesi, bukan yang mendaftar
-- sendiri. Bedanya penting: yang ditugaskan tidak boleh mengundurkan diri,
-- sedangkan siswa yang mendaftar sendiri ke sesi yang sama (bila kuotanya masih
-- longgar) tetap berhak membatalkan.
COMMENT ON COLUMN klinik_peserta.status IS
  'registered = mendaftar sendiri. ditugaskan = ditunjuk pembentuk sesi (tidak boleh mundur sendiri). cancelled = dibatalkan.';

COMMENT ON COLUMN klinik_peserta.kehadiran IS
  'H/S/I/A. NULL = belum diabsen sama sekali (berbeda dari A/alpa, yang merupakan pernyataan tegas guru).';
COMMENT ON COLUMN klinik_peserta.kehadiran_sumber IS
  'MANDIRI = siswa menyatakan hadir sendiri dalam jendela waktu sesi. GURU = ditandai guru pengampu/admin. Catatan guru tidak boleh ditimpa absen mandiri.';

-- Dipakai menghitung ringkasan hadir per sesi di laporan & rekap.
CREATE INDEX IF NOT EXISTS idx_klinik_peserta_kehadiran ON klinik_peserta(slot_id, kehadiran);

-- ── C. Notifikasi saat sesi DIBUAT ───────────────────────────────────────────
--
-- Fungsi ini menyala pada SETIAP INSERT klinik_slots. Tanpa cabang 'ADMIN' di
-- bawah, sesi bentukan admin — yang statusnya sudah 'open' dan tidak menunggu
-- siapa pun — akan mengirim "Permintaan Klinik Baru" ke seluruh ADMIN, menuju
-- tab Approval yang tidak akan pernah memuat sesi itu.
--
-- Ditulis utuh (bukan menambal versi 20260827) supaya berkas ini tetap benar
-- meski dijalankan di instalasi yang belum menjalankan migrasi tersebut.
CREATE OR REPLACE FUNCTION notify_klinik_slot_request()
RETURNS TRIGGER AS $$
DECLARE
    v_nama_pengaju TEXT;
    v_auth_guru    UUID;
BEGIN
    SELECT auth_id INTO v_auth_guru FROM users WHERE id = NEW.guru_id LIMIT 1;

    IF NEW.initiator_type = 'SISWA' THEN
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

    ELSIF NEW.initiator_type = 'ADMIN' THEN
        -- Sesi sudah berjalan; yang perlu tahu hanya guru yang ditugaskan.
        -- Pesertanya dikabari dari route (barisnya baru ada setelah slot tersimpan).
        IF v_auth_guru IS NOT NULL THEN
            PERFORM send_notification(
                'klinik_request',
                'Anda Dijadwalkan Mengampu Klinik',
                'Madrasah menjadwalkan Anda mengampu klinik ' || COALESCE(NEW.mapel, '-')
                    || ' pada ' || NEW.tanggal::TEXT || ' pukul '
                    || TO_CHAR(NEW.jam_mulai, 'HH24:MI') || '. Peserta sudah ditentukan.',
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

-- Verifikasi:
-- SELECT column_name, data_type FROM information_schema.columns
-- WHERE table_name = 'klinik_peserta' ORDER BY ordinal_position;
