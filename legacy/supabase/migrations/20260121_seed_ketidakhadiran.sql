-- Migration: Seed sample ketidakhadiran data
-- Created: 2026-01-21
-- Description: Inserts sample data for testing the Absensi integration

-- Insert sample data
INSERT INTO ketidakhadiran (
    jenis, 
    nisn, 
    nama, 
    kelas, 
    tgl_mulai, 
    tgl_selesai, 
    keterangan, 
    status, 
    aktif
) VALUES 
-- Sample 1: Izin for today
(
    'IZIN', 
    '1234567890', 
    'Ahmad Siswa', 
    'X-A', 
    CURRENT_DATE, 
    CURRENT_DATE, 
    'Lomba Matematika|Dinas Pendidikan|Jakarta', 
    'MADRASAH', 
    TRUE
),
-- Sample 2: Sakit for today and tomorrow
(
    'SAKIT', 
    '0987654321', 
    'Budi Santoso', 
    'X-A', 
    CURRENT_DATE, 
    CURRENT_DATE + INTERVAL '1 day', 
    'Demam tinggi', 
    'Sedang', 
    TRUE
);
