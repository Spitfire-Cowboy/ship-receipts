# Ship Receipts Roadmap v1

**Status:** DRAFT
**Date:** 2026-02-25
**Author:** Campion (spec pass)

---

## Phase Overview

| Phase | Name | Scope | Depends On |
|-------|------|-------|------------|
| 0 | Schema v1 | Update schema, create v1 example, canonical hash | Nothing |
| 1 | CLI Foundation | `validate` + `init` commands | Phase 0 |
| 2 | Local Game Loop | `score` + `streak` commands, state file | Phase 1 |
| 3 | Polish | Error messages, docs, edge cases | Phase 2 |
| 4 | Integration Prep | Proofofship handoff, global game design | Phase 3 |

---

## Phase 0: Schema v1

**Goal:** Receipt schema v1 exists, validates, and hashes deterministically.

### Deliverables

- [ ] `schema/ship-receipts.v1.schema.json` — New schema file (v0.1 untouched)
- [ ] `examples/ship-receipts.v1.example.json` — V1 example with `meta` block
- [ ] `examples/ship-receipts.v1.scored.example.json` — Example with rich proofs (for score testing)
- [ ] Canonical hash test vectors — 3+ known-input/known-output pairs
- [ ] V0.1 backwards compat test — Existing example validates against v1 schema

### Risks

- Canonical JSON serialization varies by language. Pin the spec tightly.
- `additionalProperties: true` makes strict validation tricky. Decide if v1 tightens this.

### Exit Criteria

A v0.1 receipt validates against v1 schema. A v1 receipt with `meta.content_hash` can be verified by hand (hash the canonical form, compare).

---

## Phase 1: CLI Foundation

**Goal:** Create and validate receipts from the command line.

### Deliverables

- [ ] CLI binary with `init` and `validate` commands
- [ ] `ship-receipts init` generates valid v1 receipt (interactive + flags)
- [ ] `ship-receipts validate` checks schema + optional hash verification
- [ ] JSON output mode (`--json`) for both commands
- [ ] Unit tests for validation logic
- [ ] Unit tests for canonical hash computation

### Risks

- CLI framework choice affects maintenance burden. Keep deps minimal.
- Interactive prompts need to work in both terminal and piped contexts.

### Exit Criteria

`ship-receipts init | ship-receipts validate --strict` exits 0. Round-trip works.

---

## Phase 2: Local Game Loop

**Goal:** Score receipts, track streaks, maintain local state.

### Deliverables

- [ ] `ship-receipts score` with full scoring model
- [ ] `ship-receipts streak` with streak display
- [ ] `.ship-receipts/game-state.json` state file
- [ ] Anti-slop enforcement (score < 6 = no streak credit)
- [ ] Duplicate detection via `known_hashes`
- [ ] Event log (append-only in state file)
- [ ] Score display with breakdown

### Risks

- State file corruption (crash during write). Use atomic write (write to temp, rename).
- Timezone handling for streaks. Spec says local timezone. Document this clearly.
- Date boundary edge cases (receipt at 11:59 PM vs 12:01 AM).

### Exit Criteria

Score 3 receipts across 3 days. Streak shows 3. Multiplier shows 1.25x. Submit a duplicate, get rejected. Submit a no-proof receipt, get score 0.

---

## Phase 3: Polish

**Goal:** Production-quality CLI with good errors and docs.

### Deliverables

- [ ] Error messages with hints (see API contract spec)
- [ ] `--help` text for all commands
- [ ] Updated README with CLI usage examples
- [ ] Updated CHANGELOG
- [ ] Edge case tests (empty artifacts, unicode names, large receipts)
- [ ] Performance check (1000 receipts in state file, score command < 1s)

### Risks

- Scope creep. This phase is about finishing, not adding features.

### Exit Criteria

A new user can install, create a receipt, score it, and understand the output without reading source code.

---

## Phase 4: Integration Prep (Design Only)

**Goal:** Design the bridge to proofofship global game mode. No implementation.

### Deliverables

- [ ] Design doc: how receipts move from local to proofofship
- [ ] Design doc: global game loop scoring model
- [ ] Design doc: identity verification strategy
- [ ] Design doc: abuse prevention at scale
- [ ] API sketch for `ship-receipts push` command

### Risks

- Designing too much before local game is proven. Keep this phase lightweight.
- Proofofship architecture may not be ready. That's fine; this is a one-way spec.

### Exit Criteria

A design doc exists that Campion can review for soundness. No code.

---

## Risks and Mitigations (Cross-Phase)

| Risk | Phase | Likelihood | Impact | Mitigation |
|------|-------|-----------|--------|------------|
| Schema changes break v0.1 compat | 0 | Low | High | Automated compat test in CI |
| Hash non-determinism across platforms | 0-1 | Medium | High | Pin canonical JSON spec + test vectors |
| Game loop incentivizes spam | 2 | High | Medium | Anti-slop rules baked into scoring |
| State file grows unbounded | 2 | Medium | Low | Cap events at 1000; history is summary only |
| CLI framework becomes unmaintained | 1 | Low | Medium | Pick mature, minimal framework |
| Nobody uses it | 3-4 | Medium | High | Not a technical risk. Ship it and see. |

---

## Abuse Vectors (Expanded)

| Vector | Phase Affected | Detection | Response |
|--------|---------------|-----------|----------|
| **Spam receipts** — Submit hundreds of trivial receipts | 2 | Anti-slop rule (score < 6 = no streak) | Low-quality receipts waste builder time, not system resources |
| **Fake proofs** — URLs that don't resolve | 2 | V1: not detected. V2: URL resolution | Accept in v1. Score based on proof presence, not validity |
| **Timestamp gaming** — Backdate receipts for streaks | 2 | Local game trusts local clock | Acceptable for local. Global game uses server timestamps |
| **Receipt cloning** — Copy someone's receipt, change subject | 2 | Hash includes all fields; different subject = different hash | Cloned receipt scores normally. Not a problem until global game |
| **State file tampering** — Edit game-state.json directly | 2 | No detection in v1 | Local game is honor system. Global game doesn't trust local state |
| **Content hash spoofing** — Claim wrong hash | 0-1 | `validate --strict` catches it | Receipt rejected, score 0 |

---

## Timeline Estimate

Not providing time estimates per instructions. Phases are sequential. Each phase's exit criteria must be met before starting the next.

---

## What Cowork Needs Next

### Immediate (Phase 0)

1. Create `schema/ship-receipts.v1.schema.json` from the data model spec
2. Create v1 example receipts (basic + rich proof)
3. Implement canonical hash function + test vectors
4. Verify v0.1 example validates against v1 schema

### After Phase 0 Review

1. Pick CLI language and framework (send rationale to Campion for review)
2. Implement `validate` command
3. Implement `init` command
4. Wire up CI to run tests on PR

### After Phase 1 Review

1. Implement scoring function (pure function, no state)
2. Implement state file management
3. Implement `score` command
4. Implement `streak` command

### Standing Request

- Send each phase deliverable for Campion review before starting next phase
- File issues for anything that feels underspecified
- If a spec decision feels wrong during implementation, flag it rather than silently deviating
