# TypeScript Port Lane

This directory contains the in-progress TypeScript migration tracked by issue #27.

## Current modules
- `cli.ts` — command entrypoint (`validate`, `score`, `mint`, `export`, `streak`)
- [`calibration.ts`](./calibration.ts) — rolling agent calibration (Brier score) lookup from Rowan context-store JSONL
- `scoring/engine.ts` — score math + multipliers
- `scoring/hash-validator.ts` — canonical JSON + SHA-256 content hash
- `scoring/state.ts` — local state persistence and scoring pipeline
- `envelope/export.ts` — proof envelope export

## Test suite
- `tests-ts/` contains parity-oriented Vitest coverage for hash, engine, state, envelope, and CLI.

## Run in CI
- `npm ci`
- `npm test`

## Remaining parity work
See [`docs/plans/2026-03-02-ts-port-parity-checklist.md`](../docs/plans/2026-03-02-ts-port-parity-checklist.md).
