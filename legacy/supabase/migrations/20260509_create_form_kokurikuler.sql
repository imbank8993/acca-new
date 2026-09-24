-- Form Pendaftaran Kokurikuler
-- Program kokurikuler: Public Speaking, Robotik, Coding

CREATE TABLE IF NOT EXISTS form_pendaftaran_kokurikuler (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,

  -- Data Diri
  nisn TEXT,                        -- NISN siswa (untuk referensi ke siswa_kelas)
  nama_lengkap TEXT NOT NULL,
  kelas TEXT NOT NULL CHECK (kelas IN ('X', 'XI')),

  -- Pilihan Program
  pilihan_pertama TEXT NOT NULL CHECK (pilihan_pertama IN ('public_speaking', 'robotik', 'coding')),
  pilihan_kedua TEXT CHECK (pilihan_kedua IN ('public_speaking', 'robotik', 'coding')),

  -- Skor Tes Potensi (Bagian 2)
  skor_ps INTEGER DEFAULT 0,      -- Skor Sub-tes Public Speaking (0-4)
  skor_robotik INTEGER DEFAULT 0, -- Skor Sub-tes Robotik (0-4)
  skor_coding INTEGER DEFAULT 0,   -- Skor Sub-tes Coding (0-4)

  -- Skor Tie-Breaker (Bagian 3)
  skor_komitmen INTEGER DEFAULT 0,  -- Q13: Komitmen waktu (1-5)
  skor_reaksi INTEGER DEFAULT 0,    -- Q14: Reaksi materi sulit (0-10)
  skor_kelompok INTEGER DEFAULT 0,  -- Q15: Penanganan kelompok (0-10)
  skor_tiebreaker INTEGER GENERATED ALWAYS AS (skor_komitmen + skor_reaksi + skor_kelompok) STORED,

  -- Skor Utama sesuai pilihan pertama
  skor_utama INTEGER DEFAULT 0,

  -- Status Seleksi
  status_pertama TEXT DEFAULT 'menunggu' CHECK (status_pertama IN ('lolos', 'tidak_lolos', 'menunggu')),
  status_kedua TEXT DEFAULT 'menunggu' CHECK (status_kedua IN ('lolos', 'tidak_lolos', 'menunggu', 'tidak_diaktifkan')),
  program_diterima TEXT,

  -- Timestamps
  submitted_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  -- Metadata
  tahun_ajaran TEXT NOT NULL,
  semester INTEGER NOT NULL,
  durasi INTEGER DEFAULT 0,         -- Durasi pengerjaan dalam detik (tie-breaker utama)
  role TEXT DEFAULT 'SISWA'
);

-- Index untuk ranking
CREATE INDEX IF NOT EXISTS idx_form_kokurikuler_pilihan_pertama ON form_pendaftaran_kokurikuler(pilihan_pertama, status_pertama, skor_utama DESC, durasi ASC, submitted_at ASC);
CREATE INDEX IF NOT EXISTS idx_form_kokurikuler_pilihan_kedua ON form_pendaftaran_kokurikuler(pilihan_kedua, status_kedua, skor_utama DESC, durasi ASC, submitted_at ASC);
CREATE INDEX IF NOT EXISTS idx_form_kokurikuler_program ON form_pendaftaran_kokurikuler(program_diterima);
CREATE INDEX IF NOT EXISTS idx_form_kokurikuler_kelas ON form_pendaftaran_kokurikuler(kelas);
CREATE INDEX IF NOT EXISTS idx_form_kokurikuler_tahun ON form_pendaftaran_kokurikuler(tahun_ajaran, semester);

-- Kuota per program
CREATE TABLE IF NOT EXISTS form_kokurikuler_kuota (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  program TEXT NOT NULL UNIQUE CHECK (program IN ('public_speaking', 'robotik', 'coding')),
  kuota INTEGER NOT NULL DEFAULT 0,
  tahun_ajaran TEXT NOT NULL,
  semester INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Trigger untuk update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_form_kokurikuler_updated_at ON form_pendaftaran_kokurikuler;
CREATE TRIGGER update_form_kokurikuler_updated_at
  BEFORE UPDATE ON form_pendaftaran_kokurikuler
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_form_kokurikuler_kuota_updated_at ON form_kokurikuler_kuota;
CREATE TRIGGER update_form_kokurikuler_kuota_updated_at
  BEFORE UPDATE ON form_kokurikuler_kuota
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert default kuota untuk tahun ajaran aktif
INSERT INTO form_kokurikuler_kuota (program, kuota, tahun_ajaran, semester) VALUES
  ('public_speaking', 70, '2025/2026', 2),
  ('robotik', 40, '2025/2026', 2),
  ('coding', 35, '2025/2026', 2)
ON CONFLICT (program) DO NOTHING;
