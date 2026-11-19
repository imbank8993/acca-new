#!/usr/bin/env sh
set -eu

# A started container may already be crashing; require every production service to be healthy.
attempt=0
while [ "$attempt" -lt 36 ]; do
  ready=true
  for service in acca-api acca-web acca-ocr acca-browser; do
    state=$(docker inspect --format '{{.State.Status}}' "$service")
    health=$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}missing{{end}}' "$service")
    if [ "$state" != running ] || [ "$health" = unhealthy ] || [ "$health" = missing ]; then
      echo "Deployment gagal: $service state=$state health=$health"
      exit 1
    fi
    if [ "$health" != healthy ]; then ready=false; fi
  done
  if [ "$ready" = true ]; then
    docker exec acca-web node -e '
      (async () => {
        const base = process.env.NEXT_PUBLIC_NEST_API_URL || "http://acca-api:3007/api";
        const response = await fetch(base + "/health", { signal: AbortSignal.timeout(10000) });
        const health = await response.json();
        if (!response.ok || health.prisma_postgresql !== "connected (PostgreSQL)") {
          throw new Error("Backend belum terhubung ke database");
        }
        const session = await fetch(base + "/access/me", { signal: AbortSignal.timeout(10000) });
        if (session.status !== 401) throw new Error("Pemeriksaan sesi tanpa token tidak mengembalikan 401");
        console.log("Koneksi web ke backend, database, dan penjagaan sesi terverifikasi.");
      })().catch(() => { console.error("Pemeriksaan koneksi backend gagal."); process.exitCode = 1; });'
    docker exec acca-api node -e '
      (async () => {
        const base = process.env.RECEIPT_OCR_WORKER_URL;
        if (!base) throw new Error("Endpoint OCR worker belum dikonfigurasi");
        const response = await fetch(base + "/health", { signal: AbortSignal.timeout(10000) });
        if (!response.ok || !(await response.json()).ok) throw new Error("OCR worker belum siap");
        console.log("Koneksi API ke OCR worker terverifikasi.");
      })().catch(error => { console.error("OCR worker gagal:", error.message); process.exitCode = 1; });'
    docker exec acca-web node -e '
      (async () => {
        const endpoint = process.env.PUPPETEER_BROWSER_WS_ENDPOINT;
        if (!endpoint) throw new Error("Endpoint browser worker belum dikonfigurasi");
        const browser = await require("puppeteer").connect({ browserWSEndpoint: endpoint, protocolTimeout: 30000 });
        try {
          const page = await browser.newPage();
          await page.setContent("<html><body>ACCA render check</body></html>");
          const pdf = await page.pdf({ format: "A4" });
          if (pdf.length < 100) throw new Error("PDF kosong");
          await page.close();
        } finally { await browser.close(); }
        console.log("Render PDF melalui browser worker terverifikasi.");
      })().catch(error => { console.error("Browser worker gagal:", error.message); process.exitCode = 1; });'
    echo 'Backend, frontend, OCR, dan browser worker healthy.'
    exit 0
  fi
  attempt=$((attempt + 1))
  sleep 5
done
echo 'Deployment gagal: layanan belum healthy dalam 180 detik.'
exit 1
