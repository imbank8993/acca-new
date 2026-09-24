-- Migration: Create Laporan Guru Asuh Table
-- Created: 2026-02-10

CREATE TABLE IF NOT EXISTS laporan_guru_asuh (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    guru_asuh_id BIGINT REFERENCES guru_asuh(id) ON DELETE CASCADE,
    nip VARCHAR(255) NOT NULL,
    tanggal DATE NOT NULL DEFAULT CURRENT_DATE,
    kegiatan TEXT NOT NULL,
    hasil TEXT,
    foto_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for quick lookup
CREATE INDEX IF NOT EXISTS idx_laporan_ga_tanggal ON laporan_guru_asuh(tanggal);
CREATE INDEX IF NOT EXISTS idx_laporan_ga_nip ON laporan_guru_asuh(nip);
CREATE INDEX IF NOT EXISTS idx_laporan_ga_guru_asuh_id ON laporan_guru_asuh(guru_asuh_id);

-- Register permissions to master list if it exists
-- Note: master_permissions_list might be managed via JS script, 
-- but we can add them here as well for robustness if table exists.
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'master_permissions_list') THEN
        INSERT INTO master_permissions_list (category, resource, action, label, description)
        VALUES 
            ('02. AKADEMIK', 'laporan_guru_asuh', 'view', 'Laporan Guru Asuh - View', 'Lihat daftar laporan bimbingan'),
            ('02. AKADEMIK', 'laporan_guru_asuh', 'create', 'Laporan Guru Asuh - Tambah', 'Buat laporan bimbingan baru'),
            ('02. AKADEMIK', 'laporan_guru_asuh', 'update', 'Laporan Guru Asuh - Edit', 'Ubah laporan bimbingan'),
            ('02. AKADEMIK', 'laporan_guru_asuh', 'delete', 'Laporan Guru Asuh - Hapus', 'Hapus laporan bimbingan')
        ON CONFLICT (resource, action) DO NOTHING;
    END IF;
END $$;
