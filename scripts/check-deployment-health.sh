#!/usr/bin/env sh
set -eu

# A started container may already be crashing; require both services to be healthy.
attempt=0
while [ "$attempt" -lt 36 ]; do
  ready=true
  for service in acca-api acca-web; do
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
    echo 'Backend dan frontend healthy.'
    exit 0
  fi
  attempt=$((attempt + 1))
  sleep 5
done
echo 'Deployment gagal: layanan belum healthy dalam 180 detik.'
exit 1
