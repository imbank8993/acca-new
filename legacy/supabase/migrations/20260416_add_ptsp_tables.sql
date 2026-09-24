-- Migration: Add new PTSP tables for layanan-ptsp dashboard
-- Tables: peminjaman_sarana, izin_penelitian, pengaduan

-- ── 1. ptsp_peminjaman_sarana ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "public"."ptsp_peminjaman_sarana" (
    "id"              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    "nama"            text,
    "wa"              text,
    "alamat"          text,
    "file_proposal"   text,
    "status"          text DEFAULT 'Pending',
    "updated_at"      timestamptz DEFAULT now(),
    "is_edited"       boolean DEFAULT false,
    "edit_count"      integer DEFAULT 0,
    "catatan_admin"   text,
    "tracking_token"  uuid DEFAULT gen_random_uuid(),
    "created_at"      timestamptz DEFAULT now(),
    "tanggal_mulai"   date,
    "tanggal_selesai" date
);

-- ── 2. ptsp_izin_penelitian ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "public"."ptsp_izin_penelitian" (
    "id"              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    "nama"            text,
    "wa"              text,
    "instansi_sekolah" text,
    "judul_penelitian" text,
    "tanggal_mulai"   date,
    "tanggal_selesai" date,
    "file_proposal"   text,
    "status"          text DEFAULT 'Pending',
    "updated_at"      timestamptz DEFAULT now(),
    "is_edited"       boolean DEFAULT false,
    "edit_count"      integer DEFAULT 0,
    "catatan_admin"   text,
    "tracking_token"  uuid DEFAULT gen_random_uuid(),
    "created_at"      timestamptz DEFAULT now(),
    "instansi"        text
);

-- ── 3. ptsp_pengaduan ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "public"."ptsp_pengaduan" (
    "id"              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    "nama"            text,
    "wa"              text,
    "jenis_laporan"   text,
    "isi_laporan"     text,
    "file_bukti"      text,
    "status"          text DEFAULT 'Pending',
    "updated_at"      timestamptz DEFAULT now(),
    "is_edited"       boolean DEFAULT false,
    "edit_count"      integer DEFAULT 0,
    "catatan_admin"   text,
    "tracking_token"  uuid DEFAULT gen_random_uuid(),
    "created_at"      timestamptz DEFAULT now(),
    "jenis_lainnya"   text,
    "jenis"           text
);

-- ── RLS Policies (allow service_role to read/write; public insert) ──────────
ALTER TABLE "public"."ptsp_peminjaman_sarana" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."ptsp_izin_penelitian"   ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."ptsp_pengaduan"         ENABLE ROW LEVEL SECURITY;

-- Public inserts allowed (self-service form submissions)
CREATE POLICY "ptsp_peminjaman_sarana_public_insert" ON "public"."ptsp_peminjaman_sarana" FOR INSERT WITH CHECK (true);
CREATE POLICY "ptsp_izin_penelitian_public_insert"   ON "public"."ptsp_izin_penelitian"   FOR INSERT WITH CHECK (true);
CREATE POLICY "ptsp_pengaduan_public_insert"           ON "public"."ptsp_pengaduan"           FOR INSERT WITH CHECK (true);

-- Service role full access
CREATE POLICY "ptsp_peminjaman_sarana_service_all" ON "public"."ptsp_peminjaman_sarana" FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "ptsp_izin_penelitian_service_all"   ON "public"."ptsp_izin_penelitian"   FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "ptsp_pengaduan_service_all"           ON "public"."ptsp_pengaduan"           FOR ALL USING (true) WITH CHECK (true);

-- Enable auto-updated_at trigger
CREATE OR REPLACE FUNCTION "public"."handle_updated_at"()
RETURNS TRIGGER AS $$
BEGIN
    NEW."updated_at" = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "ptsp_peminjaman_sarana_updated_at" BEFORE UPDATE ON "public"."ptsp_peminjaman_sarana"
    FOR EACH ROW EXECUTE FUNCTION "public"."handle_updated_at"();
CREATE TRIGGER "ptsp_izin_penelitian_updated_at"   BEFORE UPDATE ON "public"."ptsp_izin_penelitian"
    FOR EACH ROW EXECUTE FUNCTION "public"."handle_updated_at"();
CREATE TRIGGER "ptsp_pengaduan_updated_at"           BEFORE UPDATE ON "public"."ptsp_pengaduan"
    FOR EACH ROW EXECUTE FUNCTION "public"."handle_updated_at"();
