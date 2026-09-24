-- Update NIP yang kosong di tabel jurnal_guru berdasarkan nama_guru yang cocok dengan nama_lengkap di master_guru
UPDATE jurnal_guru
SET nip = mg.nip
FROM master_guru mg
WHERE (jurnal_guru.nip IS NULL OR jurnal_guru.nip = '' OR jurnal_guru.nip = '-')
  AND jurnal_guru.nama_guru = mg.nama_lengkap;

-- Optional: Tambahkan pengecekan case-insensitive jika diperlukan
-- AND LOWER(TRIM(jurnal_guru.nama_guru)) = LOWER(TRIM(mg.nama_lengkap));
