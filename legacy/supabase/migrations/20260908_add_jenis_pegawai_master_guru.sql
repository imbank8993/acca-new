-- Migration: pisahkan Guru dan Tendik di dalam satu tabel master_guru
--
-- Alasan tidak memakai tabel master_tendik terpisah: kolom `nip` sudah menjadi
-- target foreign key (jadwal_piket.nip, master_mapel_kelas.guru_nip,
-- rekening_guru.nip) dan menjadi kunci join di puluhan modul lain (users,
-- jurnal_guru, tugas_tambahan, ketidakhadiran, surat, absensi). Memindahkan
-- baris antar tabel akan memutus semua rujukan itu. Dengan kolom penanda,
-- fitur "Pindah" cukup satu UPDATE dan seluruh riwayat pegawai tetap utuh.

ALTER TABLE master_guru
  ADD COLUMN IF NOT EXISTS jenis_pegawai TEXT NOT NULL DEFAULT 'GURU';

-- Baris lama (48 per 2026-09-08) semuanya guru.
UPDATE master_guru SET jenis_pegawai = 'GURU'
WHERE jenis_pegawai IS NULL OR btrim(jenis_pegawai) = '';

-- VARCHAR biasa + CHECK, bukan enum: menambah jenis baru nanti (mis. 'HONORER')
-- cukup ubah constraint, tidak perlu ALTER TYPE yang mengunci tabel.
ALTER TABLE master_guru DROP CONSTRAINT IF EXISTS master_guru_jenis_pegawai_check;
ALTER TABLE master_guru
  ADD CONSTRAINT master_guru_jenis_pegawai_check
  CHECK (jenis_pegawai IN ('GURU', 'TENDIK'));

-- Tab Guru dan tab Tendik selalu memfilter kolom ini lalu mengurutkan nama.
CREATE INDEX IF NOT EXISTS idx_master_guru_jenis_pegawai
  ON master_guru (jenis_pegawai, nama_lengkap);

COMMENT ON COLUMN master_guru.jenis_pegawai IS
  'GURU = tenaga pendidik, TENDIK = tenaga kependidikan (pegawai non guru). Dipakai tab Master Data > Guru/Tendik dan fitur Pindah.';
