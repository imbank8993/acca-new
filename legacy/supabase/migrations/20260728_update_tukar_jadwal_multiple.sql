-- =====================================================================
-- Peningkatan Fitur Tukar Jadwal (Maks 3 JP)
-- Menggantikan kolom skalar jadwal_id menjadi JSONB array
-- =====================================================================

-- Tambah kolom JSONB untuk array jadwal
ALTER TABLE public.tukar_jadwal_request
    ADD COLUMN IF NOT EXISTS requester_slots JSONB,
    ADD COLUMN IF NOT EXISTS target_slots JSONB;

-- Migrasi data lama yang masih menunggu_wkm / menunggu_guru (jika ada)
-- (Kita bungkus dalam json array agar API backend yang baru bisa membaca)
UPDATE public.tukar_jadwal_request
SET requester_slots = jsonb_build_array(
    jsonb_build_object(
        'id', requester_jadwal_id,
        'hari', requester_hari,
        'jam_ke', requester_jam_ke,
        'kelas', requester_kelas,
        'mapel', requester_mapel
    )
),
target_slots = jsonb_build_array(
    jsonb_build_object(
        'id', target_jadwal_id,
        'hari', target_hari,
        'jam_ke', target_jam_ke,
        'kelas', target_kelas,
        'mapel', target_mapel
    )
)
WHERE jenis = 'mengajar' AND requester_slots IS NULL;

-- Hapus unique index lama yang membatasi 1 baris per pengajuan (karena ID kini di JSONB)
-- Validasi overlap kini ditangani murni di level API route.
DROP INDEX IF EXISTS uniq_tukar_jadwal_pending_requester;
DROP INDEX IF EXISTS uniq_tukar_jadwal_pending_target;

-- Hapus constraint NOT NULL pada kolom skalar lama, karena kita menggunakan JSONB array sekarang
ALTER TABLE public.tukar_jadwal_request
    ALTER COLUMN requester_jadwal_id DROP NOT NULL,
    ALTER COLUMN requester_hari DROP NOT NULL,
    ALTER COLUMN requester_jam_ke DROP NOT NULL,
    ALTER COLUMN target_jadwal_id DROP NOT NULL,
    ALTER COLUMN target_hari DROP NOT NULL,
    ALTER COLUMN target_jam_ke DROP NOT NULL;

-- Perbarui Constraint Bentuk
ALTER TABLE public.tukar_jadwal_request DROP CONSTRAINT IF EXISTS tukar_jadwal_bentuk_valid;
ALTER TABLE public.tukar_jadwal_request ADD CONSTRAINT tukar_jadwal_bentuk_valid CHECK (
    (jenis = 'mengajar'
        AND requester_slots IS NOT NULL AND target_slots IS NOT NULL)
    OR
    (jenis = 'piket'
        AND requester_piket_key IS NOT NULL AND target_piket_key IS NOT NULL
        AND requester_piket_key <> target_piket_key)
);
