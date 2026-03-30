#!/usr/bin/env bash
set -euo pipefail

# export-public.sh
#
# First-slice skeleton for generating a public-safe export tree from this repo.
#
# Usage:
#   ./scripts/export-public.sh --out /tmp/ship-receipts-public [--dry-run]
#
# Notes:
# - Uses an allowlist manifest (export/public-allowlist.yml)
# - Copies only git-tracked files that match allowlist globs
# - Dry-run mode prints what would be exported
# - Full leak scanning/CI gates are intentionally deferred to later slices

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MANIFEST="${ROOT_DIR}/export/public-allowlist.yml"
OUT_DIR=""
DRY_RUN=0

usage() {
  cat <<EOF
Usage: $(basename "$0") --out <dir> [--manifest <path>] [--dry-run]

Options:
  --out <dir>         Output directory for exported tree (required)
  --manifest <path>   Allowlist manifest (default: export/public-allowlist.yml)
  --dry-run           Show what would be exported without writing files
  -h, --help          Show this help
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --out)
      if [[ -z "${2:-}" || "${2:-}" == -* ]]; then
        echo "error: --out requires a value" >&2
        exit 2
      fi
      OUT_DIR="$2"
      shift 2
      ;;
    --manifest)
      if [[ -z "${2:-}" || "${2:-}" == -* ]]; then
        echo "error: --manifest requires a value" >&2
        exit 2
      fi
      MANIFEST="$2"
      shift 2
      ;;
    --dry-run)
      DRY_RUN=1
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "error: unknown argument: $1" >&2
      usage
      exit 2
      ;;
  esac
done

if [[ -z "$OUT_DIR" ]]; then
  echo "error: --out is required" >&2
  usage
  exit 2
fi

if [[ ! -f "$MANIFEST" ]]; then
  echo "error: manifest not found: $MANIFEST" >&2
  exit 2
fi

if ! command -v git >/dev/null 2>&1; then
  echo "error: git is required" >&2
  exit 2
fi

resolve_path() {
  local input="$1"
  if command -v realpath >/dev/null 2>&1; then
    realpath "$input"
    return
  fi
  python3 -c 'import os,sys; print(os.path.realpath(sys.argv[1]))' "$input"
}

extract_list() {
  # Extract simple YAML list values under a top-level key.
  # Supports:
  # key:
  #   - value
  #   - value2
  local key="$1"
  awk -v key="$key" '
    $0 ~ "^" key ":" { in_key=1; next }
    in_key && $0 ~ "^[A-Za-z0-9_-]+:" { in_key=0 }
    in_key && $0 ~ /^[[:space:]]*-[[:space:]]+/ {
      sub(/^[[:space:]]*-[[:space:]]+/, "", $0)
      print $0
    }
  ' "$MANIFEST"
}

INCLUDE_PATTERNS=()
EXCLUDE_PATTERNS=()
REQUIRED_PATHS=()

while IFS= read -r line; do INCLUDE_PATTERNS+=("$line"); done < <(extract_list "include")
while IFS= read -r line; do EXCLUDE_PATTERNS+=("$line"); done < <(extract_list "exclude")
while IFS= read -r line; do REQUIRED_PATHS+=("$line"); done < <(extract_list "required")

if [[ ${#INCLUDE_PATTERNS[@]} -eq 0 ]]; then
  echo "error: include list is empty in $MANIFEST" >&2
  exit 2
fi

cd "$ROOT_DIR"
shopt -s globstar nullglob

EXPORT_FILES=()

for pattern in "${INCLUDE_PATTERNS[@]}"; do
  pattern_matches=0
  while IFS= read -r file; do
    [[ -z "$file" ]] && continue
    pattern_matches=1
    EXPORT_FILES+=("$file")
  done < <(git ls-files -- "$pattern")

  if [[ $pattern_matches -eq 0 ]]; then
    # Support generated artifacts (for example dist/) that are intentionally
    # gitignored in the private repo but should be exported publicly.
    for file in $pattern; do
      if [[ ! -e "$file" ]]; then
        continue
      fi
      pattern_matches=1
      if [[ -d "$file" ]]; then
        while IFS= read -r nested; do
          [[ -z "$nested" ]] && continue
          EXPORT_FILES+=("$nested")
        done < <(find "$file" -type f)
      else
        EXPORT_FILES+=("$file")
      fi
    done
  fi

  if [[ $pattern_matches -eq 0 ]]; then
    echo "error: include pattern matched no files: $pattern" >&2
    exit 1
  fi
done

if [[ ${#EXPORT_FILES[@]} -eq 0 ]]; then
  echo "error: no files matched include allowlist" >&2
  exit 1
fi

mapfile -t INCLUDE_FILES_SORTED < <(printf "%s\n" "${EXPORT_FILES[@]}" | LC_ALL=C sort -u)

# Defensive exclude filter (defense-in-depth)
if [[ ${#EXCLUDE_PATTERNS[@]} -gt 0 ]]; then
  FILTERED=()
  for file in "${INCLUDE_FILES_SORTED[@]}"; do
    blocked=0
    for pattern in "${EXCLUDE_PATTERNS[@]}"; do
      # shellcheck disable=SC2053
      # Unquoted RHS is intentional to support glob exclude patterns.
      if [[ "$file" == $pattern ]]; then
        blocked=1
        break
      fi
    done
    [[ $blocked -eq 0 ]] && FILTERED+=("$file")
  done

  # Exclude integrity: every exclude pattern should match at least one included path.
  for pattern in "${EXCLUDE_PATTERNS[@]}"; do
    pattern_matches=0
    for file in "${INCLUDE_FILES_SORTED[@]}"; do
      if [[ "$file" == $pattern ]]; then
        pattern_matches=1
        break
      fi
    done
    if [[ $pattern_matches -eq 0 ]]; then
      echo "error: exclude pattern matched no included tracked files: $pattern" >&2
      exit 1
    fi
  done

  EXPORT_FILES=("${FILTERED[@]}")
fi

mapfile -t EXPORT_FILES_SORTED < <(printf "%s\n" "${EXPORT_FILES[@]}" | LC_ALL=C sort -u)

# Required-path integrity: required entries must survive include/exclude filtering.
for required in "${REQUIRED_PATHS[@]}"; do
  found=0
  for file in "${EXPORT_FILES_SORTED[@]}"; do
    if [[ "$file" == "$required" ]]; then
      found=1
      break
    fi
  done
  if [[ $found -eq 0 ]]; then
    echo "error: required path is not exportable after allowlist/exclude filtering: $required" >&2
    exit 1
  fi
done

if [[ $DRY_RUN -eq 1 ]]; then
  echo "[dry-run] manifest: $MANIFEST"
  echo "[dry-run] output:   $OUT_DIR"
  echo "[dry-run] files to export: ${#EXPORT_FILES_SORTED[@]}"
  printf '%s\n' "${EXPORT_FILES_SORTED[@]}"
  exit 0
fi

ROOT_DIR_RESOLVED="$(resolve_path "$ROOT_DIR")"
mkdir -p "$OUT_DIR"
OUT_DIR_RESOLVED="$(resolve_path "$OUT_DIR")"

if [[ "$OUT_DIR" == "/" || "$OUT_DIR_RESOLVED" == "/" ]]; then
  echo "error: refusing to remove output directory '/'" >&2
  exit 2
fi

if [[ "$ROOT_DIR_RESOLVED" == "$OUT_DIR_RESOLVED" || "$ROOT_DIR_RESOLVED" == "$OUT_DIR_RESOLVED"/* ]]; then
  echo "error: refusing to remove output directory that contains repo root: $OUT_DIR_RESOLVED" >&2
  exit 2
fi

rm -rf "$OUT_DIR_RESOLVED"
mkdir -p "$OUT_DIR_RESOLVED"
OUT_DIR="$OUT_DIR_RESOLVED"

for file in "${EXPORT_FILES_SORTED[@]}"; do
  mkdir -p "$OUT_DIR/$(dirname "$file")"
  cp "$file" "$OUT_DIR/$file"
done

# Required-path validation
for required in "${REQUIRED_PATHS[@]}"; do
  if [[ ! -e "$OUT_DIR/$required" ]]; then
    echo "error: required export path missing: $required" >&2
    exit 1
  fi
done

# Export metadata + checksums (minimal provenance for first slice)
git_sha="$(git rev-parse HEAD)"
created_at="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
source_repo="$(git remote get-url origin 2>/dev/null || git rev-parse --show-toplevel)"
manifest_for_meta="$MANIFEST"
if [[ "$MANIFEST" == "$ROOT_DIR/"* ]]; then
  manifest_for_meta="${MANIFEST#$ROOT_DIR/}"
elif [[ "$MANIFEST" == /* ]]; then
  manifest_for_meta="$(basename "$MANIFEST")"
fi
historical_private_origin="${HISTORICAL_PRIVATE_ORIGIN:-}"

historical_private_origin_line=""
if [[ -n "$historical_private_origin" ]]; then
  historical_private_origin_line=",
  \"historical_private_origin\": \"$historical_private_origin\""
fi

cat > "$OUT_DIR/PUBLIC_EXPORT_META.json" <<EOF
{
  "source_repo": "$source_repo",
  "source_commit": "$git_sha",
  "allowlist_manifest": "$manifest_for_meta",
  "generated_at_utc": "$created_at",
  "generator": "scripts/export-public.sh",
  "format_version": 1$historical_private_origin_line
}
EOF

(
  cd "$OUT_DIR"
  find . -type f ! -name 'SHA256SUMS' -print0 \
    | LC_ALL=C sort -z \
    | xargs -0 shasum -a 256 > SHA256SUMS
)

echo "Export complete: $OUT_DIR"
echo "Files exported: ${#EXPORT_FILES_SORTED[@]}"
