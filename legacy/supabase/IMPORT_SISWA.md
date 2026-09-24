# Panduan Import Data Siswa dari Google Sheets

## Langkah 1: Siapkan Data di Google Sheets

Pastikan Google Sheets Anda punya kolom-kolom ini (urutan bebas):

### **Kolom WAJIB:**
| Kolom | Tipe | Contoh | Keterangan |
|-------|------|--------|------------|
| `nisn` | TEXT | `0089123456` | NISN siswa (HARUS TEXT!) |
| `nama` | TEXT | `Ahmad Fauzi` | Nama lengkap |
| `kelas` | TEXT | `XI B` | Kelas siswa |
| `aktif` | BOOLEAN | `TRUE` | Status aktif (TRUE/FALSE) |

### **Kolom OPSIONAL:**
| Kolom | Tipe | Contoh |
|-------|------|--------|
| `siswa_id` | TEXT | `S-XIB-001` |
| `tahun_ajaran` | TEXT | `2024/2025` |
| `jenis_kelamin` | TEXT | `L` atau `P` |
| `tempat_lahir` | TEXT | `Jakarta` |
| `tanggal_lahir` | DATE | `2008-05-15` |

## Langkah 2: Export dari Google Sheets

1. **File → Download → CSV (.csv)**
2. Simpan dengan nama yang jelas, misalnya `siswa_kelas.csv`

## Langkah 3: Import ke Supabase

### **Opsi A: Via Supabase Dashboard (Mudah)**

1. Buka **Supabase Dashboard**
2. Buka **Table Editor** (sidebar kiri)
3. Pilih tabel `siswa_kelas`
4. Klik **Import Data from CSV**
5. Upload file CSV
6. Map kolom CSV ke kolom tabel
7. Klik **Import**

### **Opsi B: Via SQL (Bulk Insert)**

1. Convert CSV ke SQL INSERT statements
2. Atau gunakan script Python/Node.js untuk batch insert

Contoh SQL manual:

```sql
INSERT INTO siswa_kelas (nisn, nama, kelas, aktif) VALUES
    ('0089123456', 'Ahmad Fauzi', 'XI B', true),
    ('0089123457', 'Budi Santoso', 'XI B', true),
    ('0089123458', 'Citra Dewi', 'XI C', true)
ON CONFLICT (nisn) DO UPDATE SET
    nama = EXCLUDED.nama,
    kelas = EXCLUDED.kelas,
    aktif = EXCLUDED.aktif,
    updated_at = NOW();
```

## Langkah 4: Update API Siswa

Karena nama tabel berubah dari `siswa` → `siswa_kelas`, update API route:

File: `app/api/siswa/[kelas]/route.ts`

Ubah:
```typescript
.from('siswa')  // ← ganti ini
```

Jadi:
```typescript
.from('siswa_kelas')  // ← ke ini
```

Dan kolom juga:
```typescript
.select('siswa_id, nama_siswa, nisn, kelas, aktif')  // ← old
.select('siswa_id, nama as nama_siswa, nisn, kelas, aktif')  // ← new (alias)
```

## Langkah 5: Verify Data

Cek apakah data sudah masuk:

```sql
-- Lihat total siswa per kelas
SELECT kelas, COUNT(*) as total
FROM siswa_kelas
WHERE aktif = true
GROUP BY kelas
ORDER BY kelas;

-- Lihat sample data kelas XI B
SELECT nisn, nama, kelas, aktif
FROM siswa_kelas
WHERE kelas = 'XI B'
ORDER BY nama
LIMIT 10;
```

## Tips Import

✅ **DO:**
- Pastikan NISN format TEXT di Excel (tambah apostrophe di depan jika perlu: `'0089123456`)
- Gunakan TRUE/FALSE untuk kolom `aktif`
- Pastikan nama kelas match dengan `jadwal_guru`

❌ **DON'T:**
- Jangan format NISN sebagai number (akan hilang leading zero)
- Jangan ada duplikat NISN (akan error)
- Jangan ada baris kosong di CSV

## Troubleshooting

**Error "duplicate key":**
- Ada NISN yang sama di data
- Cari duplikat: 
  ```sql
  SELECT nisn, COUNT(*) FROM siswa_kelas GROUP BY nisn HAVING COUNT(*) > 1;
  ```

**NISN jadi number (0089 → 89):**
- Di Excel, format kolom NISN sebagai TEXT sebelum input data
- Atau tambah apostrophe: `'0089123456`

**Kelas tidak muncul di dropdown:**
- Pastikan nama kelas di `siswa_kelas` exact match dengan `jadwal_guru`
- Case sensitive: `"XI B"` ≠ `"xi b"`
