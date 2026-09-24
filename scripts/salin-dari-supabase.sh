#!/usr/bin/env bash
#
# Salin data Supabase -> VPS Postgres.
#
# Kenapa skrip ini ada: menyalin baris beserta `id` eksplisit TIDAK ikut
# memajukan sequence. Sequence tertinggal di angka lama, lalu INSERT pertama dari
# aplikasi mengambil id yang sudah terpakai dan gagal "duplicate key" — tanpa
# pesan apa pun yang menyebut sequence. Yang terlihat pengguna hanya "gagal
# menyimpan", dan hanya pada tabel yang kebetulan tertinggal.
#
# `pg_dump --data-only` menyertakan `setval` untuk setiap sequence sebagai bagian
# dari data, jadi memakai pg_dump membuat masalah itu tidak pernah muncul.
#
# Struktur tabel TIDAK ikut disalin: VPS sudah memuat struktur Supabase lengkap
# (skema auth & public, kebijakan RLS, trigger). Yang diganti hanya isinya.
#
# Pakai:
#   SUPABASE_URL='postgresql://...:5432/postgres' ./scripts/salin-dari-supabase.sh
#
# Target dibaca dari DATABASE_URL (env, atau apps/api/.env).

set -euo pipefail

AKAR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BERKAS_DUMP="${AKAR}/acca-data.sql"

merah()  { printf '\033[31m%s\033[0m\n' "$*"; }
hijau()  { printf '\033[32m%s\033[0m\n' "$*"; }
kuning() { printf '\033[33m%s\033[0m\n' "$*"; }
judul()  { printf '\n\033[1m== %s ==\033[0m\n' "$*"; }

gagal() { merah "GAGAL: $*"; exit 1; }

# URL tanpa kredensial, aman untuk ditampilkan.
samarkan() { printf '%s' "$1" | sed -E 's#://[^@]*@#://***@#'; }

# ── 1. Prasyarat ────────────────────────────────────────────────────────────
judul "Memeriksa prasyarat"

command -v pg_dump >/dev/null 2>&1 || gagal "pg_dump tidak ditemukan di PATH."
command -v psql    >/dev/null 2>&1 || gagal "psql tidak ditemukan di PATH."

if [ -z "${SUPABASE_URL:-}" ]; then
  gagal "SUPABASE_URL belum diisi. Pakai connection string LANGSUNG (port 5432), bukan pooler (6543) — pooler tidak mendukung pg_dump."
fi

# Target: env lebih dulu, lalu apps/api/.env
if [ -z "${DATABASE_URL:-}" ] && [ -f "${AKAR}/apps/api/.env" ]; then
  DATABASE_URL="$(grep -E '^DATABASE_URL=' "${AKAR}/apps/api/.env" | head -1 | cut -d= -f2- | tr -d '"'"'"'')"
fi
[ -n "${DATABASE_URL:-}" ] || gagal "DATABASE_URL tidak ditemukan (env maupun apps/api/.env)."

echo "  sumber : $(samarkan "$SUPABASE_URL")"
echo "  tujuan : $(samarkan "$DATABASE_URL")"

# Penjagaan: jangan sampai sumber dan tujuan tertukar.
case "$DATABASE_URL" in
  *supabase.co*|*supabase.com*|*pooler.supabase*)
    gagal "DATABASE_URL menunjuk ke Supabase. Skrip ini MENGHAPUS isi tujuan — tujuan harus VPS, bukan Supabase." ;;
esac
[ "$SUPABASE_URL" != "$DATABASE_URL" ] || gagal "Sumber dan tujuan sama."

# ── 2. Versi pg_dump harus >= versi server sumber ───────────────────────────
judul "Memeriksa versi"

versi_mayor() { printf '%s' "$1" | grep -oE '[0-9]+' | head -1; }

VERSI_DUMP="$(pg_dump --version | grep -oE '[0-9]+\.[0-9]+|[0-9]+' | head -1)"
VERSI_SUMBER="$(psql "$SUPABASE_URL" -tAc 'SHOW server_version' 2>/dev/null || true)"
[ -n "$VERSI_SUMBER" ] || gagal "Tidak dapat terhubung ke Supabase. Pastikan memakai host langsung (port 5432) dan IP Anda diizinkan."

MD="$(versi_mayor "$VERSI_DUMP")"
MS="$(versi_mayor "$VERSI_SUMBER")"
echo "  pg_dump        : $VERSI_DUMP"
echo "  server Supabase: $VERSI_SUMBER"

if [ "$MD" -lt "$MS" ]; then
  gagal "pg_dump ($MD) lebih tua dari server Supabase ($MS). pg_dump menolak membaca server yang lebih baru — pasang klien Postgres $MS atau lebih baru."
fi
hijau "  versi cocok"

# ── 3. Hitungan sebelum, untuk dibandingkan nanti ───────────────────────────
judul "Menghitung baris di sumber"

TABEL_PERIKSA="public.users auth.users public.master_siswa public.master_guru public.jurnal_guru public.absensi_sesi public.absensi_detail public.izin_guru"

hitung() { # $1=url $2=tabel  -> angka, atau "-" bila tabel tidak ada
  psql "$1" -tAc "SELECT COUNT(*) FROM $2" 2>/dev/null || printf '%s' '-'
}

SEBELUM=""
for t in $TABEL_PERIKSA; do
  n="$(hitung "$SUPABASE_URL" "$t")"
  SEBELUM="${SEBELUM}${t}=${n} "
  printf '  %-26s %s\n' "$t" "$n"
done

# ── 4. Konfirmasi (merusak) ─────────────────────────────────────────────────
judul "Konfirmasi"
kuning "  Seluruh isi skema 'public' dan 'auth' di VPS akan DIHAPUS, lalu diganti"
kuning "  data dari Supabase. Struktur tabel tidak disentuh."
printf '  Ketik HAPUS-DAN-GANTI untuk lanjut: '
read -r JAWAB
[ "$JAWAB" = "HAPUS-DAN-GANTI" ] || { echo "Dibatalkan."; exit 1; }

# ── 5. Dump ─────────────────────────────────────────────────────────────────
judul "Mengambil data dari Supabase"
# --data-only      : struktur tidak ikut; sequence TETAP ikut sebagai setval
# --disable-triggers: mematikan trigger saat memuat, supaya urutan foreign key
#                     tidak membuat restore gagal di tengah (butuh superuser)
# --no-owner/privileges: peran Supabase (anon, service_role, dst) tidak ada di VPS
pg_dump "$SUPABASE_URL" \
  --data-only \
  --schema=public \
  --schema=auth \
  --no-owner \
  --no-privileges \
  --disable-triggers \
  -f "$BERKAS_DUMP"

UKURAN="$(du -h "$BERKAS_DUMP" | cut -f1)"
JML_SETVAL="$(grep -c 'setval' "$BERKAS_DUMP" || true)"
echo "  berkas : $BERKAS_DUMP ($UKURAN)"
echo "  setval : $JML_SETVAL pernyataan"
[ "$JML_SETVAL" -gt 0 ] || kuning "  PERINGATAN: tidak ada setval di dump — sequence mungkin perlu diselaraskan manual."

# ── 6. Kosongkan tujuan ─────────────────────────────────────────────────────
judul "Mengosongkan VPS"
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -tAc \
  "SELECT 'TRUNCATE TABLE ' || string_agg(format('%I.%I', schemaname, tablename), ', ') || ' RESTART IDENTITY CASCADE;'
   FROM pg_tables WHERE schemaname IN ('public','auth')" \
  | psql "$DATABASE_URL" -v ON_ERROR_STOP=1 >/dev/null
hijau "  kosong"

# ── 7. Muat ─────────────────────────────────────────────────────────────────
judul "Memuat ke VPS"
# --single-transaction: kalau gagal di tengah, tidak ada data separuh yang tertinggal
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 --single-transaction -f "$BERKAS_DUMP" >/dev/null
hijau "  selesai"

# ── 8. Verifikasi hitungan ──────────────────────────────────────────────────
judul "Memverifikasi hitungan baris"
COCOK=1
for t in $TABEL_PERIKSA; do
  asal="$(printf '%s' "$SEBELUM" | tr ' ' '\n' | grep "^${t}=" | cut -d= -f2)"
  kini="$(hitung "$DATABASE_URL" "$t")"
  if [ "$asal" = "$kini" ]; then
    printf '  %-26s %-8s ✓\n' "$t" "$kini"
  else
    printf '  %-26s %-8s ✗ (sumber: %s)\n' "$t" "$kini" "$asal"
    COCOK=0
  fi
done

# ── 9. Verifikasi sequence ──────────────────────────────────────────────────
judul "Memverifikasi sequence"
# Nama kolom id berbeda-beda per tabel, jadi perbandingannya dirakit dulu sebagai
# SQL (teknik yang sama dengan TRUNCATE di atas), baru dijalankan.
SQL_BANDING="$(psql "$DATABASE_URL" -tAc "
  SELECT string_agg(
    format('SELECT %L AS tabel, (SELECT last_value FROM %I.%I) AS seq, (SELECT COALESCE(MAX(%I),0) FROM %I.%I) AS maks',
           t.relname, ns.nspname, s.relname, a.attname, nt.nspname, t.relname),
    ' UNION ALL ')
  FROM pg_class s
  JOIN pg_namespace ns ON ns.oid = s.relnamespace
  JOIN pg_depend d ON d.objid=s.oid AND d.classid='pg_class'::regclass AND d.refclassid='pg_class'::regclass
  JOIN pg_class t ON t.oid=d.refobjid
  JOIN pg_namespace nt ON nt.oid = t.relnamespace
  JOIN pg_attribute a ON a.attrelid=t.oid AND a.attnum=d.refobjsubid
  WHERE s.relkind='S' AND nt.nspname IN ('public','auth')")"

TERTINGGAL="$(psql "$DATABASE_URL" -tAc \
  "SELECT COALESCE(string_agg(tabel || ' (-' || (maks - seq) || ')', ', '), '')
   FROM ($SQL_BANDING) q WHERE maks > seq")"

if [ -z "$TERTINGGAL" ]; then
  hijau "  semua sequence selaras ($JML_SETVAL setval termuat dari dump)"
else
  merah "  sequence masih tertinggal: $TERTINGGAL"
  merah "  Insert dari aplikasi akan gagal 'duplicate key' pada tabel itu."
  kuning "  Selaraskan dengan:"
  kuning "    psql \"\$DATABASE_URL\" -tAc \"SELECT 'SELECT setval(' || quote_literal(quote_ident(s.relname)) || ', COALESCE((SELECT MAX(' || quote_ident(a.attname) || ') FROM ' || quote_ident(t.relname) || '), 1), true);' FROM pg_class s JOIN pg_depend d ON d.objid=s.oid AND d.classid='pg_class'::regclass AND d.refclassid='pg_class'::regclass JOIN pg_class t ON t.oid=d.refobjid JOIN pg_attribute a ON a.attrelid=t.oid AND a.attnum=d.refobjsubid WHERE s.relkind='S' AND t.relnamespace='public'::regnamespace\" | psql \"\$DATABASE_URL\""
fi

# ── 10. Bersih-bersih ───────────────────────────────────────────────────────
judul "Selesai"
if [ "$COCOK" -eq 1 ]; then
  hijau "  Semua hitungan cocok."
else
  merah "  Ada hitungan yang tidak cocok — periksa sebelum memakai aplikasi."
fi
echo "  Berkas dump dibiarkan di: $BERKAS_DUMP"
kuning "  Berkas itu memuat SELURUH data madrasah termasuk hash kata sandi."
kuning "  Hapus setelah selesai:  rm '$BERKAS_DUMP'"
