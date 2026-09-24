-- Migration: Klinik Pembelajaran Module Initialization
-- Date: 2026-04-17

-- 1. Tabel Slot Klinik (Ketersediaan Guru)
CREATE TABLE IF NOT EXISTS klinik_slots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    guru_id BIGINT REFERENCES users(id) ON DELETE CASCADE,
    nama_guru VARCHAR(255),
    mapel VARCHAR(100),
    topik TEXT,
    tanggal DATE NOT NULL,
    jam_mulai TIME NOT NULL,
    jam_selesai TIME NOT NULL,
    max_siswa INTEGER DEFAULT 5,
    status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'open', 'full', 'finished', 'cancelled'
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Tabel Peserta Klinik (Pendaftaran Siswa)
CREATE TABLE IF NOT EXISTS klinik_peserta (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slot_id UUID REFERENCES klinik_slots(id) ON DELETE CASCADE,
    siswa_id BIGINT REFERENCES users(id) ON DELETE CASCADE,
    nama_siswa VARCHAR(255),
    kelas VARCHAR(50),
    status VARCHAR(20) DEFAULT 'registered', -- 'registered', 'attended', 'cancelled'
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(slot_id, siswa_id) -- Mencegah pendaftaran ganda pada slot yang sama
);

-- 3. Tabel Laporan Klinik (Dokumentasi & Bukti)
CREATE TABLE IF NOT EXISTS klinik_laporan (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slot_id UUID REFERENCES klinik_slots(id) ON DELETE CASCADE,
    guru_id BIGINT REFERENCES users(id) ON DELETE CASCADE,
    materi_disampaikan TEXT,
    foto_bukti TEXT[], -- Array URL foto dokumentasi
    catatan_guru TEXT,
    is_finalized BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Indeks untuk Performa
CREATE INDEX IF NOT EXISTS idx_klinik_slots_tanggal ON klinik_slots(tanggal);
CREATE INDEX IF NOT EXISTS idx_klinik_slots_guru ON klinik_slots(guru_id);
CREATE INDEX IF NOT EXISTS idx_klinik_peserta_slot ON klinik_peserta(slot_id);

-- 5. Trigger untuk Update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_klinik_slots_updated_at BEFORE UPDATE ON klinik_slots FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_klinik_laporan_updated_at BEFORE UPDATE ON klinik_laporan FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 6. Trigger Notifikasi Otomatis (Menggunakan Sistem Notifikasi yang Sudah Ada)

-- A. Notifikasi ke Admin saat Guru buat Slot baru
CREATE OR REPLACE FUNCTION notify_klinik_slot_request()
RETURNS TRIGGER AS $$
BEGIN
    PERFORM send_notification(
        'klinik_request',
        'Permintaan Klinik Baru',
        'Guru ' || NEW.nama_guru || ' mengajukan jadwal klinik: ' || NEW.mapel || ' pada ' || NEW.tanggal::TEXT,
        '/dashboard?page=Klinik',
        'ADMIN',
        NULL,
        'klinik_slots',
        NEW.id
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_notify_klinik_request AFTER INSERT ON klinik_slots FOR EACH ROW EXECUTE FUNCTION notify_klinik_slot_request();

-- B. Notifikasi ke Guru saat Slot disetujui (Status berubah jadi OPEN)
CREATE OR REPLACE FUNCTION notify_klinik_slot_approved()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.status = 'pending' AND NEW.status = 'open' THEN
        PERFORM send_notification(
            'klinik_approved',
            'Jadwal Klinik Disetujui',
            'Jadwal Anda untuk ' || NEW.mapel || ' pada ' || NEW.tanggal::TEXT || ' telah disetujui.',
            '/dashboard?page=Klinik',
            NULL,
            (SELECT auth_id FROM users WHERE id = NEW.guru_id LIMIT 1),
            'klinik_slots',
            NEW.id
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_notify_klinik_approved AFTER UPDATE ON klinik_slots FOR EACH ROW EXECUTE FUNCTION notify_klinik_slot_approved();
