-- Tabel tarif honor per modul pembayaran (Guru Asuh, Klinik, Ekskul, Kajian).
-- Satuan tetap per modul: Guru Asuh = per_bulan, sisanya = per_pertemuan.
CREATE TABLE IF NOT EXISTS tarif_honor (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    modul VARCHAR(30) UNIQUE NOT NULL,
    label VARCHAR(100) NOT NULL,
    satuan VARCHAR(20) NOT NULL DEFAULT 'per_pertemuan', -- 'per_bulan' | 'per_pertemuan'
    nominal NUMERIC(12, 0) NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    updated_by UUID,
    updated_by_name VARCHAR(255)
);

ALTER TABLE tarif_honor ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable all for all users" ON tarif_honor FOR ALL USING (true) WITH CHECK (true);

INSERT INTO tarif_honor (modul, label, satuan, nominal) VALUES
    ('GURU_ASUH', 'Guru Asuh', 'per_bulan', 0),
    ('KLINIK', 'Klinik Pembelajaran', 'per_pertemuan', 0),
    ('EKSKUL_INTERNAL', 'Ekstrakurikuler (Pelatih Internal)', 'per_pertemuan', 0),
    ('EKSKUL_EKSTERNAL', 'Ekstrakurikuler (Pelatih Eksternal)', 'per_pertemuan', 0),
    ('KAJIAN', 'Kajian', 'per_pertemuan', 0)
ON CONFLICT (modul) DO NOTHING;
