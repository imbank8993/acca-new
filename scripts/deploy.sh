#!/usr/bin/env bash
# ==============================================================================
# ACCA Deployment Script via Docker & Git
# ==============================================================================

set -e

echo "=================================================="
echo "🚀 Memulai Proses Deployment ACCA via Docker"
echo "=================================================="

# 1. Update source code dari branch main GitHub
echo "📥 [1/4] Mengambil commit terbaru dari GitHub (origin/main)..."
git fetch origin main
git reset --hard origin/main

# 2. Cek ketersediaan file environment
echo "🔍 [2/4] Memeriksa file konfigurasi..."
if [ ! -f ".env" ] && [ ! -f "apps/api/.env" ]; then
    echo "⚠️ PERINGATAN: File .env belum ditemukan di root proyek!"
fi

# 3. Build & Jalankan Container dengan Docker Compose
echo "🐳 [3/4] Melakukan build image dan menjalankan container..."
docker compose build
echo "🗄️ Menyiapkan kolom sasaran agenda..."
docker compose run --rm --no-deps acca-api node node_modules/prisma/build/index.js db execute --schema apps/api/prisma/schema.prisma --file apps/api/prisma/sql/20261013_agenda_sasaran.sql
echo "🗄️ Mengaktifkan audit perubahan database..."
docker compose run --rm --no-deps acca-api node node_modules/prisma/build/index.js db execute --schema apps/api/prisma/schema.prisma --file apps/api/prisma/sql/20261022_system_audit.sql
docker compose up -d --remove-orphans
sh scripts/check-deployment-health.sh

# 4. Bersihkan cache/image lama
echo "🧹 [4/4] Membersihkan docker image lama yang dangling..."
docker image prune -f

echo "=================================================="
echo "✅ Deployment Sukses! Status Container:"
echo "=================================================="
docker compose ps
