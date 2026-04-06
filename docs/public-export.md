# Public Export

This document defines the export path for generating a publish-safe tree from the current repository using an explicit allowlist.

## Files used

- `export/public-allowlist.yml` — source-of-truth include/required/exclude patterns
- `scripts/export-public.sh` — export tool with dry-run support

## Quick usage

```bash
# Build TS output first so dist/ is available to export
npm run build

# Dry-run (prints files that would be exported)
./scripts/export-public.sh --out /tmp/ship-receipts-public --dry-run

# Materialize export tree
./scripts/export-public.sh --out /tmp/ship-receipts-public
```

## Behavior

1. Reads allowlist patterns from `export/public-allowlist.yml`
2. Resolves matching files from git-tracked paths and generated artifacts in the working tree (for example `dist/**`)
3. Applies defensive excludes
4. In `--dry-run`, prints deterministic sorted file list and exits
5. In normal mode, writes the exported tree to `--out`
6. Emits:
   - `PUBLIC_EXPORT_META.json` (source commit + generator metadata)
   - `SHA256SUMS` (checksums for exported files)

## Current payload target

The allowlist is aligned to the TS npm package source:

- `src-ts/**`
- `dist/**`
- `schema/**` and `schemas/**`
- `examples/**`
- `package.json`
- `tsconfig.json`
- `vitest.config.ts`
- `README.md`
- `LICENSE`
- `CHANGELOG.md`

## Review checklist

Before publishing or reviewing an export artifact:

1. Run dry-run and inspect selected files
2. Generate export output
3. Inspect tree for accidental private artifacts
4. Validate `PUBLIC_EXPORT_META.json` source commit
5. Review `SHA256SUMS` generation
