-- Migration: Kapabilitas (izin per-FUNGSI, bukan per-role)
--
-- Sebelum ini, izin sebuah tombol ditentukan lewat cek role hardcoded di kode
-- (mis. `roles.includes('OP_KLINIK')`). Konsekuensinya, tiap pengecualian
-- melahirkan role baru dan tiap perubahan izin butuh deploy.
--
-- Dua tabel di bawah memindahkan keputusan itu ke data:
--   user_capabilities — siapa (per orang) yang boleh menjalankan sebuah fungsi.
--                       Diisi admin dari tab Pengaturan di halaman terkait,
--                       mis. Klinik -> Pengaturan.
--   role_capabilities — paket per role, untuk fungsi yang memang milik SEMUA
--                       pemegang sebuah role. Belum ada halaman yang memakainya
--                       dan belum ada UI-nya; resolvernya sudah siap supaya
--                       halaman berikutnya tidak perlu migrasi lagi.
--
-- Daftar kunci kapabilitas yang sah TETAP di kode (lib/capabilities.ts) — itu
-- kontrak antara UI dan gerbang server, jadi tidak boleh bisa diketik bebas.
-- Kunci yang tidak dikenal akan diabaikan saat resolusi.
--
-- Halaman apa yang tampil tetap di role_pages; batas data (kelas/mapel milik
-- siapa) tetap dicek terpisah di server. Tabel ini hanya soal "tombol apa".

CREATE TABLE IF NOT EXISTS role_capabilities (
    role TEXT NOT NULL,             -- UPPERCASE, mis. 'WALI_KELAS'
    capability_key TEXT NOT NULL,   -- kunci dari lib/capabilities.ts, mis. 'klinik.approve_slot'
    created_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (role, capability_key)
);
CREATE INDEX IF NOT EXISTS idx_role_capabilities_role ON role_capabilities(role);

COMMENT ON TABLE role_capabilities IS
  'Paket kapabilitas per role. Baris (role, capability_key) = role itu boleh menjalankan fungsi tersebut. Kunci yang sah didefinisikan di lib/capabilities.ts.';

CREATE TABLE IF NOT EXISTS user_capabilities (
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    capability_key TEXT NOT NULL,
    -- 'grant'  = beri walau role-nya tidak punya
    -- 'revoke' = cabut walau role-nya punya (revoke MENANG atas grant)
    mode TEXT NOT NULL DEFAULT 'grant' CHECK (mode IN ('grant', 'revoke')),
    catatan TEXT,                   -- alasan, supaya pengecualian tidak jadi misteri
    created_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (user_id, capability_key)
);
CREATE INDEX IF NOT EXISTS idx_user_capabilities_user ON user_capabilities(user_id);

COMMENT ON TABLE user_capabilities IS
  'Pengecualian kapabilitas per orang. mode=grant menambah, mode=revoke mencabut; revoke menang atas paket role. Dipakai agar kebutuhan "si A boleh fungsi X" tidak melahirkan role baru.';

-- Kedua tabel hanya dibaca dari server (service role, lihat lib/capabilities-server.ts).
-- RLS dinyalakan tanpa policy apa pun: klien anon/authenticated tidak boleh
-- membaca apalagi menulis peta izin.
ALTER TABLE role_capabilities ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_capabilities ENABLE ROW LEVEL SECURITY;
