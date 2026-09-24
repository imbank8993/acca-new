-- Formulir kini punya opsi "boleh diisi berkali-kali" (schema.allow_multiple_responses)
-- yang diatur per form via Pengaturan Formulir. Index unik lama mengunci SEMUA form privat
-- ke satu tanggapan per akun tanpa pengecualian, jadi tidak bisa hidup berdampingan dengan
-- opsi tersebut (partial index tidak bisa merujuk kolom di tabel custom_forms).
-- Pembatasan sekali-isi sekarang murni ditegakkan di app/api/forms/submit/route.ts.
DROP INDEX IF EXISTS uq_cfr_form_user;

CREATE INDEX IF NOT EXISTS idx_cfr_form_user
    ON custom_form_responses (form_id, user_id)
    WHERE user_id IS NOT NULL;
