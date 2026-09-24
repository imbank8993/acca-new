-- Buat Enum Types jika belum ada
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'budget_category') THEN
        CREATE TYPE budget_category AS ENUM ('Transport', 'Honor', 'Bahan');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'budget_request_status') THEN
        CREATE TYPE budget_request_status AS ENUM ('Draft', 'Menunggu Divisi', 'Menunggu KTU', 'Menunggu PPK', 'Antrean Pencairan', 'Dicairkan Sebagian', 'Lunas/Selesai', 'Ditolak');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'disbursement_status') THEN
        CREATE TYPE disbursement_status AS ENUM ('Menunggu Konfirmasi', 'Telah Diterima');
    END IF;
END$$;

-- Tabel: divisions (Divisi)
CREATE TABLE IF NOT EXISTS divisions (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert default divisi jika kosong
INSERT INTO divisions (name) VALUES 
('Akademik'), ('Kesiswaan'), ('Keasramaan'), ('Humas'), ('Sarpras'), ('TU')
ON CONFLICT (name) DO NOTHING;

-- Tabel: financial_officers (Pengaturan Admin untuk Role)
CREATE TABLE IF NOT EXISTS financial_officers (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    role_type VARCHAR(50) NOT NULL, -- 'Kepala Divisi', 'KTU', 'PPK', 'Bendahara'
    division_id UUID REFERENCES divisions(id) ON DELETE CASCADE, -- Hanya jika role_type = 'Kepala Divisi'
    user_id BIGINT REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(role_type, division_id, user_id)
);

-- Tabel: division_budgets (Pagu Anggaran)
CREATE TABLE IF NOT EXISTS division_budgets (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    division_id UUID REFERENCES divisions(id) ON DELETE CASCADE NOT NULL,
    category budget_category NOT NULL,
    total_budget NUMERIC(15, 2) DEFAULT 0,
    used_budget NUMERIC(15, 2) DEFAULT 0,
    period VARCHAR(10) NOT NULL, -- e.g., '2026'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(division_id, category, period)
);

-- Tabel: budget_requests (Header Pengajuan)
CREATE TABLE IF NOT EXISTS budget_requests (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    pj_user_id BIGINT REFERENCES users(id) ON DELETE CASCADE NOT NULL,
    division_id UUID REFERENCES divisions(id) ON DELETE SET NULL,
    activity_name VARCHAR(255) NOT NULL,
    description TEXT,
    total_amount NUMERIC(15, 2) DEFAULT 0,
    total_approved NUMERIC(15, 2) DEFAULT 0,
    total_disbursed NUMERIC(15, 2) DEFAULT 0,
    status budget_request_status DEFAULT 'Draft',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabel: budget_request_items (Rincian Item)
CREATE TABLE IF NOT EXISTS budget_request_items (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    budget_request_id UUID REFERENCES budget_requests(id) ON DELETE CASCADE NOT NULL,
    item_name VARCHAR(255) NOT NULL,
    category budget_category NOT NULL,
    quantity INTEGER DEFAULT 1,
    unit_price NUMERIC(15, 2) DEFAULT 0,
    total_price NUMERIC(15, 2) GENERATED ALWAYS AS (quantity * unit_price) STORED,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabel: approval_logs (Riwayat Persetujuan)
CREATE TABLE IF NOT EXISTS approval_logs (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    budget_request_id UUID REFERENCES budget_requests(id) ON DELETE CASCADE NOT NULL,
    user_id BIGINT REFERENCES users(id) ON DELETE CASCADE NOT NULL,
    role VARCHAR(50) NOT NULL,
    action VARCHAR(50) NOT NULL, -- 'Approved', 'Rejected', 'Revised'
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabel: disbursements (Riwayat Pencairan Bertahap)
CREATE TABLE IF NOT EXISTS disbursements (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    budget_request_id UUID REFERENCES budget_requests(id) ON DELETE CASCADE NOT NULL,
    amount NUMERIC(15, 2) NOT NULL,
    transfer_proof_url TEXT,
    disbursed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    status disbursement_status DEFAULT 'Menunggu Konfirmasi',
    confirmed_by_pj_at TIMESTAMP WITH TIME ZONE,
    notes TEXT
);

-- RLS Policies (Enable and allow all authenticated for internal app)
ALTER TABLE divisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE financial_officers ENABLE ROW LEVEL SECURITY;
ALTER TABLE division_budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE budget_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE budget_request_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE approval_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE disbursements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated full access to divisions" ON divisions FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Allow authenticated full access to financial_officers" ON financial_officers FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Allow authenticated full access to division_budgets" ON division_budgets FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Allow authenticated full access to budget_requests" ON budget_requests FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Allow authenticated full access to budget_request_items" ON budget_request_items FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Allow authenticated full access to approval_logs" ON approval_logs FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Allow authenticated full access to disbursements" ON disbursements FOR ALL USING (auth.role() = 'authenticated');
