-- Create site_settings if not exists
CREATE TABLE IF NOT EXISTS public.site_settings (
    key VARCHAR(255) PRIMARY KEY,
    value TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert empty sanggar_config if not exists
INSERT INTO public.site_settings (key, value)
VALUES ('sanggar_config', '[]')
ON CONFLICT (key) DO NOTHING;

-- Create registrasi_sanggar if not exists
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS public.registrasi_sanggar (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nama VARCHAR(255),
    nip VARCHAR(255),
    asal_sekolah VARCHAR(255),
    alamat TEXT,
    nomor_wa VARCHAR(50),
    email VARCHAR(255),
    pilihan_sanggar VARCHAR(255),
    kelas_pelatihan VARCHAR(255),
    sumber_aplikasi VARCHAR(50),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
