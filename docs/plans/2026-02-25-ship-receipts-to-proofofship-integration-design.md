# Ship-Receipts → Proofofship Integration Design

**Date:** 2026-02-25
**Author:** Campion (Claude Code)
**Status:** APPROVED

## Context

Ship-receipts is single player mode. Proofofship is MMO mode.

Ship-receipts produces local, portable receipts that prove a builder shipped something real.
Proofofship takes those receipts, runs a 6-stage verification pipeline, and publishes
publicly auditable reputation scores. The game loop keeps humans engaged; the verification
pipeline is the actual anti-slop filter.

The integration needs a clean interface so:
1. Local receipts cross to global without information loss
2. Proofofship can run its own verification independently
3. Seton (Claude Cowork) can build game mode UX from a single artifact

## Approach: Envelope Wraps Full Receipt

The proof envelope contains the complete original receipt verbatim, plus routing metadata
and an optional local score snapshot. This preserves full auditability — proofofship can
recompute everything from the embedded receipt without trusting any local computation.

### Why This Over Alternatives

- **vs. flattened ingestion payload:** Lossy. Proofofship can't reconstruct the original.
  Receipt schema changes break the mapping. Tight coupling.
- **vs. manifest + fetch:** Adds hosting/fetch complexity. Overkill for Phase 0.
- **Envelope wraps receipt:** No information loss, stable format as receipt schema evolves,
  idempotency via content_hash, single artifact for Seton to render from.

## Proof Envelope Schema (v1)

```
proof-envelope.v1
├── envelope_version: "1.0"
├── envelope_id: ULID
├── content_hash: "sha256:<hex>"    ← dedupe key
├── submitted_at: ISO 8601
├── actor
│   ├── github_username: string     ← required
│   ├── display_name: string
│   └── profile_urls: string[]
├── receipt: { ... full receipt ... } ← verbatim
├── local_score_snapshot             ← optional, informational only
│   ├── base_score: int
│   ├── final_score: int
│   ├── streak_days: int
│   ├── streak_multiplier: float
│   ├── integrity_multiplier: float
│   └── computed_at: ISO 8601
└── export_metadata
    ├── generator: string
    ├── generator_version: string
    └── ship_receipts_schema_version: string
```

Key: `content_hash` is the idempotency/dedupe key. `envelope_id` is for ordering/reference.
`local_score_snapshot` is never trusted by proofofship — it recomputes its own score.

## Receipt Event Schema (v1)

Events track lifecycle from local creation through global verification.

```
receipt-event.v1
├── event_id: ULID
├── event_type: enum
│   ├── receipt.created
│   ├── receipt.validated
│   ├── receipt.scored
│   ├── envelope.exported
│   ├── envelope.submitted
│   ├── envelope.accepted
│   ├── envelope.rejected
│   └── envelope.verified
├── content_hash: string
├── envelope_id: string (if applicable)
├── timestamp: ISO 8601
├── source: "local" | "global"
├── detail: object (event-specific)
└── actor: string
```

## Field Mapping: Local Receipt → Envelope

| Local Receipt Field | Envelope Field | Required | Notes |
|---|---|---|---|
| `subject.name` | `actor.display_name` | Yes | |
| `subject.profiles[kind=github].url` | `actor.github_username` | Yes | Extracted from URL |
| `subject.profiles` | `actor.profile_urls` | No | All profile URLs |
| `meta.content_hash` | `content_hash` | Yes | Must be valid sha256 |
| (generated) | `envelope_id` | Yes | ULID at export time |
| (generated) | `submitted_at` | Yes | ISO 8601 at export |
| (entire receipt) | `receipt` | Yes | Verbatim copy |
| (from game state) | `local_score_snapshot.*` | No | Current score/streak |
| `version` | `export_metadata.ship_receipts_schema_version` | Yes | "0.1" or "1.0" |

## Validation Order & Failure Codes

Export-time validation (before envelope leaves local):

| Order | Check | Failure Code | Behavior |
|---|---|---|---|
| 1 | Valid JSON | `E_PARSE` | Abort |
| 2 | Schema validates | `E_SCHEMA` | Abort |
| 3 | `meta.content_hash` present + valid | `E_HASH_MISSING` / `E_HASH_INVALID` | Abort |
| 4 | `subject.name` non-empty | `E_SUBJECT` | Abort |
| 5 | GitHub profile extractable | `E_NO_GITHUB` | Abort |
| 6 | At least 1 artifact with URL | `E_NO_ARTIFACT` | Abort |
| 7 | Not a known duplicate | `W_DUPLICATE` | Warn, allow with flag |

Proofofship-side uses its own 6-stage pipeline. No duplication.

## Privacy Boundaries

**Never leaves local:**
- `.ship-receipts/game-state.json`
- Streak break history
- Rejected receipt details
- Local file paths

**Crosses to global (in envelope):**
- Receipt content (builder chose to make this public)
- `local_score_snapshot` (informational, ignored for scoring)
- `content_hash` (public dedupe key)
- Actor identity (GitHub username + profiles)

Principle: The envelope adds no new private data beyond what the builder already put in the receipt.

## Versioning Strategy

- `envelope_version` independent of receipt version
- Receipt version in `export_metadata.ship_receipts_schema_version`
- Additive changes = minor bump (1.1, 1.2)
- Breaking changes = major bump (2.0) — avoid

## Seton UX Primitives

### Status Badges

| State | Badge | Color | Source Event |
|---|---|---|---|
| Draft | `DRAFT` | gray | receipt.created |
| Valid | `VALID` | blue | receipt.validated |
| Scored | `SCORED: {n}` | green | receipt.scored |
| Exported | `EXPORTED` | purple | envelope.exported |
| Submitted | `PENDING` | yellow | envelope.submitted |
| Accepted | `ACCEPTED` | green | envelope.accepted |
| Rejected | `REJECTED: {reason}` | red | envelope.rejected |
| Verified | `VERIFIED: {depth}` | gold | envelope.verified |

### Score Components

- Base score breakdown (proof primitive → points)
- Streak display (current days, multiplier, next threshold)
- Integrity badge (hash valid + checksum = gold shield)
- Global reputation score (from proofofship, when available)

### Verification Progress

```
[ ] Schema valid
[ ] Hash integrity
[ ] Identity confirmed
[ ] Artifact exists
[ ] Signature verified
[ ] Attestation received
```

Each maps to a verification pipeline stage. Render as progressive checklist.

## Future: Arxiv/Kaggle Tightening

Scoring heuristics and verification depth weights are placeholders. A future pass
will mine arxiv CS/math papers and kaggle datasets to ground the reputation model
in real bibliometric and quality signals. This design accommodates that by keeping
scoring separate from the envelope transport format.
