-- ============================================================================
-- BANK DATA — pengaturan dataset yang boleh diekspor + jejak ekspor
--
-- Katalog dataset (tabel sumber, kolom yang ADA, filter yang didukung)
-- dideklarasikan di KODE: lib/bank-data/datasets.ts. Tabel di bawah ini hanya
-- menyimpan KEPUTUSAN ADMIN atas katalog itu — dataset mana yang dinyalakan dan
-- kolom mana yang boleh ikut. Nama tabel/kolom tidak pernah datang dari input
-- admin maupun dari body request: seluruh route klinik/bank-data memakai
-- service role (menembus RLS), jadi nama tabel yang bisa diketik bebas sama
-- artinya dengan membuka seluruh database.
--
-- Jalankan MANUAL lewat Supabase Dashboard → SQL Editor (RPC exec_sql tidak
-- tersedia di project ini).
-- ============================================================================

-- ── Pengaturan per dataset ──────────────────────────────────────────────────
create table if not exists bank_data_dataset_config (
    dataset_id      text primary key,
    -- Default mati: dataset baru yang ikut rilis kode tidak boleh langsung
    -- bisa diekspor sebelum admin melihat dan menyalakannya.
    aktif           boolean not null default false,
    -- Daftar putih kolom (key sesuai katalog kode). Kosong = tidak ada kolom
    -- yang boleh keluar; server tetap meng-intersect dengan katalog.
    kolom_diizinkan jsonb   not null default '[]'::jsonb,
    -- Batas baris per ekspor. NULL = pakai batas keras dataset di kode.
    batas_baris     integer,
    catatan         text,
    updated_by      bigint references users(id) on delete set null,
    updated_at      timestamptz not null default now()
);

-- ── Penunjukan per orang per dataset ────────────────────────────────────────
-- Kapabilitas `bank_data.export` menjawab "boleh mengekspor?"; tabel ini
-- menjawab "dataset yang mana?". Dipisah supaya seseorang bisa diberi data
-- siswa tanpa sekalian data kepegawaian.
create table if not exists bank_data_akses (
    dataset_id  text   not null,
    user_id     bigint not null references users(id) on delete cascade,
    created_at  timestamptz not null default now(),
    primary key (dataset_id, user_id)
);

create index if not exists idx_bank_data_akses_user on bank_data_akses(user_id);

-- ── Jejak ekspor ────────────────────────────────────────────────────────────
-- Halaman ini adalah pintu keluar data pribadi siswa & pegawai. Tanpa jejak,
-- tidak ada cara menjawab "data ini keluar lewat siapa".
create table if not exists bank_data_log (
    id            bigserial primary key,
    user_id       bigint references users(id) on delete set null,
    nama_user     text,
    dataset_id    text not null,
    filter        jsonb,
    kolom         jsonb,
    jumlah_baris  integer,
    ip            text,
    created_at    timestamptz not null default now()
);

create index if not exists idx_bank_data_log_created on bank_data_log(created_at desc);
create index if not exists idx_bank_data_log_user    on bank_data_log(user_id);

-- ── RLS: dikunci total ──────────────────────────────────────────────────────
-- Tidak ada satu pun policy. Ketiga tabel hanya boleh disentuh service role
-- lewat /api/bank-data/*, yang sudah memasang gerbang kapabilitasnya sendiri.
alter table bank_data_dataset_config enable row level security;
alter table bank_data_akses          enable row level security;
alter table bank_data_log            enable row level security;
