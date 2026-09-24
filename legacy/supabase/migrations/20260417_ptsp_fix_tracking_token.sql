-- Fix tracking_token in all child tables to match ptsp_master_tracking.id
-- Match by: no_wa = wa (or no_wa) AND table_name label

-- ptsp_sosialisasi
UPDATE ptsp_sosialisasi c
SET tracking_token = m.id
FROM ptsp_master_tracking m
WHERE m.table_name = 'sosialisasi'
  AND m.no_wa = c.wa
  AND m.no_wa IS NOT NULL
  AND c.wa IS NOT NULL;

-- ptsp_buku_tamu
UPDATE ptsp_buku_tamu c
SET tracking_token = m.id
FROM ptsp_master_tracking m
WHERE m.table_name = 'buku_tamu'
  AND m.no_wa = c.wa
  AND m.no_wa IS NOT NULL
  AND c.wa IS NOT NULL;

-- ptsp_izin_siswa (table_name = 'izin_siswa', wa column = 'wa')
UPDATE ptsp_izin_siswa c
SET tracking_token = m.id
FROM ptsp_master_tracking m
WHERE m.table_name = 'izin_siswa'
  AND m.no_wa = c.wa
  AND m.no_wa IS NOT NULL
  AND c.wa IS NOT NULL;

-- ptsp_izin_magang
UPDATE ptsp_izin_magang c
SET tracking_token = m.id
FROM ptsp_master_tracking m
WHERE m.table_name = 'izin_magang'
  AND m.no_wa = c.wa
  AND m.no_wa IS NOT NULL
  AND c.wa IS NOT NULL;

-- ptsp_legalisir
UPDATE ptsp_legalisir c
SET tracking_token = m.id
FROM ptsp_master_tracking m
WHERE m.table_name = 'legalisir'
  AND m.no_wa = c.wa
  AND m.no_wa IS NOT NULL
  AND c.wa IS NOT NULL;

-- ptsp_mutasi_siswa (wa column = 'wa')
UPDATE ptsp_mutasi_siswa c
SET tracking_token = m.id
FROM ptsp_master_tracking m
WHERE m.table_name = 'mutasi_siswa'
  AND m.no_wa = c.wa
  AND m.no_wa IS NOT NULL
  AND c.wa IS NOT NULL;

-- ptsp_pengganti_ijazah (wa column = 'wa')
UPDATE ptsp_pengganti_ijazah c
SET tracking_token = m.id
FROM ptsp_master_tracking m
WHERE m.table_name = 'pengganti_ijazah'
  AND m.no_wa = c.wa
  AND m.no_wa IS NOT NULL
  AND c.wa IS NOT NULL;

-- ptsp_peminjaman_sarana
UPDATE ptsp_peminjaman_sarana c
SET tracking_token = m.id
FROM ptsp_master_tracking m
WHERE m.table_name = 'peminjaman_sarana'
  AND m.no_wa = c.wa
  AND m.no_wa IS NOT NULL
  AND c.wa IS NOT NULL;

-- ptsp_izin_penelitian
UPDATE ptsp_izin_penelitian c
SET tracking_token = m.id
FROM ptsp_master_tracking m
WHERE m.table_name = 'izin_penelitian'
  AND m.no_wa = c.wa
  AND m.no_wa IS NOT NULL
  AND c.wa IS NOT NULL;

-- ptsp_pengaduan
UPDATE ptsp_pengaduan c
SET tracking_token = m.id
FROM ptsp_master_tracking m
WHERE m.table_name = 'pengaduan'
  AND m.no_wa = c.wa
  AND m.no_wa IS NOT NULL
  AND c.wa IS NOT NULL;
