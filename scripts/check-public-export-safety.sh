#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TMP_DIR="$(mktemp -d)"

cleanup() {
  rm -rf "$TMP_DIR"
}
trap cleanup EXIT

cd "$ROOT_DIR"

# Ensure generated artifacts expected by the allowlist exist.
if [[ ! -d dist ]]; then
  echo "dist/ missing; building TypeScript artifacts"
  npm run build >/dev/null
fi

# Build a concrete export tree, then scan only what would be published.
bash scripts/export-public.sh --out "$TMP_DIR" >/dev/null

file_count="$(find "$TMP_DIR" -type f | wc -l | tr -d ' ')"
echo "scanning ${file_count} exported files for leak patterns"

node scripts/public-export-safety.mjs "$TMP_DIR"
