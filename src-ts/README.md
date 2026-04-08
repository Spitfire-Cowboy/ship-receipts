# TypeScript Port Lane

This directory contains the TypeScript CLI implementation for `ship-receipts`.

## Current modules
- `cli.ts` — command entrypoint (`init`, `validate`, `verify`, `score`, `mint`, `export`, `render`, `daily`, `simulate`, `runway build`, `runway preview`)
- [`calibration.ts`](./calibration.ts) — rolling agent calibration (Brier score) lookup from Rowan context-store JSONL
- [`runway.ts`](./runway.ts) — static runway viewer export and local preview server for `ship-receipt/v1` feeds
- `scoring/engine.ts` — score math + multipliers
- `scoring/hash-validator.ts` — canonical JSON + SHA-256 content hash
- `scoring/state.ts` — local state persistence and scoring pipeline
- `envelope/export.ts` — proof envelope export

## Test suite
- `tests-ts/` contains parity-oriented Vitest coverage for hash, engine, state, envelope, and CLI.

## Run in CI
- `npm ci`
- `npm test`
- `npm run check:public-export`
- `npm run check:examples`
- `npm run pack:dry-run`

## Useful local demo scripts
- `npm run runway:build` — build a runway from this repo's git history
- `npm run runway:preview` — preview that git-derived runway locally
- `npm run runway:examples` — build a runway from the checked-in public examples
- `npm run runway:examples:preview` — preview the examples-based runway locally

## Reference docs
- [`docs/plans/2026-03-02-ts-port-parity-checklist.md`](../docs/plans/2026-03-02-ts-port-parity-checklist.md)
- [`README.md`](../README.md)
