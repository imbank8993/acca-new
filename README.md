# ACCA

**Academic Center & Administration Application** untuk MAN Insan Cendekia Gowa.

Mengelola absensi, jurnal guru, nilai siswa, laporan wali kelas, perizinan, persuratan digital, dan informasi madrasah.

## Teknologi

Next.js · React · TypeScript · NestJS · Prisma · PostgreSQL

## Struktur

- `apps/web` — aplikasi web.
- `apps/api` — layanan API.
- `packages/shared` — kode bersama.

## Menjalankan secara lokal

Siapkan Node.js dan database PostgreSQL ACCA. Salin `.env.example` ke `apps/web/.env.local` dan `apps/api/.env`, lalu sesuaikan konfigurasinya.

Jalankan dari direktori utama proyek:

```bash
npm install
npm exec --workspace=apps/api -- prisma generate
npm run dev:all
```

- Web: [localhost:3006](http://localhost:3006)
- API: [localhost:3007/api](http://localhost:3007/api)

## Build

```bash
npm run build
```

## Deploy produksi (VPS)

Push ke `main` menjalankan `.github/workflows/deploy.yml`:

1. **build-images** — GitHub Actions membangun image `acca-api` dan `acca-web`, lalu menyimpannya di GHCR privat sebagai `ghcr.io/imbank8993/acca-new-<service>:<sha>` dan `:latest`. VPS tidak lagi membangun image, jadi CPU tidak penuh saat deploy (penting ketika ujian CBT berjalan di VPS yang sama).
2. **deploy** — lewat SSH, VPS mengambil commit, `docker compose pull` image versi `<sha>` (login GHCR memakai token job, lalu logout), menandainya `:latest`, menjalankan pemeriksaan dan migrasi SQL dengan image tersebut, lalu `docker compose up -d --no-build`. Tiga versi terakhir per layanan disimpan untuk rollback.

Rollback ke versi sebelumnya (di `/www/wwwroot/acca-new`; lihat tag yang tersedia dengan `docker images ghcr.io/imbank8993/acca-new-acca-api`):

```bash
ACCA_IMAGE_TAG=<sha> docker compose up -d --no-build
```

Kembali ke versi terbaru: `docker compose up -d --no-build`. Migrasi SQL tidak dibatalkan oleh rollback.

Build darurat langsung di VPS (mis. GitHub Actions/GHCR bermasalah) — bagian `build:` di `docker-compose.yml` sengaja dipertahankan:

```bash
docker compose build && docker compose up -d
```

Hasil build darurat menimpa tag `:latest` lokal; deploy berikutnya dari GitHub Actions akan menggantinya lagi.
