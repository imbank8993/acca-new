-- Full LCKH Schema Setup (Corrected)
-- Run this in Supabase SQL Editor

-- 1. Enums
DO $$ BEGIN
    CREATE TYPE lckh_status AS ENUM ('Draft', 'Submitted', 'Approved_Waka', 'Approved_Kamad', 'Revisi', 'Rejected');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 2. Periods Table
CREATE TABLE IF NOT EXISTS public.lckh_periods (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    periode_kode VARCHAR(20) UNIQUE NOT NULL, 
    periode_nama VARCHAR(50) NOT NULL,
    tgl_awal DATE NOT NULL,
    tgl_akhir DATE NOT NULL,
    tgl_mulai_pengajuan DATE, 
    tgl_akhir_pengajuan DATE, 
    status_periode VARCHAR(20) DEFAULT 'OPEN' CHECK (status_periode IN ('OPEN', 'CLOSED', 'ARCHIVED')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Module Config Table
CREATE TABLE IF NOT EXISTS public.lckh_modules (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    module_code VARCHAR(50) UNIQUE NOT NULL,
    module_name VARCHAR(100) NOT NULL,
    enabled BOOLEAN DEFAULT TRUE,
    default_include BOOLEAN DEFAULT TRUE,
    module_type VARCHAR(50) DEFAULT 'Laporan',
    urut_tampil INTEGER DEFAULT 0,
    keterangan TEXT,
    requires_data BOOLEAN DEFAULT FALSE,
    data_source VARCHAR(100), 
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Submissions Table (Re-defined to match Google App Script structure)
-- Dropping to ensure clean structure if partial table exists (WARNING: DELETES DATA)
DROP TABLE IF EXISTS public.lckh_submissions CASCADE;

CREATE TABLE public.lckh_submissions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    lckh_code VARCHAR(100), -- Readable ID e.g. LCKH-2026-01-XX
    
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    nama_guru_snap VARCHAR(255),
    nip VARCHAR(50),
    
    -- Period Reference
    periode_kode VARCHAR(20) REFERENCES public.lckh_periods(periode_kode),
    
    -- Legacy Fields (keeping for compatibility)
    bulan INTEGER, 
    tahun INTEGER, 
    
    -- Snapshot Data (Frozen Stats)
    snap_total_hari_masuk INTEGER DEFAULT 0,
    snap_total_jam_mengajar NUMERIC DEFAULT 0,
    snap_rekap_kehadiran JSONB, 
    snap_ringkasan_umum JSONB, 
    
    -- Flags
    snap_ada_jurnal BOOLEAN DEFAULT FALSE,
    snap_ada_absensi BOOLEAN DEFAULT FALSE,
    snap_ada_nilai BOOLEAN DEFAULT FALSE,
    snap_ada_tugas BOOLEAN DEFAULT FALSE,
    
    -- Attachments (Big JSONs)
    lampiran_jurnal JSONB, 
    lampiran_absensi JSONB, 
    lampiran_nilai JSONB,
    lampiran_tugas JSONB,
    
    -- Status & Workflow
    status VARCHAR(50) DEFAULT 'Draft', 
    approval_code VARCHAR(50),
    approved_by_waka VARCHAR(100),
    approved_by_kamad VARCHAR(100),
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    submitted_at TIMESTAMPTZ,
    full_approved_at TIMESTAMPTZ,
    last_update_at TIMESTAMPTZ DEFAULT NOW(),
    
    catatan_guru TEXT,
    catatan_reviewer TEXT
);

-- 5. Approvals Log
CREATE TABLE IF NOT EXISTS public.lckh_approvals (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    lckh_submission_id UUID REFERENCES public.lckh_submissions(id) ON DELETE CASCADE,
    level VARCHAR(20) NOT NULL, -- WAKA, KAMAD
    status_approval VARCHAR(20) NOT NULL,
    approver_id VARCHAR(100),
    approver_name VARCHAR(255),
    approved_at TIMESTAMPTZ,
    catatan TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS & Policies (Simplified for setup)
ALTER TABLE public.lckh_periods ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Read Periods" ON public.lckh_periods;
CREATE POLICY "Read Periods" ON public.lckh_periods FOR SELECT USING (true);

ALTER TABLE public.lckh_submissions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Read Own or Admin" ON public.lckh_submissions;
CREATE POLICY "Read Own or Admin" ON public.lckh_submissions FOR SELECT USING (
    auth.uid() = user_id OR 
    EXISTS (SELECT 1 FROM public.users WHERE auth_id = auth.uid() AND (role ILIKE '%ADMIN%' OR role ILIKE '%WAKA%' OR role ILIKE '%KAMAD%'))
);

DROP POLICY IF EXISTS "Insert Own" ON public.lckh_submissions;
CREATE POLICY "Insert Own" ON public.lckh_submissions FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Update Own or Admin" ON public.lckh_submissions;
CREATE POLICY "Update Own or Admin" ON public.lckh_submissions FOR UPDATE USING (
    auth.uid() = user_id OR 
    EXISTS (SELECT 1 FROM public.users WHERE auth_id = auth.uid() AND (role ILIKE '%ADMIN%' OR role ILIKE '%WAKA%' OR role ILIKE '%KAMAD%'))
);

-- Seed Data
INSERT INTO public.lckh_periods (periode_kode, periode_nama, tgl_awal, tgl_akhir, tgl_mulai_pengajuan, tgl_akhir_pengajuan)
VALUES 
('2026-01', 'Januari 2026', '2026-01-01', '2026-01-31', '2026-01-20', '2026-02-05'),
('2026-02', 'Februari 2026', '2026-02-01', '2026-02-28', '2026-02-20', '2026-03-05')
ON CONFLICT (periode_kode) DO NOTHING;

INSERT INTO public.lckh_modules (module_code, module_name, urut_tampil, data_source) 
VALUES 
('JURNAL', 'Jurnal Mengajar', 1, 'JURNAL GURU'),
('ABSENSI', 'Absensi Siswa', 2, 'ABSENSI_SESI'),
('NILAI', 'Daftar Nilai', 3, 'NILAI'),
('TUGAS_TAMBAHAN', 'Tugas Tambahan', 4, 'TUGAS_TAMBAHAN')
ON CONFLICT (module_code) DO NOTHING;
