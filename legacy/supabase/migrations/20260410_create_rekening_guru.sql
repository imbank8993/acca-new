-- Migration: Create rekening_guru table
-- Stores up to 2 bank accounts per teacher (NIP)

CREATE TABLE IF NOT EXISTS rekening_guru (
    id SERIAL PRIMARY KEY,
    nip TEXT NOT NULL REFERENCES master_guru(nip) ON DELETE CASCADE,
    nama_bank TEXT NOT NULL,
    atas_nama TEXT NOT NULL,
    nomor_rekening TEXT NOT NULL,
    is_primary BOOLEAN DEFAULT false,
    aktif BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- One teacher can have max 2 accounts
ALTER TABLE rekening_guru ADD CONSTRAINT max_2_rekening_per_guru
    CHECK (
        (SELECT COUNT(*) FROM rekening_guru rg WHERE rg.nip = rekening_guru.nip AND rg.aktif = true) <= 2
    );

-- Unique account per teacher + bank (can't have 2 accounts in the same bank)
ALTER TABLE rekening_guru ADD CONSTRAINT unique_bank_per_guru
    UNIQUE (nip, nama_bank);

-- Auto-set first account as primary if no primary exists
CREATE OR REPLACE FUNCTION set_primary_rekening()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.is_primary = true THEN
        UPDATE rekening_guru
        SET is_primary = false
        WHERE nip = NEW.nip AND id != NEW.id;
    ELSIF NOT EXISTS (
        SELECT 1 FROM rekening_guru
        WHERE nip = NEW.nip AND is_primary = true AND id != NEW.id
    ) THEN
        NEW.is_primary = true;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_set_primary_rekening
BEFORE INSERT OR UPDATE ON rekening_guru
FOR EACH ROW EXECUTE FUNCTION set_primary_rekening();

COMMENT ON TABLE rekening_guru IS 'Data rekening bank guru untuk pembayaran honor/gaji';