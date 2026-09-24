-- Migration: Nilai Apresiasi (kuis rebutan / cepat tepat)
-- Created: 2026-09-10
--
-- Poin rebutan SENGAJA dipisah dari nilai_data. Di nilai_data, satu tagihan
-- berarti "semua siswa dinilai pada hal yang sama", sehingga sel kosong wajar
-- dibaca sebagai 0 saat dirata-rata (lihat getAvg di app/nilai/view.tsx).
-- Rebutan tidak begitu: satu sesi 20 soal hanya menghasilkan maksimal 20
-- pemenang dari sekelas, dan siswa yang tidak pernah menang BUKAN berarti
-- nilainya nol — bisa jadi ia kalah cepat, atau tidak hadir. Menaruhnya di
-- nilai_data akan menyeret angka nol itu ke NA dan rapor.
--
-- Karena itu tabel ini berdiri sendiri dan TIDAK dibaca oleh perhitungan
-- rapor manapun. Guru melihat poinnya lalu memakainya secara manual.

CREATE TABLE IF NOT EXISTS nilai_apresiasi_sesi (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nip VARCHAR(255) NOT NULL,
    kelas VARCHAR(100) NOT NULL,
    mapel VARCHAR(100) NOT NULL,
    -- INTEGER mengikuti nilai_data (1=Ganjil, 2=Genap). Kolom `semester` di
    -- codebase ini campur INTEGER/TEXT antar tabel; yang dipakai di sini
    -- disamakan dengan tabel nilai tetangganya supaya query-nya seragam.
    semester INTEGER NOT NULL,
    tahun_ajaran VARCHAR(20),
    judul VARCHAR(255) NOT NULL,
    topik TEXT,
    poin_per_soal NUMERIC(5, 2) NOT NULL DEFAULT 1,
    tanggal DATE DEFAULT CURRENT_DATE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS nilai_apresiasi_poin (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sesi_id UUID NOT NULL REFERENCES nilai_apresiasi_sesi(id) ON DELETE CASCADE,
    nisn VARCHAR(50) NOT NULL,
    jumlah_menang INTEGER NOT NULL DEFAULT 0,
    total_poin NUMERIC(5, 2) NOT NULL DEFAULT 0,
    catatan TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    -- Satu baris per siswa per sesi; menyimpan ulang sesi yang sama meng-update
    -- baris yang ada, bukan menumpuk duplikat.
    CONSTRAINT nilai_apresiasi_poin_sesi_nisn_key UNIQUE (sesi_id, nisn)
);

CREATE INDEX IF NOT EXISTS idx_nilai_apresiasi_sesi_lookup
    ON nilai_apresiasi_sesi(nip, kelas, mapel, semester);
CREATE INDEX IF NOT EXISTS idx_nilai_apresiasi_poin_sesi
    ON nilai_apresiasi_poin(sesi_id);
-- Halaman siswa mencari poin miliknya sendiri lintas mapel.
CREATE INDEX IF NOT EXISTS idx_nilai_apresiasi_poin_nisn
    ON nilai_apresiasi_poin(nisn);

-- RLS sengaja TIDAK diaktifkan, mengikuti nilai_data/nilai_bobot/nilai_tagihan
-- (lihat 20260128_create_grading_tables.sql). Gerbangnya ada di lapisan API:
-- app/api/nilai/apresiasi/route.ts memakai getApiUser() lalu memaksa guru biasa
-- hanya menyentuh baris dengan nip miliknya sendiri.
