-- Ubah kolom status di semua tabel PTSP dari TEXT ke INTEGER
-- 0 = Ditolak, 1 = Pending, 2-99 = Proses %, 100 = Selesai

ALTER TABLE ptsp_master_tracking  ALTER COLUMN status TYPE INTEGER USING (status::integer);
ALTER TABLE ptsp_buku_tamu        ALTER COLUMN status TYPE INTEGER USING (status::integer);
ALTER TABLE ptsp_izin_siswa       ALTER COLUMN status TYPE INTEGER USING (status::integer);
ALTER TABLE ptsp_izin_magang      ALTER COLUMN status TYPE INTEGER USING (status::integer);
ALTER TABLE ptsp_legalisir        ALTER COLUMN status TYPE INTEGER USING (status::integer);
ALTER TABLE ptsp_mutasi_siswa     ALTER COLUMN status TYPE INTEGER USING (status::integer);
ALTER TABLE ptsp_pengganti_ijazah ALTER COLUMN status TYPE INTEGER USING (status::integer);
ALTER TABLE ptsp_sosialisasi      ALTER COLUMN status TYPE INTEGER USING (status::integer);

-- Set default value
ALTER TABLE ptsp_master_tracking  ALTER COLUMN status SET DEFAULT 1;
ALTER TABLE ptsp_buku_tamu        ALTER COLUMN status SET DEFAULT 1;
ALTER TABLE ptsp_izin_siswa       ALTER COLUMN status SET DEFAULT 1;
ALTER TABLE ptsp_izin_magang      ALTER COLUMN status SET DEFAULT 1;
ALTER TABLE ptsp_legalisir        ALTER COLUMN status SET DEFAULT 1;
ALTER TABLE ptsp_mutasi_siswa     ALTER COLUMN status SET DEFAULT 1;
ALTER TABLE ptsp_pengganti_ijazah ALTER COLUMN status SET DEFAULT 1;
ALTER TABLE ptsp_sosialisasi      ALTER COLUMN status SET DEFAULT 1;
