-- Create table for upload categories (managed by admin in acca-app)
CREATE TABLE IF NOT EXISTS upload_categories (
    id UUID DEFAULT extensions.uuid_generate_v4() PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create table for uploaded documents (metadata)
CREATE TABLE IF NOT EXISTS uploaded_documents (
    id UUID DEFAULT extensions.uuid_generate_v4() PRIMARY KEY,
    category_id UUID REFERENCES upload_categories(id) ON DELETE CASCADE,
    category_name TEXT NOT NULL, -- Keep name for easier reference
    uploader_name TEXT NOT NULL,
    uploader_role TEXT CHECK (uploader_role IN ('siswa', 'guru')),
    file_name TEXT NOT NULL,
    file_url TEXT NOT NULL, -- URL to actual file on hosting
    file_path TEXT NOT NULL, -- Relative path on server
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add some initial categories if needed
-- INSERT INTO upload_categories (name) VALUES ('Tugas Akhir'), ('Laporan Praktikum'), ('Sertifikat');

-- RLS Policies (Adjust as needed)
ALTER TABLE upload_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE uploaded_documents ENABLE ROW LEVEL SECURITY;

-- Allow public read for categories (so akademik-app can fetch them)
CREATE POLICY "Allow public read categories" ON upload_categories
    FOR SELECT USING (true);

-- Allow authenticated/admin to manage categories
CREATE POLICY "Allow admin manage categories" ON upload_categories
    FOR ALL USING (true); -- Simplified, replace with proper auth check if needed

-- Allow public/siswa to insert document metadata
CREATE POLICY "Allow public insert documents" ON uploaded_documents
    FOR INSERT WITH CHECK (true);

-- Allow admin to view/manage all documents
CREATE POLICY "Allow admin manage documents" ON uploaded_documents
    FOR ALL USING (true);
