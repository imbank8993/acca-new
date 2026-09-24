-- 5. Tabel Pemetaan Mapel per Kelas
CREATE TABLE IF NOT EXISTS ujian_madrasah_mapel_kelas (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    mapel_id    UUID REFERENCES ujian_madrasah_mapel(id) ON DELETE CASCADE,
    kelas       TEXT NOT NULL,
    tahun_ajaran TEXT NOT NULL,
    created_at  TIMESTAMPTZ DEFAULT now(),

    CONSTRAINT um_mapel_kelas_unique UNIQUE (mapel_id, kelas, tahun_ajaran)
);

CREATE POLICY "UM Mapel Kelas: authenticated can read" ON ujian_madrasah_mapel_kelas
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "UM Mapel Kelas: authenticated can write" ON ujian_madrasah_mapel_kelas
    FOR ALL USING (auth.role() = 'authenticated');

ALTER TABLE ujian_madrasah_mapel_kelas ENABLE ROW LEVEL SECURITY;
