-- Create information categories table
CREATE TABLE IF NOT EXISTS informasi_akademik (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    title TEXT NOT NULL,
    category TEXT NOT NULL,
    file_url TEXT NOT NULL,
    file_name TEXT NOT NULL,
    file_type TEXT,
    file_size BIGINT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE informasi_akademik ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Allow public read access to informasi_akademik"
ON informasi_akademik FOR SELECT
USING (true);

CREATE POLICY "Allow authenticated users to manage informasi_akademik"
ON informasi_akademik FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_informasi_akademik_updated_at
    BEFORE UPDATE ON informasi_akademik
    FOR EACH ROW
    EXECUTE PROCEDURE update_updated_at_column();
