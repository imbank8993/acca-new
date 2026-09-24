# Supabase Setup untuk Absensi Module

## Langkah-langkah Setup Database

### 1. Buka Supabase Dashboard
- Login ke [Supabase Dashboard](https://app.supabase.com)
- Pilih project Anda (yang URL-nya ada di `.env.local`)

### 2. Jalankan Migration SQL

#### a. Buka SQL Editor
- Di sidebar kiri, klik **SQL Editor**
- Klik **New Query**

#### b. Jalankan Migration Utama
1. Copy seluruh isi file `001_create_absensi_tables.sql`
2. Paste ke SQL Editor
3. Klik **Run** atau tekan `Ctrl+Enter`
4. Pastikan muncul pesan sukses "Success. No rows returned"

#### c. Import Sample Data (Opsional)
1. Copy seluruh isi file `002_sample_jadwal_data.sql`
2. Paste ke SQL Editor baru
3. Klik **Run**
4. Anda akan melihat data jadwal Imran untuk mata pelajaran Matematika

### 3. Verifikasi Tabel Sudah Dibuat

Jalankan query berikut untuk verifikasi:

```sql
-- Check tables exist
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('jadwal_guru', 'absensi_sesi', 'absensi_detail');

-- Check jadwal_guru structure
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'jadwal_guru'
ORDER BY ordinal_position;

-- Count records if sample data was imported
SELECT COUNT(*) FROM jadwal_guru;
```

### 4. Struktur Tabel yang Dibuat

#### `jadwal_guru` - Jadwal Mengajar Guru
| Kolom | Tipe | Keterangan |
|-------|------|------------|
| id | bigserial | Primary key |
| guru_id | text | ID Guru (contoh: G-IC-001) |
| nama_guru | text | Nama lengkap guru |
| hari | text | Hari (Senin-Sabtu) |
| jam_ke | integer | Jam ke (1-10) |
| kelas | text | Kelas (contoh: XI C) |
| mata_pelajaran | text | Nama mata pelajaran |
| tahun_ajaran | text | Tahun ajaran (2024/2025) |
| semester | integer | Semester (1 atau 2) |
| aktif | boolean | Status aktif |

#### `absensi_sesi` - Sesi Pertemuan/Mengajar
| Kolom | Tipe | Keterangan |
|-------|------|------------|
| id | bigserial | Primary key |
| jadwal_id | bigint | Foreign key ke jadwal_guru |
| guru_id | text | ID Guru |
| kelas | text | Kelas |
| mata_pelajaran | text | Mata pelajaran |
| tanggal | date | Tanggal pertemuan |
| hari | text | Hari |
| jam_ke | integer | Jam ke |
| materi | text | Materi yang diajarkan |
| catatan | text | Catatan tambahan |
| tahun_ajaran | text | Tahun ajaran |
| semester | integer | Semester |
| created_by | text | Guru yang membuat sesi |

#### `absensi_detail` - Detail Kehadiran Siswa
| Kolom | Tipe | Keterangan |
|-------|------|------------|
| id | bigserial | Primary key |
| sesi_id | bigint | Foreign key ke absensi_sesi |
| siswa_id | text | ID Siswa |
| nama_siswa | text | Nama siswa |
| nis | text | NIS siswa |
| status | text | H/S/I/A (Hadir/Sakit/Izin/Alpa) |
| keterangan | text | Keterangan tambahan |

### 5. Import Data Jadwal dari Excel

Jika Anda memiliki data jadwal dalam format Excel/CSV, Anda bisa:

**Opsi A: Manual via SQL**
```sql
INSERT INTO jadwal_guru (guru_id, nama_guru, hari, jam_ke, kelas, mata_pelajaran, tahun_ajaran, semester, aktif)
VALUES
    ('G-IC-001', 'Imran', 'Senin', 5, 'XI C', 'Matematika', '2024/2025', 2, true),
    ('G-IC-001', 'Imran', 'Senin', 6, 'XI C', 'Matematika', '2024/2025', 2, true);
```

**Opsi B: Via Supabase Table Editor**
1. Buka **Table Editor** di sidebar
2. Pilih tabel `jadwal_guru`
3. Klik **Insert** → **Insert row**
4. Isi data manual

**Opsi C: Bulk Import (akan dibuat nanti)**
- Kami akan buat API endpoint untuk import bulk dari Excel

### 6. Test RLS Policies

RLS (Row Level Security) sudah dikonfigurasi sehingga:
- ✅ Guru hanya bisa lihat jadwal dan absensi mereka sendiri
- ✅ Admin (KAMAD/TU) bisa lihat semua data
- ✅ Guru hanya bisa input absensi untuk jadwal mereka

Untuk test, Anda perlu set context sebelum query:

```sql
-- Set as teacher G-IC-001
SET app.current_guru_id = 'G-IC-001';
SET app.current_user_role = 'GURU';

-- This will only return G-IC-001's schedules
SELECT * FROM jadwal_guru;
```

## Next Steps

Setelah database setup selesai:
1. ✅ Review implementation plan
2. ⏳ Buat API routes untuk CRUD operations
3. ⏳ Buat UI components untuk absensi
4. ⏳ Testing end-to-end flow

## Troubleshooting

### Error: "permission denied for table"
- Pastikan RLS policies sudah dijalankan
- Check apakah Anda sudah set `app.current_guru_id` dan `app.current_user_role`

### Error: "duplicate key value violates unique constraint"
- Ada data yang sudah ada dengan key yang sama
- Hapus data lama atau ubah nilai yang conflict

### Tables tidak muncul di Table Editor
- Refresh browser
- Check apakah SQL migration berhasil dijalankan
- Lihat di SQL Editor → History untuk cek error
