# Claude Cowork Handoff Packet v2 — Ship Receipts

**Date:** 2026-02-25
**Author:** Campion
**For:** Claude Cowork game mode integration

---

## What Ship Receipts Provides

Ship Receipts is the **local game loop** — a deterministic scoring engine that evaluates verifiable records of shipped work. It produces scores, streaks, and proof envelopes that feed into the global reputation ledger (proofofship).

---

## 1. States

### Receipt States

| State | Meaning | Transitions To |
|-------|---------|----------------|
| `VALIDATING` | Receipt is being checked against schema | REJECTED, SCORING |
| `SCORING` | Computing base score and multipliers | REJECTED, DUPLICATE, ACCEPTED |
| `ACCEPTED` | Scored and recorded in game state | (terminal) |
| `REJECTED` | Failed validation or hash check | (terminal) |
| `DUPLICATE` | Content hash already submitted | (terminal) |

### Streak States

| State | Meaning |
|-------|---------|
| `ACTIVE` | Builder has qualifying receipts on consecutive days |
| `BROKEN` | Gap in consecutive days detected |
| `INACTIVE` | No receipts submitted yet |

### Dispute States (per receipt)

| State | Meaning | Score Effect |
|-------|---------|-------------|
| `none` | No dispute | Full contribution |
| `flagged` | Under review | Frozen (0 contribution) |
| `upheld` | Receipt invalidated | Permanent 0 |
| `dismissed` | Dispute resolved in builder's favor | Full contribution restored |

---

## 2. Badges

Badges are visual indicators for the game UI. Not persisted — derived from game state on render.

| Badge | Condition | Icon Suggestion |
|-------|-----------|-----------------|
| First Ship | 1+ accepted receipt | anchor |
| Streak 3 | 3+ day streak active | flame-small |
| Streak 7 | 7+ day streak active | flame-medium |
| Streak 14 | 14+ day streak active | flame-large |
| Streak 30 | 30+ day streak active | fire |
| Integrity | At least one receipt with valid content_hash + checksum | shield-check |
| Deep Proof | Any receipt with base_score >= 20 | magnifying-glass |
| Centurion | Total score >= 100 | star |
| Export Ready | At least one proof envelope exported | send |

---

## 3. Score Components

### Base Score (per receipt)

| Component | Points | Source Field |
|-----------|--------|-------------|
| Subject name | 1 | `subject.name` |
| Subject profiles | 2 | `subject.profiles[]` (valid entries) |
| Created timestamp | 1 | `meta.created_at` |
| Content hash | 3 | `meta.content_hash` (only if valid) |
| Immutable ref | 2/artifact | `artifacts[].immutable_ref` |
| CI URL | 1/artifact | `artifacts[].ci_url` |
| Checksum | 3/verify entry | `verify[].kind == "checksum"` |
| Link | 1/verify entry | `verify[].kind == "link"` |
| Command | 2/verify entry | `verify[].kind == "command"` |
| Attestation | 2/verify entry | `verify[].kind == "attestation"` |
| Signal (each) | 1 | `signals.stars`, `signals.downloads_30d`, etc. |

### Multipliers

| Multiplier | Condition | Factor |
|------------|-----------|--------|
| Streak 3+ | 3 consecutive qualifying days | 1.25x |
| Streak 7+ | 7 consecutive qualifying days | 1.50x |
| Streak 14+ | 14 consecutive qualifying days | 1.75x |
| Streak 30+ | 30 consecutive qualifying days | 2.00x |
| Integrity | Valid hash + checksum verify | 1.50x |

### Formula

```
final_score = floor(base_score × streak_multiplier × integrity_multiplier)
```

### Anti-Slop

- Minimum base score to qualify for streak: **6 points**
- Content hash mismatch: **entire receipt rejected (score = 0)**
- Duplicate content hash: **score = 0**

---

## 4. Dispute / Resolution UX States

### Builder View

| State | What Builder Sees | Actions Available |
|-------|------------------|-------------------|
| Clean | Normal score display | Export, view breakdown |
| Flagged | "Under review" badge on receipt | Wait, provide evidence |
| Upheld | "Invalidated" badge, score zeroed | Appeal (future) |
| Dismissed | "Cleared" badge, score restored | Normal actions |

### Reviewer View (future)

| Action | Effect |
|--------|--------|
| Flag receipt | Sets dispute_status = flagged |
| Uphold dispute | Sets dispute_status = upheld, zeroes contribution |
| Dismiss dispute | Sets dispute_status = dismissed, restores contribution |

---

## 5. Stable vs Provisional

### Stable (safe to build on)

- Schema: `ship-receipts.v0.1.schema.json` — locked
- Proof envelope schema: `proof-envelope.v1.json` — locked
- Scoring formula: additive base + multiplicative streak/integrity — locked
- Content hash algorithm: SHA-256 of canonical JSON (sorted keys, compact) — locked
- Anti-slop threshold: 6 points minimum — locked
- State file format: `.ship-receipts/game-state.json` — locked

### Provisional (may change)

- Streak grace period: none in v1, may add 1-day grace in v2
- Maximum streak multiplier: capped at 2.0x, may adjust
- Dispute resolution process: manual only in v1
- Event retention: 1000 max, may adjust
- Confidence tier thresholds: may recalibrate
- Timezone handling for streaks: local timezone, may switch to UTC

### Not Yet Built

- CLI commands (`ship-receipts score`, `ship-receipts validate`, `ship-receipts export`)
- Schema validation via jsonschema (available in export script only)
- Proof envelope submission to proofofship API (manual curl for now)
- Multi-user state (currently single-user per state file)

---

## 6. Implementation Map

| Module | Path | Purpose |
|--------|------|---------|
| Scoring engine | `src/scoring/engine.py` | Base score, multipliers, confidence |
| Hash validator | `src/scoring/hash_validator.py` | Content hash computation + validation |
| Game state | `src/scoring/state.py` | Full pipeline, persistence, streaks |
| Envelope export | `src/envelope/export.py` | Receipt → proof envelope |
| Export script | `scripts/export_proof_envelope.py` | CLI wrapper for export |
| Smoke test | `scripts/smoke_integration.py` | E2E validation (16 checks) |
| Unit tests | `tests/test_scoring.py` | 40 scoring tests |
| State tests | `tests/test_state.py` | 12 pipeline tests |

### Test Status

- **52/52 unit tests pass**
- **16/16 smoke integration checks pass**

---

## 7. Quick Start for Cowork

```python
# Score a receipt
from src.scoring.state import GameState
from src.scoring.hash_validator import compute_content_hash

state = GameState(root_dir=".")
result = state.score_receipt(receipt)
state.save()
# result["status"] == "ACCEPTED" | "REJECTED" | "DUPLICATE"
# result["score"] == final integer score
# result["breakdown"] == {element: points, ...}

# Export to proofofship
from src.envelope.export import export_proof_envelope
envelope = export_proof_envelope(receipt, state.state)
# Submit envelope to proofofship API
```
