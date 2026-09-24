-- Sinkronisasi hapus dua arah antara rekam_medis_siswa <-> ketidakhadiran.
--
-- Masalah sebelumnya:
-- 1. rekam_medis_siswa tidak punya kolom `aktif`, sehingga tidak bisa di-soft
--    delete seperti tabel lain di aplikasi ini.
-- 2. Tidak ada kolom penghubung antara kedua tabel. Penghapusan mencocokkan
--    baris secara heuristik (nisn + tanggal + jenis SAKIT + waktu_mulai_real).
--    Bila `waktu` di rekam medis kosong, filter jam dilewati dan SEMUA baris
--    SAKIT siswa itu pada tanggal tersebut ikut terhapus — termasuk baris yang
--    diinput manual oleh OP UKS dan tidak berasal dari rekam medis mana pun.
--
-- JALANKAN MANUAL lewat Supabase Dashboard -> SQL Editor.

-- ── 1. Soft delete untuk rekam medis ────────────────────────────────────────
ALTER TABLE public.rekam_medis_siswa
    ADD COLUMN IF NOT EXISTS aktif BOOLEAN NOT NULL DEFAULT true;

CREATE INDEX IF NOT EXISTS idx_rekam_medis_aktif
    ON public.rekam_medis_siswa(aktif);

-- ── 2. Kolom penghubung eksplisit ───────────────────────────────────────────
-- ON DELETE SET NULL, bukan CASCADE: bila suatu saat rekam medis benar-benar
-- dihapus permanen (mis. lewat SQL Editor), baris absensinya tidak ikut lenyap
-- diam-diam — cukup kehilangan tautannya.
ALTER TABLE public.ketidakhadiran
    ADD COLUMN IF NOT EXISTS rekam_medis_id UUID
    REFERENCES public.rekam_medis_siswa(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_ketidakhadiran_rekam_medis_id
    ON public.ketidakhadiran(rekam_medis_id);

-- ── 3. Backfill tautan untuk data lama ──────────────────────────────────────
-- Prioritaskan pasangan yang jamnya persis sama; baris tanpa waktu_mulai_real
-- ditautkan ke rekam medis terbaru pada tanggal yang sama.
WITH pasangan AS (
    SELECT DISTINCT ON (k.id)
           k.id  AS kh_id,
           rm.id AS rm_id
    FROM public.ketidakhadiran k
    JOIN public.rekam_medis_siswa rm
      ON rm.nisn    = k.nisn
     AND rm.tanggal = k.tgl_mulai
    WHERE k.jenis = 'SAKIT'
      AND k.rekam_medis_id IS NULL
      AND (k.waktu_mulai_real = rm.waktu OR k.waktu_mulai_real IS NULL)
    ORDER BY k.id,
             (k.waktu_mulai_real IS NOT DISTINCT FROM rm.waktu) DESC,
             rm.created_at DESC
)
UPDATE public.ketidakhadiran k
SET    rekam_medis_id = p.rm_id
FROM   pasangan p
WHERE  k.id = p.kh_id;

-- ── 4. Verifikasi (opsional) ────────────────────────────────────────────────
-- SELECT count(*) FILTER (WHERE rekam_medis_id IS NOT NULL) AS tertaut,
--        count(*)                                          AS total_sakit
-- FROM public.ketidakhadiran WHERE jenis = 'SAKIT';
