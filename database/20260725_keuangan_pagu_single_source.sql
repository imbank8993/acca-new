-- =====================================================================
-- PAGU KEUANGAN: GABUNG JADI 1 SUMBER ANGGARAN PER DIVISI + TAHUN
-- Sebelumnya pagu dipecah per kategori (Transport/Honor/Bahan) sehingga
-- ada 3 baris per divisi/tahun. Sekarang cukup 1 baris (tanpa kategori).
--
-- Migrasi ini:
--   1) Melonggarkan kolom `category` (boleh NULL) pada division_budgets.
--   2) Menggabungkan baris per-kategori yang sudah ada menjadi 1 baris
--      per (division_id, period) dengan menjumlahkan initial_budget &
--      total_budget.
--   3) Mengganti UNIQUE(division_id, category, period) menjadi
--      UNIQUE(division_id, period).
--
-- Catatan: kolom `category` pada budget_request_items TIDAK diubah —
-- kategori item tetap sebagai info klasifikasi rincian pengajuan.
--
-- Jalankan manual via Supabase Dashboard > SQL Editor.
-- =====================================================================

BEGIN;

-- 1. category boleh NULL (baris pagu gabungan tidak berkategori)
ALTER TABLE division_budgets ALTER COLUMN category DROP NOT NULL;

-- 2. Gabungkan baris per-kategori -> 1 baris per (division_id, period).
--    Baris tertua (created_at terkecil) dipertahankan & diisi hasil
--    penjumlahan; baris lainnya dihapus. (id bertipe UUID sehingga tidak
--    bisa pakai MIN(id); pemilihan baris pakai array_agg ORDER BY created_at.)
WITH agg AS (
    SELECT
        division_id,
        period,
        (array_agg(id ORDER BY created_at ASC, id ASC))[1]   AS keep_id,
        SUM(COALESCE(initial_budget, total_budget))          AS sum_initial,
        SUM(total_budget)                                    AS sum_total
    FROM division_budgets
    GROUP BY division_id, period
)
UPDATE division_budgets db
SET initial_budget = agg.sum_initial,
    total_budget   = agg.sum_total,
    category       = NULL
FROM agg
WHERE db.id = agg.keep_id;

DELETE FROM division_budgets db
WHERE db.id NOT IN (
    SELECT (array_agg(id ORDER BY created_at ASC, id ASC))[1]
    FROM division_budgets
    GROUP BY division_id, period
);

-- 3. Ganti constraint unik: kategori tidak lagi jadi pembeda.
ALTER TABLE division_budgets
    DROP CONSTRAINT IF EXISTS division_budgets_division_id_category_period_key;
CREATE UNIQUE INDEX IF NOT EXISTS division_budgets_division_period_key
    ON division_budgets (division_id, period);

COMMIT;
