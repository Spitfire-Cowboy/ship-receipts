# Ship Receipts MVP Spec v1

**Status:** DRAFT
**Date:** 2026-02-25
**Author:** Campion (spec pass)
**Audience:** Cowork (Seton), future contributors

---

## Product Intent

Ship Receipts is the **format layer** for verifiable records of shipped work.

The MVP answers one question: **Can a builder produce a receipt that a machine can verify and a game loop can score?**

Everything flows from that. If a receipt can be created, validated, hashed, and scored locally, the format is real. If not, it's vaporware.

### What MVP Ships

1. Receipt schema v1 with proof primitives (provenance, integrity, ship)
2. Local CLI commands: `init`, `validate`, `score`
3. Local game loop that scores receipts against proof quality
4. JSON-based state file for streaks, scores, history

### What MVP Does NOT Ship

- No server, no API, no database
- No global leaderboard (that's proofofship territory)
- No authentication or identity verification
- No blockchain, no smart contracts, no tokens
- No social features (follows, comments, reactions)
- No CI/CD integrations (receipts reference CI, they don't run it)
- No receipt hosting or rendering (proofofship.com handles that)

---

## Non-Goals

| Non-Goal | Reason |
|----------|--------|
| Replace GitHub profiles | Receipts complement, not replace |
| Automated verification execution | V1 records proofs, doesn't run them |
| Cross-builder comparison | Local game only; global is proofofship |
| AI-generated receipt detection | Out of scope for format layer |
| Payment or monetization | Not a product, it's a protocol |

---

## Actor Model

Four roles interact with ship-receipts. A single human or agent may hold multiple roles.

### Builder

The entity that ships work and creates receipts.

- Creates receipts via `init`
- Attaches proof primitives (provenance, integrity, ship)
- Submits receipts for validation
- Earns score in local game loop

### Reviewer

A human or agent that inspects a receipt for quality.

- Reads receipt JSON
- Checks proof links resolve
- Validates schema conformance
- May annotate receipts with `note` verification entries

### Verifier

A machine process that checks proof primitives.

- Validates schema against JSON Schema
- Checks integrity proofs (hash matches content)
- Checks provenance fields are present and well-formed
- Checks ship proof links are syntactically valid URLs
- Does NOT follow links or execute commands in v1

### Orchestrator

The game loop engine (local CLI in v1, proofofship in future).

- Accepts validated receipts
- Computes scores based on proof depth
- Tracks streaks and multipliers
- Enforces anti-slop rules
- Maintains local state file

---

## Proof Primitives

Every receipt can carry three types of proof. Each adds scoring weight.

### Provenance Proof (who / what / where)

Establishes identity and context of the claim.

- **Required:** `subject.name`
- **Scored:** `subject.profiles[]` with resolvable URLs
- **Scored:** `artifacts[].kind` matches actual artifact type
- **Scored:** Timestamp present (`meta.created_at`)

### Integrity Proof (hash / tamper detection)

Establishes the receipt hasn't been altered after creation.

- **Required:** `meta.content_hash` (SHA-256 of canonical receipt JSON, excluding `meta.content_hash` itself)
- **Scored:** `artifacts[].immutable_ref` present (commit SHA, package digest)
- **Scored:** `artifacts[].verify[]` contains `checksum` entry with algo + hash

### Ship Proof (origin push / verifiable links)

Establishes the artifact actually exists and was shipped.

- **Required:** `artifacts[].url` is a syntactically valid URL
- **Scored:** `artifacts[].ci_url` present
- **Scored:** `artifacts[].verify[]` contains `link` or `command` entry
- **Scored:** `artifacts[].signals` present with non-zero values

---

## Acceptance Criteria

### Must Have (P0)

- [ ] `ship-receipts init` generates a valid v1 receipt from interactive prompts or flags
- [ ] `ship-receipts validate <file>` returns pass/fail with specific error messages
- [ ] `ship-receipts score <file>` returns a numeric score with breakdown
- [ ] Receipt schema v1 is backwards-compatible with v0.1 (all v0.1 receipts validate)
- [ ] Content hash is deterministic (same input = same hash, always)
- [ ] Anti-slop: receipt with zero proof primitives scores 0
- [ ] Local state file tracks score history per subject

### Should Have (P1)

- [ ] `ship-receipts streak` shows current streak info
- [ ] Penalty applied for receipts that fail validation after submission
- [ ] Human-readable score breakdown (not just a number)
- [ ] Schema published to `proofofship.com/schemas/`

### Nice to Have (P2)

- [ ] `ship-receipts render` outputs markdown summary
- [ ] Batch validation of multiple receipts
- [ ] Score comparison between two time periods

---

## Measurable KPIs

| KPI | Target | Measurement |
|-----|--------|-------------|
| Time to first receipt | < 2 minutes | From `init` to valid JSON |
| Validation accuracy | 100% | No false positives on schema check |
| Score determinism | 100% | Same receipt = same score, always |
| Backwards compat | 100% | All v0.1 examples validate against v1 |
| CLI binary size | < 5 MB | Single binary, no runtime deps |

---

## Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Schema bloat from proof fields | Medium | High | Proof fields are optional; v0.1 compat maintained |
| Game loop incentivizes spam receipts | High | Medium | Anti-slop rules; minimum proof threshold |
| Hash collisions on truncated content | Low | High | Use full SHA-256, no truncation |
| Scope creep into proofofship territory | Medium | High | Hard boundary: no server, no global state |
| Receipt forgery (fake proofs) | Medium | Medium | V1 accepts this; automated verification is v2 |

---

## Abuse Vectors

| Vector | Description | V1 Response |
|--------|-------------|-------------|
| Spam receipts | Flood local state with trivial receipts | Anti-slop: no score without proof |
| Self-referential proofs | Receipt links to itself as verification | Schema allows it; game loop scores it low |
| Phantom artifacts | URL points to non-existent resource | V1 doesn't resolve URLs; v2 will |
| Timestamp manipulation | Backdated receipts for streak gaming | Local game trusts local clock; global game uses server time |
| Copy-paste receipts | Duplicate someone else's receipt | Content hash includes subject.name; duplicates score 0 on hash collision |

---

## What Cowork Needs Next

This section is the explicit handoff packet for Seton/Cowork.

### Immediately Actionable

1. **Receipt creation flow** — Build the `init` command that walks a user through creating a receipt. Reference `docs/specs/ship-receipts-api-contract-v1.md` for the exact interface.

2. **Validation logic** — Implement schema validation against `ship-receipts.v1.schema.json`. The schema spec is in `docs/specs/ship-receipts-data-model-v1.md`.

3. **Score calculator** — Implement the scoring function from `docs/specs/ship-receipts-game-loop-local-v1.md`. This is pure function: receipt in, score out.

### Needs Campion Review Before Building

4. **State file format** — The local game state file format needs a schema. Draft it, send for review.

5. **CLI framework choice** — Pick a CLI framework (Node.js with Commander, Rust with Clap, Go with Cobra). Send rationale for review.

### Blocked Until Proofofship

6. **Global game loop** — Scoring across builders requires proofofship.com. Not in scope.

7. **Receipt hosting** — Where receipts live publicly. Proofofship concern.

8. **Identity verification** — Proving `subject.name` is who they say. Proofofship concern.
