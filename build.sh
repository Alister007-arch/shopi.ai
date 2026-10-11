#!/usr/bin/env bash
# ShopAI Cloud Deployment Build Script
set -o errexit

echo "========================================="
echo "Building ShopAI Full-Stack Application"
echo "========================================="

echo "[1/3] Building React Frontend..."
cd frontend
npm install
npm run build
cd ..

echo "[2/3] Installing Python Dependencies..."
cd backend
pip install --upgrade pip
pip install -r requirements.txt

echo "[3/3] Initializing SQLite Catalog Database..."
python setup_db.py
cd ..

echo "==> Build finished successfully! Ready to launch."
