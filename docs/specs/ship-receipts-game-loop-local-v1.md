# Ship Receipts Game Loop (Local) v1

**Status:** DRAFT
**Date:** 2026-02-25
**Author:** Campion (spec pass)
**Scope:** Local game mode only. Global game mode belongs in proofofship.

---

## Overview

The local game loop scores a builder's receipts based on **proof depth**. More proofs, better proofs, higher score. No proofs, no score.

The loop is deterministic: same receipt always produces same score. No randomness, no hidden weights, no server calls.

---

## Core Principle: No Score Without Valid Receipt Proof

A receipt that validates against the schema but carries zero proof primitives scores **0**. This is the anti-slop rule. Volume without substance earns nothing.

---

## Actions

These are the things a builder does that the game loop recognizes.

| Action | Description | Trigger |
|--------|-------------|---------|
| `SUBMIT` | Submit a receipt for scoring | `ship-receipts score <file>` |
| `VALIDATE` | Validate a receipt (no scoring) | `ship-receipts validate <file>` |
| `STREAK_CHECK` | Query current streak status | `ship-receipts streak` |

---

## Scoring Model

### Base Points

Each receipt earns base points from proof primitive presence.

| Proof Element | Points | Condition |
|---------------|--------|-----------|
| `subject.name` present | 1 | Always required, always 1 |
| `subject.profiles[]` has entries | 2 | At least one profile with kind + url |
| `meta.created_at` present | 1 | ISO 8601 timestamp |
| `meta.content_hash` present and valid | 3 | SHA-256 matches computed hash |
| `artifacts[].immutable_ref` present | 2 per artifact | Commit SHA, digest, etc. |
| `artifacts[].ci_url` present | 1 per artifact | Any URL |
| `artifacts[].verify[]` has `checksum` | 3 per entry | algo + hash both present |
| `artifacts[].verify[]` has `link` | 1 per entry | URL present |
| `artifacts[].verify[]` has `command` | 2 per entry | Command string present |
| `artifacts[].verify[]` has `attestation` | 2 per entry | Attestation object present |
| `artifacts[].signals` has non-zero values | 1 per signal | dependents, downloads, stars, citations |

**Maximum base score per receipt:** Unbounded (scales with artifact count and proof depth), but practically 15-30 for a well-formed single-artifact receipt.

### Anti-Slop Rules

| Rule | Effect |
|------|--------|
| No proof primitives beyond required fields | Score = 0 |
| `meta.content_hash` present but invalid | Score = 0 (entire receipt untrusted) |
| Duplicate `content_hash` in local state | Score = 0 (already submitted) |
| `artifacts` array is empty | Fails validation; not scorable |

A receipt must earn **at least 5 base points** (beyond the mandatory `subject.name` point) to count toward streaks. This prevents gaming with minimal receipts.

### Streak Threshold

- Minimum base score to count toward a streak: **6 points**
- This means: name (1) + at least 5 points of real proof

---

## Streaks

A streak tracks consecutive calendar days with at least one qualifying receipt.

### Streak Rules

| Rule | Value |
|------|-------|
| Streak unit | Calendar day (local timezone) |
| Minimum receipts per day | 1 qualifying (score >= 6) |
| Streak break | Missing a calendar day |
| Streak grace period | None in v1 |
| Maximum streak | Unbounded |

### Streak State

```json
{
  "current_streak": 5,
  "longest_streak": 12,
  "last_qualifying_date": "2026-02-25",
  "streak_start_date": "2026-02-21"
}
```

---

## Multipliers

Multipliers reward sustained quality. They apply to **base score** of each receipt.

| Multiplier | Condition | Value |
|------------|-----------|-------|
| Streak 2+ days | 2 consecutive qualifying days | 1.10x |
| Streak 3+ days | 3 consecutive qualifying days | 1.25x |
| Streak 5+ days | 5 consecutive qualifying days (cap) | 1.5x |
| Integrity bonus | content_hash valid + at least one checksum verify | 1.5x |

Multipliers **stack multiplicatively**.

Example: 5-day streak (1.5x cap) + integrity bonus (1.5x) = 2.25x total multiplier.

---

## Penalty Model

Penalties discourage submitting garbage.

| Penalty | Trigger | Effect |
|---------|---------|--------|
| Invalid hash | `content_hash` doesn't match computed | Score = 0, receipt rejected |
| Schema failure | Receipt doesn't validate against v1 schema | Not scored, not recorded |
| Duplicate submission | Same `content_hash` already in state | Score = 0, warning emitted |
| Streak break | No qualifying receipt for a calendar day | Streak resets to 0, multiplier resets to 1.0x |

Penalties are **not punitive** (no negative scores). The worst outcome is 0 and a streak reset. This avoids discouraging builders who are learning the format.

---

## Score Formula

```text
final_score = floor(base_score * streak_multiplier * integrity_multiplier)
```

Where:
- `base_score` = sum of proof element points
- `streak_multiplier` = based on current streak length (see table)
- `integrity_multiplier` = 1.5 if integrity bonus applies, else 1.0
- `floor()` = always round down to integer

---

## Event Model

Events are the atomic state transitions in the game loop.

### Event Types

| Event | Payload | State Change |
|-------|---------|--------------|
| `receipt.submitted` | `{receipt_hash, score, breakdown}` | Add to history, update totals |
| `receipt.rejected` | `{receipt_hash, reason}` | Log rejection, no score change |
| `receipt.duplicate` | `{receipt_hash}` | Log duplicate, no score change |
| `streak.advanced` | `{new_length, date}` | Increment streak, update multiplier |
| `streak.broken` | `{previous_length, break_date}` | Reset streak, log previous |
| `score.recalculated` | `{old_total, new_total, reason}` | Update total (for corrections) |

### Event Schema

```json
{
  "id": "evt_<ulid>",
  "type": "receipt.submitted",
  "timestamp": "2026-02-25T14:30:00Z",
  "payload": {
    "receipt_hash": "sha256:abc123...",
    "score": 18,
    "breakdown": {
      "base": 12,
      "streak_multiplier": 1.5,
      "integrity_multiplier": 1.0
    }
  }
}
```

---

## State Transitions

```text
[No State] --submit--> [Validating]
[Validating] --schema_fail--> [Rejected]
[Validating] --schema_pass--> [Scoring]
[Scoring] --hash_invalid--> [Rejected]
[Scoring] --duplicate--> [Duplicate]
[Scoring] --scored--> [Accepted]
[Accepted] --streak_check--> [Streak Updated]
```

### State File

The game loop persists to a single JSON file: `.ship-receipts/game-state.json`

```json
{
  "version": "1",
  "subject": "BuilderName",
  "total_score": 142,
  "receipts_submitted": 12,
  "receipts_rejected": 1,
  "streak": {
    "current": 5,
    "longest": 12,
    "last_qualifying_date": "2026-02-25",
    "streak_start_date": "2026-02-21"
  },
  "history": [
    {
      "receipt_hash": "sha256:abc123...",
      "score": 18,
      "date": "2026-02-25",
      "breakdown": {
        "base": 12,
        "streak_multiplier": 1.5,
        "integrity_multiplier": 1.0
      }
    }
  ],
  "events": []
}
```

Events array is append-only. In v1, it can be truncated after 1000 entries (keep last 1000).

---

## Score Display

`ship-receipts score <file>` outputs:

```text
Receipt: my-project-receipt.json
Subject: BuilderName
Status:  ACCEPTED

  Base Score:          12
  Streak Multiplier:   1.5x (5-day streak cap)
  Integrity Bonus:     1.0x
  ─────────────────────
  Final Score:         18

  Proof Breakdown:
    subject.name           1
    subject.profiles       2
    meta.created_at        1
    meta.content_hash      3
    artifact[0].immutable  2
    artifact[0].ci_url     1
    artifact[0].checksum   3
                          ──
    Base Total            12

  Streak: 5 days (max multiplier reached: 1.5x)
  Total Score: 160 (12 receipts)
```

---

## What Cowork Needs Next

### To Build the Score Calculator

1. Implement the base scoring table as a pure function: `receipt -> base_score + breakdown`
2. Implement streak tracking: read state file, check dates, compute multiplier
3. Implement the anti-slop gate: if base_score < 6, do not advance streak
4. Implement the content_hash validator (see data model spec for hash algorithm)
5. Wire it together: validate -> score -> update state -> display

### Design Decisions Still Open

- **Timezone handling:** Should streaks use UTC or local timezone? Spec says local, but needs confirmation.
- **State file location:** `.ship-receipts/game-state.json` in CWD, or `~/.ship-receipts/`? Spec says CWD.
- **Event retention:** 1000 events max, or unbounded? Spec says 1000.
