-- Add status_pelatih to ekskul_pertemuan
ALTER TABLE ekskul_pertemuan ADD COLUMN IF NOT EXISTS status_pelatih VARCHAR(20) DEFAULT 'Internal';
