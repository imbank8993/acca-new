-- Rename letter type 'AKHIR_PEKAN' -> 'MENINGGALKAN_ASRAMA'.
-- "Surat Izin Meninggalkan Asrama" sekarang juga diterbitkan dari baris SAKIT
-- (status Sedang/Berat/Kontrol) lewat OP Izin, bukan cuma dari baris IZIN akhir
-- pekan seperti semula — nama 'AKHIR_PEKAN' sudah tidak mewakili kondisinya.

ALTER TABLE acca_letters DROP CONSTRAINT IF EXISTS acca_letters_jenis_izin_check;

UPDATE acca_letters SET jenis_izin = 'MENINGGALKAN_ASRAMA' WHERE jenis_izin = 'AKHIR_PEKAN';

ALTER TABLE acca_letters ADD CONSTRAINT acca_letters_jenis_izin_check
    CHECK (jenis_izin IN ('P', 'M', 'MENINGGALKAN_ASRAMA', 'REKAM_MEDIK', 'REKOMENDASI_KONTROL'));

-- surat_templates.jenis_surat tidak punya CHECK constraint, tapi backfill supaya
-- template/background yang sudah diupload untuk 'AKHIR_PEKAN' tetap ketemu.
UPDATE surat_templates SET jenis_surat = 'MENINGGALKAN_ASRAMA' WHERE jenis_surat = 'AKHIR_PEKAN';
