#!/usr/bin/env bash
set -euo pipefail

# Clean all workspace node_modules and build artifacts without touching your database migrations.
# Use this before packaging/copying the scaffold.

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo "[clean] Removing root artifacts"
rm -rf "$ROOT_DIR/node_modules" \
       "$ROOT_DIR/.turbo" \
       "$ROOT_DIR/pnpm-lock.yaml" \
       "$ROOT_DIR/.eslintcache" \
       "$ROOT_DIR/coverage"

echo "[clean] Removing nested node_modules"
find "$ROOT_DIR/apps" -type d -name node_modules -prune -exec rm -rf {} +
find "$ROOT_DIR/packages" -type d -name node_modules -prune -exec rm -rf {} +

echo "[clean] Removing app build artifacts"
rm -rf \
  "$ROOT_DIR/apps/frontend/build" \
  "$ROOT_DIR/apps/frontend/.react-router" \
  "$ROOT_DIR/apps/backend/build" \
  "$ROOT_DIR/apps/backend/.turbo"

echo "[clean] Removing package build artifacts"
rm -rf \
  "$ROOT_DIR/packages/shared/dist"

echo "[clean] Removing OS/editor cruft"
find "$ROOT_DIR" -name ".DS_Store" -delete || true

# Optional: uncomment to strip local env files before sharing
# rm -f "$ROOT_DIR/.env.local"
# find "$ROOT_DIR/apps" -maxdepth 2 -name ".env.local" -delete
# find "$ROOT_DIR/packages" -maxdepth 2 -name ".env.local" -delete

echo "[clean] Done."


