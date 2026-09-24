-- Add show_on_landing column to informasi_akademik table
ALTER TABLE informasi_akademik 
ADD COLUMN IF NOT EXISTS show_on_landing BOOLEAN DEFAULT true;

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_informasi_akademik_show_on_landing 
ON informasi_akademik(show_on_landing);
