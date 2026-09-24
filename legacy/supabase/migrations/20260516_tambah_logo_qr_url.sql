-- =====================================================
-- ACCA App: Tambah kolom logo_qr_url di config_surat
-- Migration: Add logo_qr_url column for ACCA logo on QR codes
-- Date: 2026-05-16
-- =====================================================

ALTER TABLE config_surat
    ADD COLUMN IF NOT EXISTS logo_qr_url TEXT;

COMMENT ON COLUMN config_surat.logo_qr_url IS 'Logo ACCA khusus untuk overlay di tengah barcode verifikasi digital (ttd digital)';

-- Set default ACCA logo (qr_final.png di public folder)
-- Admin bisa overwrite nilainya via UI Pengaturan Surat
-- Ini nilai placeholder default agar QR ttd digital pakai logo ACCA