#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

TARGETS=(
  "README.md"
  "docs/REWARD-WHOLENESS.md"
  "docs/IDEAS.md"
  "examples/"
)

if find examples -maxdepth 1 -type f -name 'john-*.json' | grep -q .; then
  echo "error: found legacy john-* example filenames; use neutral example-* names" >&2
  find examples -maxdepth 1 -type f -name 'john-*.json' -print >&2
  exit 1
fi

if rg -n -H --color never \
  -e 'John Malone' \
  -e 'johnmalone' \
  -e 'john_malone' \
  -e 'apylon777' \
  -e 'humans@conductor.build' \
  "${TARGETS[@]}"; then
  echo "error: personal identifier leak detected in public-facing examples/docs" >&2
  exit 1
fi

echo "example anonymization check passed"
