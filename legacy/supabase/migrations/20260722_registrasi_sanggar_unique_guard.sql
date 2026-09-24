-- =============================================================
-- Cegah pendaftaran ganda pada registrasi_sanggar (level DB).
-- JALANKAN MANUAL di Supabase Dashboard > SQL Editor.
--
-- PENTING: hapus dulu data ganda yang terlanjur tersimpan lewat
-- tab "Data Pendaftar" (filter Nama Ganda), kalau tidak CREATE
-- INDEX akan gagal karena data existing melanggar constraint.
--
-- Cek sisa duplikat sebelum menjalankan index:
--   select lower(regexp_replace(trim(nama), '\s+', ' ', 'g')) as nama_norm, count(*)
--   from registrasi_sanggar
--   group by 1 having count(*) > 1;
-- =============================================================

-- 1 NIP hanya boleh punya 1 pendaftaran.
-- NIP dinormalisasi digit-saja: isian seperti '-' atau kosong dikecualikan
-- sehingga pendaftar tanpa NIP tidak saling bertabrakan.
create unique index if not exists uq_registrasi_sanggar_nip
  on registrasi_sanggar ((regexp_replace(coalesce(nip, ''), '\D', '', 'g')))
  where regexp_replace(coalesce(nip, ''), '\D', '', 'g') <> '';

-- 1 nomor WA hanya 1 pendaftaran.
-- Nomor dinormalisasi: non-digit dibuang, prefix 62 disamakan dengan 0
-- (0812... == +62 812...). Nilai placeholder seperti 'belum diatur'
-- ternormalisasi menjadi kosong sehingga dikecualikan.
create unique index if not exists uq_registrasi_sanggar_wa
  on registrasi_sanggar ((regexp_replace(regexp_replace(coalesce(nomor_wa, ''), '\D', '', 'g'), '^62', '0')))
  where regexp_replace(coalesce(nomor_wa, ''), '\D', '', 'g') <> '';

-- Nama + asal sekolah sama dianggap orang yang sama
-- (nama dinormalisasi: huruf kecil, spasi ganda dirapikan)
create unique index if not exists uq_registrasi_sanggar_nama_sekolah
  on registrasi_sanggar (
    (lower(regexp_replace(trim(nama), '\s+', ' ', 'g'))),
    (lower(trim(asal_sekolah)))
  );
