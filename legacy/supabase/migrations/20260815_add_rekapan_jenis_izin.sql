ALTER TABLE acca_letters DROP CONSTRAINT IF EXISTS acca_letters_jenis_izin_check;

ALTER TABLE acca_letters ADD CONSTRAINT acca_letters_jenis_izin_check
    CHECK (jenis_izin IN ('P', 'M', 'MENINGGALKAN_ASRAMA', 'REKAM_MEDIK', 'REKOMENDASI_KONTROL', 'REKAPAN_IZIN', 'REKAPAN_SAKIT'));
