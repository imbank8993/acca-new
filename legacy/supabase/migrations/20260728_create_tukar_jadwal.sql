-- =====================================================================
-- Tukar Jadwal Guru (permanen) — mencakup jadwal MENGAJAR dan PIKET
-- Alur: Guru A ajukan -> Guru B setuju -> WKM Akademik setuju -> jadwal ditukar
--
-- MENGAJAR (jadwal_guru): unit tukar = SATU baris.
--   Operasi = menukar (nip, nama_guru, mata_pelajaran) antar dua baris.
--
-- PIKET (jadwal_piket): unit tukar = SATU GRUP baris, yaitu semua baris dengan
--   (nip, hari, jam_ke, berlaku_mulai) yang sama — di produksi satu grup piket
--   mencakup ~15 kelas sekaligus. Operasi = menukar (nip, kode_guru) untuk
--   SELURUH baris di grup, tidak boleh sebagian.
--
-- Pada kedua kasus kolom hari/jam_ke/kelas/ruang tetap di barisnya, sehingga
-- susunan jadwal tiap KELAS tidak berubah. Yang divalidasi hanya bentrok GURU.
--
-- Skrip ini idempoten: aman dijalankan ulang.
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.tukar_jadwal_request (
    id                  BIGSERIAL PRIMARY KEY,

    -- 'mengajar' (jadwal_guru) | 'piket' (jadwal_piket)
    jenis               TEXT   NOT NULL DEFAULT 'mengajar',

    -- Pemohon (Guru A) + snapshot slot miliknya saat pengajuan
    requester_nip       TEXT   NOT NULL,
    requester_nama      TEXT   NOT NULL,
    requester_jadwal_id BIGINT REFERENCES public.jadwal_guru(id) ON DELETE CASCADE,
    requester_piket_key TEXT,
    requester_hari      TEXT   NOT NULL,
    requester_jam_ke    TEXT   NOT NULL,
    requester_kelas     TEXT,
    requester_mapel     TEXT,

    -- Tujuan (Guru B) + snapshot slot miliknya saat pengajuan
    target_nip          TEXT   NOT NULL,
    target_nama         TEXT   NOT NULL,
    target_jadwal_id    BIGINT REFERENCES public.jadwal_guru(id) ON DELETE CASCADE,
    target_piket_key    TEXT,
    target_hari         TEXT   NOT NULL,
    target_jam_ke       TEXT   NOT NULL,
    target_kelas        TEXT,
    target_mapel        TEXT,

    -- Versi jadwal (berlaku_mulai) tiap sisi saat pengajuan dibuat. Dipakai
    -- sebagai guard: bila admin mengimpor jadwal versi baru, ajuan lama tidak
    -- boleh diterapkan karena baris yang dirujuk sudah bukan versi berjalan.
    requester_berlaku_mulai DATE,
    target_berlaku_mulai    DATE,
    alasan              TEXT,

    -- State machine (TEXT, bukan enum — supaya mudah ditambah)
    -- menunggu_guru | menunggu_wkm | disetujui | ditolak_guru | ditolak_wkm | dibatalkan
    status              TEXT NOT NULL DEFAULT 'menunggu_guru',

    guru_responded_at   TIMESTAMPTZ,
    guru_catatan        TEXT,

    wkm_nip             TEXT,
    wkm_nama            TEXT,
    wkm_responded_at    TIMESTAMPTZ,
    wkm_catatan         TEXT,

    applied_at          TIMESTAMPTZ,

    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Penyesuaian bila tabel sudah dibuat versi sebelumnya (hanya mengajar) ──
ALTER TABLE public.tukar_jadwal_request
    ADD COLUMN IF NOT EXISTS jenis               TEXT NOT NULL DEFAULT 'mengajar',
    ADD COLUMN IF NOT EXISTS requester_piket_key TEXT,
    ADD COLUMN IF NOT EXISTS target_piket_key    TEXT,
    ADD COLUMN IF NOT EXISTS requester_berlaku_mulai DATE,
    ADD COLUMN IF NOT EXISTS target_berlaku_mulai    DATE;

-- Kolom ini kini opsional: piket tidak merujuk satu baris jadwal_guru,
-- dan tidak punya mata pelajaran.
ALTER TABLE public.tukar_jadwal_request ALTER COLUMN requester_jadwal_id DROP NOT NULL;
ALTER TABLE public.tukar_jadwal_request ALTER COLUMN target_jadwal_id    DROP NOT NULL;
ALTER TABLE public.tukar_jadwal_request ALTER COLUMN requester_kelas     DROP NOT NULL;
ALTER TABLE public.tukar_jadwal_request ALTER COLUMN target_kelas        DROP NOT NULL;
ALTER TABLE public.tukar_jadwal_request ALTER COLUMN requester_mapel     DROP NOT NULL;
ALTER TABLE public.tukar_jadwal_request ALTER COLUMN target_mapel        DROP NOT NULL;

-- ── Constraint (drop-then-add supaya idempoten) ──
ALTER TABLE public.tukar_jadwal_request DROP CONSTRAINT IF EXISTS tukar_jadwal_status_valid;
ALTER TABLE public.tukar_jadwal_request ADD  CONSTRAINT tukar_jadwal_status_valid CHECK (
    status IN ('menunggu_guru','menunggu_wkm','disetujui','ditolak_guru','ditolak_wkm','dibatalkan')
);

ALTER TABLE public.tukar_jadwal_request DROP CONSTRAINT IF EXISTS tukar_jadwal_jenis_valid;
ALTER TABLE public.tukar_jadwal_request ADD  CONSTRAINT tukar_jadwal_jenis_valid CHECK (
    jenis IN ('mengajar','piket')
);

ALTER TABLE public.tukar_jadwal_request DROP CONSTRAINT IF EXISTS tukar_jadwal_beda_guru;
ALTER TABLE public.tukar_jadwal_request ADD  CONSTRAINT tukar_jadwal_beda_guru CHECK (
    requester_nip <> target_nip
);

-- Bentuk data harus sesuai jenisnya, dan kedua sisi wajib berbeda slot.
ALTER TABLE public.tukar_jadwal_request DROP CONSTRAINT IF EXISTS tukar_jadwal_beda_slot;
ALTER TABLE public.tukar_jadwal_request DROP CONSTRAINT IF EXISTS tukar_jadwal_bentuk_valid;
ALTER TABLE public.tukar_jadwal_request ADD  CONSTRAINT tukar_jadwal_bentuk_valid CHECK (
    (jenis = 'mengajar'
        AND requester_jadwal_id IS NOT NULL AND target_jadwal_id IS NOT NULL
        AND requester_jadwal_id <> target_jadwal_id)
    OR
    (jenis = 'piket'
        AND requester_piket_key IS NOT NULL AND target_piket_key IS NOT NULL
        AND requester_piket_key <> target_piket_key)
);

CREATE INDEX IF NOT EXISTS idx_tukar_jadwal_requester ON public.tukar_jadwal_request(requester_nip, status);
CREATE INDEX IF NOT EXISTS idx_tukar_jadwal_target    ON public.tukar_jadwal_request(target_nip, status);
CREATE INDEX IF NOT EXISTS idx_tukar_jadwal_status    ON public.tukar_jadwal_request(status, created_at DESC);

-- Satu slot (baris mengajar / grup piket) hanya boleh terlibat di SATU ajuan
-- yang masih berjalan, baik sebagai sisi pemohon maupun sisi tujuan.
CREATE UNIQUE INDEX IF NOT EXISTS uniq_tukar_jadwal_pending_requester
    ON public.tukar_jadwal_request(requester_jadwal_id)
    WHERE status IN ('menunggu_guru','menunggu_wkm') AND requester_jadwal_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uniq_tukar_jadwal_pending_target
    ON public.tukar_jadwal_request(target_jadwal_id)
    WHERE status IN ('menunggu_guru','menunggu_wkm') AND target_jadwal_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uniq_tukar_piket_pending_requester
    ON public.tukar_jadwal_request(requester_piket_key)
    WHERE status IN ('menunggu_guru','menunggu_wkm') AND requester_piket_key IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uniq_tukar_piket_pending_target
    ON public.tukar_jadwal_request(target_piket_key)
    WHERE status IN ('menunggu_guru','menunggu_wkm') AND target_piket_key IS NOT NULL;

-- updated_at otomatis
CREATE OR REPLACE FUNCTION public.set_tukar_jadwal_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_tukar_jadwal_updated_at ON public.tukar_jadwal_request;
CREATE TRIGGER trg_tukar_jadwal_updated_at
    BEFORE UPDATE ON public.tukar_jadwal_request
    FOR EACH ROW EXECUTE FUNCTION public.set_tukar_jadwal_updated_at();

-- RLS dikunci: seluruh akses lewat API route (service role) yang sudah
-- memverifikasi token + role. Tidak ada policy untuk anon/authenticated.
ALTER TABLE public.tukar_jadwal_request ENABLE ROW LEVEL SECURITY;
