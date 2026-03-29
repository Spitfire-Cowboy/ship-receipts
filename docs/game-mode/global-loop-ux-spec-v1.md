# Global Loop UX Spec v1

**Status:** DRAFT
**Date:** 2026-02-26
**Author:** Seton (Claude Cowork)
**Scope:** Proofofship integration — the opt-in global mode.

---

## Prerequisite

A receipt must be SCORED locally before it can enter the global loop. The global loop begins at export.

---

## Flow 1: Export Proof Envelope

```
Builder runs: ship-receipts export my-receipt.json

  ┌───────────────────────────────────────┐
  │  Export Pre-flight:                   │
  │                                       │
  │  ✓ Receipt is valid JSON              │
  │  ✓ Schema passes                      │
  │  ✓ content_hash present               │
  │  ✓ content_hash matches computed      │
  │  ✓ subject.name non-empty             │
  │  ✓ GitHub profile found in profiles   │
  │  ✓ At least 1 artifact with URL       │
  │  ✓ Not a known duplicate              │
  │                                       │
  │  Proof Envelope generated:            │
  │  → envelopes/01JMFG...7Y2D.json      │
  │                                       │
  │  Badge: EXPORTED (purple)             │
  │                                       │
  │  Ready to submit to proofofship.      │
  │  Run: ship-receipts submit <envelope> │
  └───────────────────────────────────────┘
```

### Export Validation Checks (ordered)

| # | Check | Failure Code | Behavior |
|---|-------|-------------|----------|
| 1 | Valid JSON | `E_PARSE` | Abort |
| 2 | Schema valid | `E_SCHEMA` | Abort |
| 3 | `content_hash` present | `E_HASH_MISSING` | Abort |
| 4 | `content_hash` matches | `E_HASH_INVALID` | Abort |
| 5 | `subject.name` non-empty | `E_SUBJECT` | Abort |
| 6 | GitHub profile extractable | `E_NO_GITHUB` | Abort |
| 7 | At least 1 artifact with URL | `E_NO_ARTIFACT` | Abort |
| 8 | Not a local duplicate | `W_DUPLICATE` | Warn, allow with `--force` |

### Envelope Contents

The proof envelope wraps the receipt verbatim and adds:

- `envelope_id` — ULID generated at export
- `content_hash` — copied from receipt meta
- `actor` — extracted from subject (github_username, display_name, profile_urls)
- `local_score_snapshot` — informational only, not used for global scoring
- `export_metadata` — generator info, schema version

---

## Flow 2: Submit to Proofofship

```
Builder runs: ship-receipts submit envelopes/01JMFG...7Y2D.json

  ┌───────────────────────────────────────┐
  │  Submitting to proofofship...         │
  │                                       │
  │  ✓ Envelope uploaded                  │
  │  ✓ Acknowledged by pipeline           │
  │                                       │
  │  Badge: PENDING (yellow)              │
  │                                       │
  │  Your receipt is now in the           │
  │  verification queue. Check status:    │
  │  ship-receipts status <envelope_id>   │
  └───────────────────────────────────────┘
```

**Note:** This is the only network call in the entire system. It is explicitly opt-in. The builder chooses to go public.

---

## Flow 3: Verification Progress

```
Builder runs: ship-receipts status 01JMFG...7Y2D

  ┌───────────────────────────────────────┐
  │  Envelope: 01JMFGHT5V4KXRB9NW...     │
  │  Receipt:  proof-engine v0.3.0        │
  │                                       │
  │  Verification Pipeline:               │
  │                                       │
  │  [✓] Schema valid                     │
  │  [✓] Hash integrity (dedup passed)    │
  │  [✓] Identity confirmed              │
  │  [✓] Artifact exists                  │
  │  [✓] Signature verified              │
  │  [ ] Attestation received             │
  │                                       │
  │  Depth: 0.83 ████████████████░░░ 83%  │
  │                                       │
  │  Badge: VERIFIED (gold)               │
  │  Verification depth: 0.83             │
  └───────────────────────────────────────┘
```

### Verification Stages

| Stage | What It Checks | Gate |
|-------|---------------|------|
| 1. Schema | Receipt conforms to expected schema | Required |
| 2. Dedup | `content_hash` not already in registry | Required |
| 3. Identity | `github_username` matches OAuth session | Required |
| 4. Artifact | Commit exists, repo public, actor has push access | Required (scored) |
| 5. Signature | GPG/SSH signed commit | Optional (scored) |
| 6. Attestation | Another verified actor attests to the work | Optional (scored) |

Stages 1-3 are pass/fail gates. Stages 4-6 contribute to `verification_depth` (0.0-1.0).

### Verification Outcomes

| Outcome | Badge | Color | UX |
|---------|-------|-------|-----|
| All required pass, some optional | VERIFIED | Gold | Show depth score and completed stages |
| All 6 pass | VERIFIED (FULL) | Gold + sparkle | Maximum prestige |
| Required stage fails | REJECTED | Red | Show which stage failed and `detail.reason` |
| Still processing | PENDING | Yellow | Show progress, stages completed so far |

---

## Flow 4: Rejection Handling

```
  ┌───────────────────────────────────────┐
  │  Envelope: 01JMFGHT5V4KXRB9NW...     │
  │  Receipt:  proof-engine v0.3.0        │
  │                                       │
  │  Badge: REJECTED (red)                │
  │                                       │
  │  Stage failed: Identity               │
  │  Reason: "GitHub username 'Pro777'    │
  │  does not match authenticated user"   │
  │                                       │
  │  This receipt cannot be resubmitted   │
  │  with the same content_hash.          │
  │  Fix the issue and create a new       │
  │  receipt to try again.                │
  └───────────────────────────────────────┘
```

**Rejection is informative, not punitive.** Show what failed, why, and what the builder can do about it. No negative scoring.

---

## Global State Machine

```
  ┌──────────┐     ┌──────────┐     ┌──────────┐
  │ EXPORTED ├────►│ PENDING  ├────►│ ACCEPTED │
  │ (purple) │     │ (yellow) │     │ (green)  │
  └──────────┘     └────┬─────┘     └────┬─────┘
                        │                 │
                   ┌────▼─────┐     ┌────▼─────┐
                   │ REJECTED │     │ VERIFIED │
                   │ (red)    │     │ (gold)   │
                   └──────────┘     └──────────┘
```

A receipt can be rejected at PENDING or ACCEPTED stage. Once VERIFIED, it's canonical.

---

## Scoreboard (Opt-In)

The proofofship public scoreboard shows verified builders ranked by:

1. Total verified score (sum of all verified receipt scores, as computed by proofofship)
2. Verification depth (average across receipts)
3. Streak consistency

**Opt-in rules:**
- Builder must explicitly choose to appear on scoreboard
- Can opt out at any time (removes listing, not verified receipts)
- Verified receipts remain in the canonical ledger regardless of scoreboard preference

**Display:**

```
  ┌──────────────────────────────────────────────┐
  │  PROOFOFSHIP SCOREBOARD                      │
  │                                              │
  │  #1  torvalds    1,247 pts  depth: 0.95      │
  │  #2  DHH           892 pts  depth: 0.88      │
  │  #3  Pro777        184 pts  depth: 0.83      │
  │  ...                                         │
  │                                              │
  │  Your rank: #3 of 42 verified builders       │
  │  [Opt out of scoreboard]                     │
  └──────────────────────────────────────────────┘
```

---

## Privacy Boundaries

### Never Crosses to Global

- `.ship-receipts/game-state.json` (full local history)
- Streak break details
- Rejected receipt details
- Local file paths
- Party member data
- Any data not in the receipt

### Crosses to Global (in Envelope)

- Receipt content (what the builder chose to put in it)
- `local_score_snapshot` (informational, ignored by proofofship for scoring)
- `content_hash` (public dedupe key)
- Actor identity (GitHub username + profile URLs)

**Principle:** The builder already chose to make receipt content public by writing it. The envelope adds no new private data.

---

## Anti-Slop Rules (Global)

1. **Proofofship scores independently.** Local scores are informational only. The global pipeline re-validates everything.
2. **No verified badge without pipeline pass.** A local SCORED receipt that fails global verification gets REJECTED, not VERIFIED.
3. **Duplicate submissions rejected.** Same `content_hash` = same receipt = already in registry.
4. **Identity must match.** `github_username` in envelope must match the authenticated user submitting it.
5. **Attestation is opt-in bonus.** Not required, but adds verification depth and prestige.
