# Ship-Receipts → Proofofship Integration Spec v1

**Status:** DRAFT
**Date:** 2026-02-25
**Author:** Campion

---

## Overview

Ship-receipts is single player mode. Proofofship is MMO mode.

Ship-receipts produces local receipts proving a builder shipped something real.
Proofofship ingests those receipts, runs a 6-stage verification pipeline, and
publishes publicly auditable reputation scores.

The **proof envelope** is the interface between the two systems. It wraps a
complete local receipt verbatim, adds routing metadata, and optionally includes
a local score snapshot for UX purposes.

---

## Schemas

| Schema | Path | Purpose |
|--------|------|---------|
| Proof Envelope v1 | `schemas/proof-envelope.v1.json` | Wraps receipt for global submission |
| Receipt Event v1 | `schemas/receipt-event.v1.json` | Lifecycle events (local + global) |
| Ship Receipt v0.1 | `schema/ship-receipts.v0.1.schema.json` | Local receipt format |

---

## Field Mapping: Local Receipt → Proof Envelope

| Local Receipt Field | Envelope Field | Required | Notes |
|---|---|---|---|
| `subject.name` | `actor.display_name` | Yes | Direct copy |
| `subject.profiles[kind=github].url` | `actor.github_username` | Yes | Extract username from URL |
| `subject.profiles[*].url` | `actor.profile_urls` | No | All profile URLs |
| `meta.content_hash` | `content_hash` | Yes | Must be valid `sha256:<hex>` |
| _(generated)_ | `envelope_id` | Yes | ULID at export time |
| _(generated)_ | `submitted_at` | Yes | ISO 8601 at export |
| _(entire receipt)_ | `receipt` | Yes | Verbatim copy, no transformation |
| _(from game state)_ | `local_score_snapshot.*` | No | Current score and streak |
| `version` | `export_metadata.ship_receipts_schema_version` | Yes | `"0.1"` or `"1.0"` |

---

## Idempotency and Dedupe

**Dedupe key:** `content_hash` (SHA-256 of canonical receipt JSON).

Same content hash = same receipt. Proofofship rejects duplicates.

**Canonical JSON for hashing:**
1. Remove `meta.content_hash` if present
2. Sort keys alphabetically at every nesting level
3. Compact JSON (no whitespace)
4. UTF-8 encoding, no trailing newline
5. SHA-256 → `sha256:<hex>`

**`envelope_id`** is a ULID for ordering and reference. It is NOT the dedupe key.
Multiple envelopes can reference the same receipt (e.g., resubmission after rejection).

---

## Validation Order and Failure Codes

### Export-Time (Local, Before Envelope Leaves)

| Order | Check | Code | Behavior |
|---|---|---|---|
| 1 | Receipt is valid JSON | `E_PARSE` | Abort |
| 2 | Receipt passes schema validation | `E_SCHEMA` | Abort |
| 3 | `meta.content_hash` present | `E_HASH_MISSING` | Abort |
| 4 | `meta.content_hash` matches computed | `E_HASH_INVALID` | Abort |
| 5 | `subject.name` non-empty | `E_SUBJECT` | Abort |
| 6 | GitHub profile extractable from profiles | `E_NO_GITHUB` | Abort |
| 7 | At least 1 artifact with URL | `E_NO_ARTIFACT` | Abort |
| 8 | Not a known duplicate (local hash set) | `W_DUPLICATE` | Warn, allow with `--force` |

### Ingestion-Time (Global, Proofofship Pipeline)

Proofofship runs its own 6-stage verification pipeline. The envelope does NOT
duplicate this logic. Proofofship extracts `envelope.receipt` and validates
independently.

| Stage | Check | Gate Type |
|---|---|---|
| 1. Schema | Receipt conforms to expected schema | Required |
| 2. Dedup | `content_hash` not already in registry | Required |
| 3. Identity | `actor.github_username` matches OAuth session | Required |
| 4. Artifact | Commit exists, repo public, actor has push access | Required (scored) |
| 5. Signature | GPG/SSH signed commit | Optional (scored) |
| 6. Attestation | Another verified actor attests | Optional (scored) |

---

## Versioning Strategy

- `envelope_version` is independent of receipt version
- Receipt version tracked in `export_metadata.ship_receipts_schema_version`
- Proofofship accepts envelope versions it knows; rejects unknown with error
- **Additive changes** (new optional fields) = minor bump (1.1, 1.2)
- **Breaking changes** (new required fields, type changes) = major bump (2.0)
- Breaking changes should be avoided. Prefer additive-only evolution.

---

## Privacy Boundaries

### Never Leaves Local

- `.ship-receipts/game-state.json` (full history, events, known hashes)
- Streak break history and rejected receipt details
- Local file paths
- Any data not explicitly in the receipt

### Crosses to Global (In Envelope)

- Receipt content (subject, artifacts, verification entries)
- `local_score_snapshot` (informational, ignored for scoring)
- `content_hash` (public dedupe key)
- Actor identity (GitHub username + profiles)

**Principle:** If it is in the receipt, the builder already chose to make it
public. The envelope adds no new private data.

---

## Proofofship Scoreboard: Opt-In Only

The proofofship public scoreboard is completely opt-in. A builder can:

1. Submit receipts and build verified reputation without appearing on the scoreboard
2. Opt in to the scoreboard at any time
3. Opt out and remove their scoreboard listing

The canonical reputation ledger is separate from the scoreboard. Verified receipts
are always stored in the ledger for auditability, regardless of scoreboard preference.

---

## Example

See `examples/local-to-global-proof-example.v1.json` for a complete end-to-end
example showing:

1. A v0.1 receipt with rich proof primitives
2. The receipt wrapped in a proof envelope
3. Full event history from `receipt.created` through `envelope.verified`
4. Score breakdown documentation
