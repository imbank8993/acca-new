ALTER TABLE sv_unggahan_guru DROP CONSTRAINT IF EXISTS sv_unggahan_guru_penugasan_id_dokumen_id_key;
TRUNCATE TABLE sv_unggahan_guru CASCADE;
ALTER TABLE sv_unggahan_guru DROP CONSTRAINT IF EXISTS sv_unggahan_guru_penugasan_id_fkey;
ALTER TABLE sv_unggahan_guru DROP COLUMN IF EXISTS penugasan_id;
ALTER TABLE sv_unggahan_guru ADD COLUMN IF NOT EXISTS guru_nip VARCHAR NOT NULL;
ALTER TABLE sv_unggahan_guru ADD COLUMN IF NOT EXISTS tahun_ajaran_id INT NOT NULL;
ALTER TABLE sv_unggahan_guru ADD CONSTRAINT sv_unggahan_guru_tahun_fkey FOREIGN KEY (tahun_ajaran_id) REFERENCES master_tahun_ajaran(id) ON DELETE CASCADE;
ALTER TABLE sv_unggahan_guru ADD CONSTRAINT sv_unggahan_guru_guru_nip_tahun_dokumen_key UNIQUE(guru_nip, tahun_ajaran_id, dokumen_id);
CREATE INDEX IF NOT EXISTS idx_sv_unggahan_guru_tahun ON sv_unggahan_guru(guru_nip, tahun_ajaran_id);
