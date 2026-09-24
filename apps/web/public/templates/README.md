# Template Dokumen (Word)

Agar fitur cetak berfungsi, mohon letakkan **5 file** berikut di folder ini (`public/templates/`):

### 1. Surat Tugas (Izin - Madrasah)
*   **`template_surat_tugas.docx`** (Untuk 1 Siswa)
    *   Variabel: `{nama}`, `{nisn}`, `{kelas}`, `{tgl_mulai_fmt}`, `{tgl_selesai_fmt}`, `{keterangan}`
*   **`template_surat_tugas_lampiran.docx`** (Untuk Banyak Siswa/Grup)
    *   Berisi tabel looping: `{#list}` ... `{/list}`
    *   Di dalam loop: `{no}`, `{nama}`, `{nisn}`, `{kelas}`

### 2. Surat Izin Pribadi (Izin - Personal)
*   **`template_surat_izin_pribadi.docx`** (Untuk 1 Siswa)
*   **`template_surat_izin_pribadi_lampiran.docx`** (Untuk Banyak Siswa/Grup)

### 3. Surat Sakit
*   **`template_surat_sakit.docx`** (Hanya untuk 1 Siswa)

---
**Catatan Penting:**
*   Pastikan nama file **PERSIS** sama dengan di atas.
*   Gunakan format `{variable}` di dalam Word untuk tempat data akan muncul.
*   Untuk tabel grup, pastikan menggunakan tag loop `{#list}` diawal baris tabel dan `{/list}` diakhir baris.
