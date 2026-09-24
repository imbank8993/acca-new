CREATE TABLE IF NOT EXISTS testimonials (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    quote TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    is_active BOOLEAN DEFAULT TRUE
);

ALTER TABLE testimonials ENABLE ROW LEVEL SECURITY;

-- Allow public read access
CREATE POLICY "Allow public read" 
ON testimonials FOR SELECT 
USING (true);

-- Allow public insert access
CREATE POLICY "Allow public insert" 
ON testimonials FOR INSERT 
WITH CHECK (true);
