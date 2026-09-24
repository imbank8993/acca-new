-- =====================================================================
-- PERBAIKAN MODUL KEUANGAN
-- 1) Ubah kolom status dari ENUM -> VARCHAR agar workflow (Revisi PJ,
--    Menunggu Konfirmasi PJ, Menunggu Laporan PJ, Pending Pencairan,
--    Proses Laporan, Arsip Selesai, Telah Diterima, dst) tidak ditolak
--    Postgres karena bukan anggota enum.
-- 2) Kunci RLS: tabel keuangan hanya boleh diubah lewat service role
--    (API terautentikasi). User biasa tidak lagi bisa menulis/membaca
--    langsung dari client.
-- Jalankan manual via Supabase Dashboard > SQL Editor.
-- =====================================================================

-- 1. budget_requests.status : enum budget_request_status -> varchar
ALTER TABLE budget_requests ALTER COLUMN status DROP DEFAULT;
ALTER TABLE budget_requests ALTER COLUMN status TYPE VARCHAR(50) USING status::text;
ALTER TABLE budget_requests ALTER COLUMN status SET DEFAULT 'Draft';

-- 2. disbursements.status : enum disbursement_status -> varchar
ALTER TABLE disbursements ALTER COLUMN status DROP DEFAULT;
ALTER TABLE disbursements ALTER COLUMN status TYPE VARCHAR(50) USING status::text;
ALTER TABLE disbursements ALTER COLUMN status SET DEFAULT 'Menunggu Konfirmasi';

-- (kategori Transport/Honor/Bahan tetap ENUM karena stabil)

-- 3. Kunci RLS - hapus policy permisif "FOR ALL authenticated" dan ganti
--    dengan HANYA service_role (API) yang boleh baca/tulis. Client tidak
--    lagi mengakses tabel ini langsung (semua lewat /api/keuangan).
DO $$
DECLARE
    t TEXT;
    pol RECORD;
    tables TEXT[] := ARRAY[
        'divisions','financial_officers','division_budgets','budget_requests',
        'budget_request_items','approval_logs','disbursements'
    ];
BEGIN
    FOREACH t IN ARRAY tables LOOP
        -- Drop semua policy lama pada tabel
        FOR pol IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = t LOOP
            EXECUTE format('DROP POLICY IF EXISTS %I ON %I', pol.policyname, t);
        END LOOP;
        -- Pastikan RLS aktif (service_role otomatis bypass RLS)
        EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
        -- Tidak ada policy utk authenticated => user biasa tidak punya akses
        -- langsung. Semua operasi wajib lewat API service role.
    END LOOP;
END$$;
