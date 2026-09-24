
-- Create Tables for Laporan Piket (Replaces any previous simple structure if it existed)

-- Main Header Table
CREATE TABLE IF NOT EXISTS laporan_piket (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tanggal DATE NOT NULL,
    nama_guru_piket TEXT NOT NULL,
    nip_guru_piket TEXT,
    jam_ke TEXT NOT NULL,
    keterangan TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Detail Table (Per Class)
CREATE TABLE IF NOT EXISTS laporan_piket_detail (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    piket_id UUID NOT NULL REFERENCES laporan_piket(id) ON DELETE CASCADE,
    nama_kelas TEXT NOT NULL,
    nama_guru TEXT, -- Guru at the class
    status_kehadiran TEXT,
    dokumentasi_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE laporan_piket ENABLE ROW LEVEL SECURITY;
ALTER TABLE laporan_piket_detail ENABLE ROW LEVEL SECURITY;

-- Policies (Public for now as it seems to be a public reporting app, or authenticated)
-- Allowing public insert/view for simplicity based on current flow
CREATE POLICY "Allow public insert laporan_piket" ON laporan_piket FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public select laporan_piket" ON laporan_piket FOR SELECT USING (true);
CREATE POLICY "Allow public insert laporan_piket_detail" ON laporan_piket_detail FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public select laporan_piket_detail" ON laporan_piket_detail FOR SELECT USING (true);

-- Storage Bucket for reports
INSERT INTO storage.buckets (id, name, public) 
VALUES ('laporan', 'laporan', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Public Access Laporan" ON storage.objects FOR SELECT USING (bucket_id = 'laporan');
CREATE POLICY "Public Insert Laporan" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'laporan');
