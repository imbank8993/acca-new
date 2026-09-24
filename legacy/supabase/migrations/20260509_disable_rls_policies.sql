-- Disable Row Level Security (RLS) on form tables to prevent policy violation errors
ALTER TABLE form_pendaftaran_kokurikuler DISABLE ROW LEVEL SECURITY;
ALTER TABLE form_kokurikuler_kuota DISABLE ROW LEVEL SECURITY;

-- Alternatively, permissive policies for security enthusiasts
-- ALTER TABLE form_pendaftaran_kokurikuler ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY "Allow public insert" ON form_pendaftaran_kokurikuler FOR INSERT TO public WITH CHECK (true);
-- CREATE POLICY "Allow public select" ON form_pendaftaran_kokurikuler FOR SELECT TO public USING (true);
-- CREATE POLICY "Allow public update" ON form_pendaftaran_kokurikuler FOR UPDATE TO public USING (true);
-- CREATE POLICY "Allow public delete" ON form_pendaftaran_kokurikuler FOR DELETE TO public USING (true);

-- ALTER TABLE form_kokurikuler_kuota ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY "Allow public select" ON form_kokurikuler_kuota FOR SELECT TO public USING (true);
-- CREATE POLICY "Allow public upsert" ON form_kokurikuler_kuota FOR ALL TO public USING (true) WITH CHECK (true);
