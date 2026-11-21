# Kapasitas server: beban per permintaan, login serentak, dan batas kontainer (21 November 2026)

acca-new, CBT, dan PostgreSQL berjalan di satu VPS. Audit menemukan beberapa pekerjaan acca-new yang ikut membuat server tersendat saat ramai (pagi hari, ujian):

| Masalah | Perbaikan |
|---|---|
| `resolveCapabilities` memanggil `getRoleCapabilitiesMap(true)`; argumen `true` melewati cache, jadi **setiap permintaan API** membaca seluruh tabel `role_capabilities`. `resolveUserAccess` (setiap navigasi halaman lewat middleware → `/access/me`) membaca `role_pages` dan `role_capabilities` penuh juga. | Peta peran memakai cache 30 detik yang memang sudah ada (dikosongkan seketika saat diubah lewat menu Hak Akses). Peran tugas per NIP dan pengecualian kapabilitas per user ikut di-cache 30 detik. Pemeriksaan keamanan murah (akun aktif, versi sesi, wajib ganti password) **tetap** dibaca langsung tiap permintaan. |
| Semua login lewat route Next acca-web, dan API tidak mempercayai `X-Forwarded-For`; pembatas laju melihat SATU IP (kontainer acca-web) → seluruh sekolah berbagi kuota 120 login/menit. Siswa di jaringan sekolah pun satu IP NAT. | Kuota login per **IP asli + akun** (10/menit), plus batas per **akun** berapa pun IP-nya (30 per 15 menit). API hanya mempercayai `X-Forwarded-For` dari loopback/alamat privat (`trust proxy`). |
| Panggilan internal acca-web → acca-api (mis. resolusi akses saat siswa membuka CBT lewat SSO) juga berbagi satu kuota IP → setelah ~120 siswa/menit SSO ke CBT gagal. | Permintaan dengan `x-internal-key` yang valid tidak dihitung kuota (kunci tetap diverifikasi endpoint). |
| Heartbeat setiap 15 detik per tab menulis `UPDATE public.users` dengan kondisi `OR auth_id/id`. | `last_seen` ditulis paling sering sekali per menit per user (segera bila halaman berpindah), memakai primary key. Status online tetap dari PresenceService. |
| `public.users.auth_id` tanpa index, padahal dibaca CBT di setiap permintaan. | Migrasi `apps/api/prisma/sql/20261121_users_auth_id_index.sql` (otomatis saat deploy, aman diulang, tidak membuat index ganda). |
| Monitoring memuat seluruh tabel pengguna setiap 5 detik, termasuk di tab latar belakang. | 20 detik, berhenti saat tab tersembunyi. |
| Pool Prisma bergantung jumlah core (≈13 per proses) dan acca-api/acca-web tanpa batas CPU/RAM, tanpa rotasi log. | Pool eksplisit (`API_DB_CONNECTION_LIMIT` 20, `WEB_DB_CONNECTION_LIMIT` 10). Batas CPU/RAM dan rotasi log (20 MB × 5) di `docker-compose.yml`. |

## Langkah di VPS (di luar jam sekolah/ujian)

1. **Deploy** seperti biasa. Migrasi index berjalan otomatis; kontainer dibuat ulang karena konfigurasinya berubah.
2. **Pindahkan `DATABASE_URL` dari IP publik** ke `host.docker.internal` di `.env` VPS:

   ```
   DATABASE_URL="postgresql://<user>:<password>@host.docker.internal:5432/acca_db?schema=public"
   ```

   Pastikan `pg_hba.conf` mengizinkan subnet Docker (mis. `172.16.0.0/12`) dan PostgreSQL mendengarkan alamat gateway Docker, lalu `docker compose up -d`. Periksa `docker compose logs acca-api | grep -i prisma`. Setelah acca-new **dan** CBT tidak lagi memakai IP publik, tutup port 5432 dari internet di firewall aaPanel/penyedia VPS. Skrip `tools/vps/cek-database.sh` di repo CBT membantu memeriksanya.
3. **Ikat port ke 127.0.0.1.** Pastikan reverse proxy aaPanel mengarah ke `127.0.0.1`/`localhost`:

   ```bash
   grep -rn "proxy_pass" /www/server/panel/vhost/nginx/ | grep -E "300[67]"
   ```

   Bila semuanya `127.0.0.1` atau `localhost`, tambahkan `ACCA_BIND_ADDR=127.0.0.1` ke `.env` lalu `docker compose up -d`. Port yang dipublikasikan Docker melewati UFW; dengan 0.0.0.0 API bisa dijangkau langsung tanpa Nginx.
4. **Pastikan Nginx mengirim IP asli.** Di lokasi reverse proxy acca:

   ```nginx
   proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
   proxy_set_header X-Real-IP $remote_addr;
   ```

   Tanpa ini kuota login tetap per akun (aman), tetapi IP pada kuota pertama bisa dipalsukan klien.
5. Pantau `docker stats` pada hari ramai pertama setelah rilis. RAM yang terus menempel di plafon berarti `ACCA_*_MEM` perlu dinaikkan.

## Perilaku yang berubah

- Perubahan peran tugas (wali kelas, pembina, pengurus kelas) di luar menu Hak Akses berlaku paling lambat 30 detik kemudian. Penonaktifan akun, logout semua sesi, dan ganti password tetap berlaku seketika.
- Teks "x menit lalu" di Monitoring kini paling halus per menit; status online tidak berubah.
- Satu akun yang salah password 10 kali dalam semenit dari satu IP, atau 30 kali dalam 15 menit dari mana pun, menunggu sebelum boleh mencoba lagi.
