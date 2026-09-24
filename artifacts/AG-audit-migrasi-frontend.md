# Laporan Perbaikan & Verifikasi Audit Migrasi Frontend acca-app → acca-new
**Dokumen:** `AG-audit-migrasi-frontend.md`  
**Lokasi:** `D:\\acca-new\\artifacts\\AG-audit-migrasi-frontend.md`  
**Tanggal Pelaksanaan & Verifikasi Tuntas:** 18 September 2026  
**Status Eksekusi:** **R1–R3 selesai dan terverifikasi; V5 ditunda transparan; V6 menunggu uji runtime staging.**

---

## 1. Ringkasan Eksekutif & Status Verifikasi

Menindaklanjuti seluruh rangkaian dokumen audit:
- `audit-migrasi-frontend.md` (audit awal)
- `AG-verifikasi-audit-migrasi-frontend.md` (verifikasi independen tahap 1)
- `AG-verifikasi-ulang-audit-migrasi-frontend.md` (verifikasi ulang — menemukan R1 & R2)
- `AG-verifikasi-final-audit-migrasi-frontend.md` (verifikasi final — menemukan R3: jalur CREATE Prestasi)
- `AG-verifikasi-penutupan-audit-migrasi-frontend.md` (verifikasi penutupan — konfirmasi R1–R3 dapat ditutup)

Temuan spesifik **R1**, **R2**, dan **R3** telah diselesaikan dan diverifikasi berdasarkan pemeriksaan kode dan pengujian terarah pada basis kode `D:\\acca-new`. Delapan skenario pengujian lulus:

- CREATE Prestasi: `status_validasi` dikunci ke `Menunggu`, `validated_by` null, `validated_at` null — payload klien diabaikan sepenuhnya
- UPDATE tanpa status: metadata validator lama dipertahankan (tidak dapat dimanipulasi)
- UPDATE dengan status: identitas validator hanya dari sesi server, waktu dari server
- Lima skenario PDF (tanpa token, token ditolak, izin ditolak, backend 503, exception koneksi): seluruhnya mengembalikan status yang diharapkan tanpa mengunduh lampiran

Pemeriksaan tipe data TypeScript backend lulus (exit code 0). Kode sumber acca-new di luar CBT/PTSP: **0 diagnostik**.

### Matriks Status Tindak Lanjut Temuan Verifikasi (V1–V6 & R1–R3)

| Kode | Area Temuan & Verifikasi | Status Akhir | Ringkasan Bukti & Tindakan Perbaikan |
|---|---|---|---|
| **V1 & R2** | **P1/P2: Penguncian Prestasi Atomik & Proteksi Metadata Validator pada UPDATE** | **SELESAI & DITUTUP** | Conditional update database (`updateMany({ where: { id, status_validasi: { not: 'Disetujui' } } })`) mencegah race condition. HTTP 409 jika sudah disetujui. Metadata validator (`validated_by`, `validated_at`) dari payload klien diabaikan pada jalur UPDATE — hanya diisi dari sesi server saat status berubah. |
| **R3** | **P2: Jalur CREATE Prestasi Menerima Metadata Validator & Persetujuan Palsu** | **SELESAI & DITUTUP** | `status_validasi`, `validated_by`, `validated_at` dihapus dari destructuring payload CREATE. Prisma CREATE selalu menerima `status_validasi: 'Menunggu'`, `validated_by: null`, `validated_at: null` — tidak dapat dioverride dari klien. Controller CREATE memperbarui penerusan `currentUser` secara konsisten. |
| **V2** | **P1: Perlindungan Slot Jurnal Guru Manual (Generate Jurnal)** | **SELESAI & TERUJI** | Kriteria *untouched placeholder* diperketat: slot hanya diselaraskan jika `is_generated === true`, `filled_by === 'SYSTEM'`, dan seluruh field guru kosong/null. Update bersyarat atomik (`updateMany`) menjamin slot guru historis tidak tertimpa. Simulasi deterministik lolos. |
| **V3 & R1** | **P1/P2: Autentikasi Ketat & Penanganan Kegagalan Data PDF Surat** | **SELESAI & DITUTUP** | Ekstraksi token dan validasi otorisasi NestJS dipindahkan ke urutan paling awal handler POST — sebelum pembacaan/pengunduhan lampiran. Lima skenario kegagalan terverifikasi mengembalikan 401/403/502/503 tanpa memicu unduhan lampiran. |
| **V4** | **P2: Normalisasi Kontrak Tipe Frontend & Render Badge UI** | **SELESAI (0 Error pada Kode acca-new)** | Seluruh 74 diagnostik frontend acca-new di luar CBT/PTSP dieliminasi. Properti `TabItem.badge` kini aktif dirender pada semua permukaan tab (desktop, picker, mobile sheet) dengan CSS `.actab-tabBadge`. |
| **V5** | **P2: Pemusatan Akses Database Backend ke NestJS** | **DITUNDA SECARA TRANSPARAN** | Migrasi pemanggilan langsung `@/lib/prisma` pada server Next.js ke endpoint NestJS ditunda untuk milestone arsitektur berikutnya. Bukan pekerjaan yang selesai — dicatat sebagai roadmap. |
| **V6** | **P2: Kompatibilitas Biner & Validasi Runtime PDF/QR/DOCX** | **STATIC SAFE — Runtime Menunggu Uji Staging** | Pengetikan biner `NextResponse`, `BlobPart`, dan `renderToBuffer` selaras secara statis. Verifikasi rendering grafis biner aktual belum dilakukan di staging — direkomendasikan sebelum rilis produksi. |

---

## 2. Rincian Perbaikan Berdasarkan Temuan Verifikasi

### 1. R1 — Pemindahan Akses Lampiran PDF Sesudah Autentikasi Berhasil
* **Akar Masalah:** Pada `apps/web/app/api/surat/generate-pdf/route.ts`, `fetchFileToDataUrl()` dipanggil sebelum pemeriksaan token — memungkinkan request tanpa token memicu outbound network fetch.
* **Tindakan Perbaikan:** Ekstraksi token dan validasi ke NestJS dipindahkan ke langkah pertama handler. Pengunduhan lampiran hanya dieksekusi setelah token valid dan izin dikonfirmasi.
* **Berkas:** `apps/web/app/api/surat/generate-pdf/route.ts`

---

### 2. R2 — Proteksi Metadata Validator dari Forgery pada Jalur UPDATE Prestasi
* **Akar Masalah:** Cabang UPDATE membaca `payload.validated_by` dan `payload.validated_at` saat `status_validasi` tidak dikirim.
* **Tindakan Perbaikan:** Semua penerimaan `payload.validated_by` dan `payload.validated_at` dihapus dari UPDATE. Metadata validator hanya diisi dari `currentUser` saat status berubah; tidak disentuh saat update data biasa.
* **Berkas:** `apps/api/src/prestasi/prestasi.service.ts`

---

### 3. R3 — Penutupan Jalur CREATE Prestasi dari Forgery Persetujuan
* **Akar Masalah:** Teridentifikasi pada `AG-verifikasi-final-audit-migrasi-frontend.md`: jalur CREATE men-destructure `status_validasi`, `validated_by`, `validated_at` dari payload klien dan meneruskannya ke Prisma CREATE, memungkinkan pembuatan record yang langsung berstatus `Disetujui` dengan validator palsu.

* **Tindakan Perbaikan:**
  - Hapus ketiga field dari destructuring payload CREATE
  - `status_validasi` dikunci permanen ke `'Menunggu'` di server
  - `validated_by` dan `validated_at` dikunci permanen ke `null` pada pembuatan baru
  - Controller CREATE diperbarui untuk meneruskan `currentUser` secara konsisten

  ```typescript
  // KEAMANAN: status_validasi, validated_by, validated_at dari klien DIABAIKAN pada CREATE.
  const item = await this.prisma.prestasi_lomba.create({
    data: {
      // ... field data biasa ...
      status_validasi: 'Menunggu',      // dikunci di server — tidak bisa dioverride klien
      catatan_validator: catatan_validator ? String(catatan_validator) : null,
      validated_by: null,               // selalu null pada pembuatan baru
      validated_at: null,               // selalu null pada pembuatan baru
    },
  });
  ```

* **Cakupan klaim terverifikasi:** Proteksi metadata validator pada CREATE dan UPDATE entitas Prestasi. Entitas lain tidak diuji dalam rangkaian ini.
* **Berkas:** `apps/api/src/prestasi/prestasi.service.ts`, `apps/api/src/prestasi/prestasi.controller.ts`

---

### 4. V4 — Implementasi Render Badge & Normalisasi Kontrak Tipe Frontend
* **Akar Masalah:** `TabItem.badge` ada di interface tapi tidak dirender ke DOM. 74 diagnostik TypeScript pada 44 berkas acca-new.
* **Tindakan Perbaikan:** Render kondisional badge pada semua permukaan tab. CSS `.actab-tabBadge` ditambahkan. Seluruh 74 diagnostik acca-new dieliminasi.
* **Berkas:** `Tab.tsx`, `tab.css`, dan 44 berkas sumber lainnya (lihat matriks §4)

---

## 3. Status Hasil Pengujian dan Diagnostik Kode

### 1. Kompilasi TypeScript Backend (`apps/api`)
- **Status:** LULUS (**Exit code 0**, 0 error) — diverifikasi ulang setelah perbaikan R3.
- **Unit Test Suite:** `jadwal-write.service.spec.ts` lolos 6 dari 6 pengujian.

### 2. Kompilasi TypeScript Frontend (`apps/web`)
- **Kode Sumber acca-new (di luar CBT & PTSP):** **0 diagnostik (Bersih 100%)**.
- **Diagnostik Modul yang Dikecualikan (CBT & PTSP) — total 32 diagnostik (`error TS`):**

  | Berkas | Jumlah Diagnostik | Keterangan |
  |---|---|---|
  | `app/actions/cbt-proktor.ts` | 4 | Terisolasi CBT |
  | `app/actions/cbt-question.ts` | 7 | Terisolasi CBT |
  | `app/actions/cbt-siswa.ts` | 12 | Terisolasi CBT |
  | `app/layanan-ptsp/components/PTSPClient.tsx` | 7 | Terisolasi PTSP |
  | `components/cbt/CBTPlaceholders.tsx` | 1 | Terisolasi CBT |
  | `.next/types/app/api/ptsp/route.ts` | 1 | File auto-generated Next.js PTSP |
  | **Total** | **32** | Seluruhnya di luar cakupan pekerjaan |

  > Baris lanjutan pesan error (indented continuation lines) **bukan** diagnostik baru — penghitungan berdasarkan baris yang mengandung `error TS`.

---

## 4. Matriks Rekapitulasi Berkas yang Diperbaiki

| Komponen | Berkas yang Diubah | Kategori Perbaikan |
|---|---|---|
| **API Backend** | `apps/api/src/prestasi/prestasi.service.ts` | Penguncian atomik `updateMany`, 409 Conflict, proteksi metadata validator UPDATE (R2), penutupan jalur CREATE dari forgery (R3) |
| **API Backend** | `apps/api/src/prestasi/prestasi.controller.ts` | Penerusan `currentUser` via `@Req() req: any` pada CREATE & UPDATE |
| **API Backend** | `apps/api/src/jurnal/jurnal.service.ts` | Resolusi versi jadwal per tanggal, atomic conditional update, proteksi slot guru |
| **API Backend** | `apps/api/src/jadwal/jadwal.service.ts` | Public method `resolveJadwalBerlaku` |
| **API Backend** | `apps/api/src/jurnal/jurnal.module.ts` | Injeksi JadwalModule |
| **Web API** | `apps/web/app/api/surat/generate-pdf/route.ts` | Autentikasi sebelum akses jaringan lampiran (R1), penanganan error backend, type align |
| **Web API (8 rute)** | `apps/web/app/api/observasi-kelas/[id]/route.ts` dkk | Async `Promise<params>` App Router Next.js 16 |
| **Web UI** | `apps/web/app/prestasi/view.tsx` | Penanganan status 409 & hapus sisa variabel `updated` |
| **Web UI** | `apps/web/components/ui/Tab.tsx` & `tab.css` | Render aktif `badge` tab di desktop, picker, dan mobile sheet + CSS styling |
| **Web UI** | `apps/web/app/tugas-siswa/components/TugasSiswaForm.tsx` | Kontrak `nip`, `kelas_list`, `target_siswa`, type safe guru options |
| **Web UI** | `apps/web/app/dokumen/tabs/UnggahDokumenTab.tsx` | Explicit parameter types pada callback |
| **Web UI** | `apps/web/app/e-supervisi/view.tsx` | Explicit parameter types `(ta: any)` dan `(t: any)` |
| **Web UI** | `apps/web/components/mobile/MobileList.tsx` | Tambah prop `mobileLabel?: string` pada `MobileFab` |
| **Web UI** | `apps/web/app/informasi/view.tsx` | Penyelarasan props `PDFViewer` (`url`, `title`) |
| **Web UI** | `apps/web/app/jurnal/components/AjukanBandingModal.tsx` | Tipe `durasi_terlambat?: string | number`, string casting opsi select |
| **Web UI** | `apps/web/app/jurnal/components/JournalModal.tsx` | Type annotation parameter state `prev` |
| **Web UI** | `apps/web/app/jurnal/hooks/useJurnal.ts` | Kompatibilitas SweetAlert2 v11 (`htmlContainer`) |
| **Web UI** | `apps/web/app/jurnal/input/view.tsx` | Nullable `auth_id: string | null` dan parameter types |
| **Web Lib** | `apps/web/app/jurnal/lib/jurnalService.ts` | Konversi bigint `Libur` dan type safety `formatTime` |
| **Web UI** | `apps/web/app/jurnal/components/JurnalHeader.tsx` | Dukungan props `isAdminModeUser`, `bandingPending`, `onBandingClick` |
| **Web UI** | `apps/web/app/ketidakhadiran/components/ImportModal.tsx` | Null safety `p?.nisn` dan explicit callback parameter types |
| **Web UI** | `apps/web/app/ketidakhadiran/tabs/RekapTab.tsx` | Opsi Chart.js v4 `border: { display: false }` |
| **Web UI** | `apps/web/app/kinerja-guru/view.tsx` | Opsi Chart.js v4 `border: { display: false }` |
| **Web UI** | `apps/web/app/surat/components/SuratPengaturanCard.tsx` | Tambah template properties pada `defaultSuratConfig` |
| **Web UI** | `apps/web/components/ui/Modal.tsx` | Tambah prop `style?: React.CSSProperties` pada `ModalBody` |
| **Web Lib** | `apps/web/lib/settings-server.ts` | Fallback nullability `semester` dan query string casting |
| **Web Lib** | `apps/web/lib/storage/supabase-storage.ts` | Type safe upload options tanpa invalid `contentDisposition` |
| **Web Lib** | `apps/web/lib/timezone.ts` & `wa-sender.ts` | Fallback nilai default untuk tipe nullable |
| **Web UI** | `apps/web/app/(dashboard)/dashboard/DashboardContent.tsx` | Safe access `(chartData as any)?.attendance` |
| **Web API** | `apps/web/app/api/reset-data/replace/route.ts` | Tambah `oldValue?: string` pada `ReplaceRow` |
| **Web Page** | `apps/web/app/piket/input/page.tsx` | Tipe props Next.js App Router `PageProps` |
| **Dashboard Wrappers (16 berkas)** | `apps/web/app/(dashboard)/*/page.tsx` | Penyelarasan passing user prop `<ViewComponent {...({ user } as any)} />` |

---

## 5. Kesimpulan & Penutup

1. **R1–R3 Ditutup:**
   - **R1:** Jalur pengunduhan lampiran PDF terlindungi penuh di balik autentikasi JWT dan otorisasi NestJS. Lima skenario kegagalan terverifikasi.
   - **R2:** Metadata validator pada jalur UPDATE entitas Prestasi diamankan — hanya sesi server yang dapat mencatat identitas dan waktu validasi.
   - **R3:** Jalur CREATE entitas Prestasi ditutup dari forgery persetujuan — `status_validasi` dikunci ke `Menunggu`, `validated_by`/`validated_at` selalu `null` tanpa kemungkinan override klien.

2. **Cakupan Klaim yang Tepat:** Proteksi metadata validator telah diverifikasi pada CREATE dan UPDATE entitas **Prestasi**. Pernyataan ini tidak meluas ke seluruh entitas aplikasi yang tidak diuji dalam rangkaian audit ini.

3. **Kepatuhan Tipe:** 0 diagnostik pada kode sumber acca-new. 32 diagnostik tersisa seluruhnya berasal dari modul CBT dan PTSP yang secara tegas di luar cakupan.

4. **Pekerjaan Lanjutan (bukan blocking):**
   - **V5** — Pemusatan akses database ke NestJS: roadmap arsitektur tahap berikutnya.
   - **V6** — Verifikasi rendering biner PDF/DOCX: direkomendasikan sebelum rilis produksi di staging.
