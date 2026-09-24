-- Menambahkan kolom untuk menyimpan skor otomatis
ALTER TABLE custom_form_responses 
ADD COLUMN IF NOT EXISTS total_score integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS category_scores jsonb DEFAULT '{}'::jsonb;
