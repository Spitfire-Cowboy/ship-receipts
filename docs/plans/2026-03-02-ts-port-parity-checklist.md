# TypeScript Port Parity Checklist (#27)

Date: 2026-03-02
Branch: `codex/issues-27-28-33-34-pickup`

## Goal
Track parity between Python runtime/tests and the in-progress TypeScript port.

## Implemented in TS
- `src-ts/scoring/hash-validator.ts`
- `src-ts/scoring/engine.ts`
- `src-ts/scoring/state.ts`
- `src-ts/envelope/export.ts`
- `src-ts/cli.ts` (`validate`, `score`, `export`, `streak`)
- npm scaffolding (`package.json`, `tsconfig.json`, `vitest.config.ts`)
- npm publish workflow (`.github/workflows/npm-publish.yml`)

## TS Tests Added
- `tests-ts/hash-validator.test.ts`
- `tests-ts/hash-fixtures.test.ts`
- `tests-ts/engine.test.ts`
- `tests-ts/state.test.ts`
- `tests-ts/envelope.test.ts`
- `tests-ts/cli.test.ts`

## Remaining for full #27 acceptance
- Port the full Python test corpus semantics (currently 60 Python tests) into Vitest equivalents.
- Run `npm test` and `npm run build` in CI and local once dependency install is explicitly approved.
- Decide lockfile strategy for deterministic installs (`package-lock.json` + `npm ci`) as a follow-up hardening step.
- Verify `npx ship-receipts score examples/ship-receipts.example.json` on built package.
- Add/verify TS smoke execution command (`npm run smoke:ts`) in CI once dependency install is approved.

## Notes
- Python test suite remains green while TS lane evolves (`python3 -m pytest tests/ -q`).
- No merges performed.
- No installs/model downloads performed in this session.
