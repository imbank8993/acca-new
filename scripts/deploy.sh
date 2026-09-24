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
if [ ! -f "apps/api/.env" ]; then
    echo "⚠️ PERINGATAN: apps/api/.env belum ditemukan!"
fi
if [ ! -f "apps/web/.env.local" ]; then
    echo "⚠️ PERINGATAN: apps/web/.env.local belum ditemukan!"
fi

# 3. Build & Jalankan Container dengan Docker Compose
echo "🐳 [3/4] Melakukan build image dan menjalankan container..."
docker compose up -d --build --remove-orphans

# 4. Bersihkan cache/image lama
echo "🧹 [4/4] Membersihkan docker image lama yang dangling..."
docker image prune -f

echo "=================================================="
echo "✅ Deployment Sukses! Status Container:"
echo "=================================================="
docker compose ps
