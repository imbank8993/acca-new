-- =====================================================
-- Sample Data: Import Jadwal Guru
-- Berdasarkan screenshot yang diupload
-- =====================================================

-- Insert jadwal untuk Guru G-IC-001 (Imran) - Matematika
INSERT INTO jadwal_guru (guru_id, nama_guru, hari, jam_ke, kelas, mata_pelajaran, tahun_ajaran, semester, aktif)
VALUES
    -- Senin: XI C jam 5-7 (3 JP)
    ('G-IC-001', 'Imran', 'Senin', '5-7', 'XI C', 'Matematika', '2024/2025', 2, true),
    
    -- Selasa: XI D jam 1-3, XI B jam 5-6
    ('G-IC-001', 'Imran', 'Selasa', '1-3', 'XI D', 'Matematika', '2024/2025', 2, true),
    ('G-IC-001', 'Imran', 'Selasa', '5-6', 'XI B', 'Matematika', '2024/2025', 2, true)
ON CONFLICT DO NOTHING;

-- =====================================================
-- Verifikasi Data
-- =====================================================

-- Lihat jadwal yang sudah diinsert
SELECT 
    id,
    guru_id,
    nama_guru,
    hari,
    jam_ke,
    kelas,
    mata_pelajaran,
    aktif
FROM jadwal_guru
WHERE guru_id = 'G-IC-001'
ORDER BY 
    CASE hari
        WHEN 'Senin' THEN 1
        WHEN 'Selasa' THEN 2
        WHEN 'Rabu' THEN 3
        WHEN 'Kamis' THEN 4
        WHEN 'Jumat' THEN 5
        WHEN 'Sabtu' THEN 6
    END,
    jam_ke;

-- Hitung total jadwal per guru
SELECT 
    guru_id,
    nama_guru,
    COUNT(*) as total_pertemuan
FROM jadwal_guru
WHERE aktif = true
GROUP BY guru_id, nama_guru
ORDER BY total_pertemuan DESC;

-- =====================================================
-- Contoh Insert Sesi Absensi (opsional untuk testing)
-- =====================================================

-- Contoh sesi untuk XI C, Matematika, 2026-01-21, jam 5-7
INSERT INTO absensi_sesi (
    sesi_id,
    tanggal,
    kelas,
    mapel,
    jam_ke,
    guru_id,
    nama_guru,
    status_sesi,
    draft_type,
    materi,
    tahun_ajaran,
    semester,
    created_by
) VALUES (
    gen_random_uuid()::text,  -- Generate UUID otomatis
    '2026-01-21',
    'XI C',
    'Matematika',
    '5-7',
    'G-IC-001',
    'Imran',
    'DRAFT',
    'DRAFT_DEFAULT',
    'Pengenalan Matriks',
    '2024/2025',
    2,
    'G-IC-001'
) ON CONFLICT (kelas, tanggal, jam_ke, mapel) DO NOTHING;

-- Lihat sesi yang baru dibuat
SELECT 
    sesi_id,
    tanggal,
    kelas,
    mapel,
    jam_ke,
    status_sesi,
    draft_type,
    materi
FROM absensi_sesi
ORDER BY created_at DESC
LIMIT 10;
