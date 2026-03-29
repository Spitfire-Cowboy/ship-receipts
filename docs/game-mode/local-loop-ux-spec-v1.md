# Local Loop UX Spec v1

**Status:** DRAFT
**Date:** 2026-02-26
**Author:** Seton (Claude Cowork)
**Scope:** Single-player mode only. Everything runs locally.

---

## Player Actions

Five actions a builder can take in the local loop:

| Action | Command | What Happens |
|--------|---------|-------------|
| Create | `ship-receipts init` | Scaffold a new receipt from prompts |
| Validate | `ship-receipts validate <file>` | Schema + hash check, no scoring |
| Score | `ship-receipts score <file>` | Validate, score, update state |
| Streak | `ship-receipts streak` | Show current streak status |
| Party | `ship-receipts party` | Manage party members, view roster |

---

## Flow 1: Receipt Creation

```
Builder runs: ship-receipts init

  ┌─────────────────────────────────────┐
  │  What did you ship?                 │
  │  > proof-engine v0.3.0              │
  ├─────────────────────────────────────┤
  │  Artifact URL?                      │
  │  > https://github.com/Pro777/...    │
  ├─────────────────────────────────────┤
  │  Commit SHA? (optional)             │
  │  > abc123def456...                  │
  ├─────────────────────────────────────┤
  │  CI URL? (optional)                 │
  │  > https://github.com/.../runs/123  │
  ├─────────────────────────────────────┤
  │  Add verification? (y/n)            │
  │  > y → [checksum / link / command]  │
  └─────────────────────────────────────┘

  Output: receipts/proof-engine-2026-02-26.json
  Badge: DRAFT (gray)
```

**UX notes:**
- Prompts are forgiving. Only `name`, `artifact.kind`, `artifact.name`, `artifact.url` are required.
- Each optional field adds proof depth and points. Show the builder what they'll earn: "Adding a commit SHA is worth +2 points."
- Auto-compute `meta.content_hash` at creation time.
- Auto-set `meta.created_at` to current ISO 8601 timestamp.

---

## Flow 2: Validation

```
Builder runs: ship-receipts validate my-receipt.json

  ┌───────────────────────────────┐
  │  ✓ Valid JSON                 │
  │  ✓ Schema passes (v1.0)      │
  │  ✓ content_hash matches      │
  │  ✓ 1 artifact with URL       │
  │                               │
  │  Status: VALID                │
  │  Badge: VALID (blue)          │
  └───────────────────────────────┘
```

**Failure states:**

| Failure | Display | Badge |
|---------|---------|-------|
| Invalid JSON | `✗ Parse error at line 12` | — |
| Schema fail | `✗ Missing required: artifacts[0].kind` | — |
| Hash mismatch | `✗ content_hash does not match computed` | — |
| No artifacts | `✗ artifacts array is empty` | — |

---

## Flow 3: Scoring

```
Builder runs: ship-receipts score my-receipt.json

  ┌─────────────────────────────────────┐
  │  Receipt: proof-engine-2026-02-26   │
  │  Subject: Pro777                    │
  │  Status:  SCORED                    │
  │                                     │
  │  Proof Breakdown:                   │
  │    ✓ subject.name           1 pt    │
  │    ✓ subject.profiles       2 pts   │
  │    ✓ meta.created_at        1 pt    │
  │    ✓ meta.content_hash      3 pts   │
  │    ✓ artifact.immutable_ref 2 pts   │
  │    ✓ artifact.ci_url        1 pt    │
  │    ✓ verify[checksum]       3 pts   │
  │    ✓ verify[link]           1 pt    │
  │    ✓ verify[command]        2 pts   │
  │    ✓ signals (3 non-zero)   3 pts   │
  │    ─ verify[attestation]    0 pts   │
  │                            ────     │
  │    Base Total:             19 pts   │
  │                                     │
  │  Multipliers:                       │
  │    🔥 Streak: 8 days       × 1.5   │
  │    🛡️  Integrity: verified  × 1.5   │
  │                                     │
  │  ═══════════════════════════════     │
  │  Final Score:              42 pts   │
  │  ═══════════════════════════════     │
  │                                     │
  │  Total: 184 pts (13 receipts)       │
  │  Streak: 8 days → next: 1.75x @ 14 │
  │  Badge: SCORED (green)              │
  └─────────────────────────────────────┘
```

**Key UX decisions:**
- Show every proof element as a checklist line. Green check for present, gray dash for absent.
- Show point value for each element.
- Show multipliers separately so the builder understands what drives score.
- Show distance to next multiplier tier ("6 days to 1.75x").
- Update game state immediately.

---

## Flow 4: Streak Display

```
Builder runs: ship-receipts streak

  ┌───────────────────────────────────┐
  │  🔥 Current Streak: 8 days       │
  │  📈 Multiplier: 1.5x             │
  │  🎯 Next tier: 1.75x in 6 days   │
  │  🏆 Longest streak: 12 days      │
  │                                   │
  │  This Week:                       │
  │  M  T  W  T  F  S  S             │
  │  ■  ■  ■  ■  ■  □  □             │
  │  18 22 15 27 42  -  -             │
  │                                   │
  │  Qualifying threshold: 6 pts      │
  └───────────────────────────────────┘
```

**Rules:**
- A day qualifies with at least one receipt scoring >= 6 base points.
- Streak breaks on any missed calendar day (local timezone).
- No grace period in v1.
- Show weekly grid with daily scores.

---

## Flow 5: Party Mode

### Add to Party

```
Builder runs: ship-receipts party add torvalds

  ┌───────────────────────────────────┐
  │  Fetching GitHub profile...       │
  │                                   │
  │  ┌─────────────────────────────┐  │
  │  │  🧙 torvalds                │  │
  │  │  Repos: 7   Stars: 186k    │  │
  │  │  Since: 2011                │  │
  │  │  Top: linux, subsurface     │  │
  │  │  Class: LEGENDARY           │  │
  │  └─────────────────────────────┘  │
  │                                   │
  │  Added to party!                  │
  │  Party: [Pro777, torvalds]        │
  └───────────────────────────────────┘
```

**Bootstrap rules:**
- One-time fetch of public GH data (repos, stars, contribution count).
- Snapshot stored in `game-state.json` under `party[]`.
- No subsequent API calls. Character develops through local play only.
- Character "class" derived from snapshot (see class table below).

### Character Classes (from GH snapshot)

| Class | Condition | Icon Idea |
|-------|-----------|-----------|
| ROOKIE | < 5 repos, < 50 stars | 🌱 |
| BUILDER | 5-20 repos, < 500 stars | 🔨 |
| ARCHITECT | 20-50 repos or 500-5k stars | 🏗️ |
| VETERAN | 50+ repos or 5k-50k stars | ⚔️ |
| LEGENDARY | 50k+ stars or 100+ repos | 🧙 |

### Party Roster

```
Builder runs: ship-receipts party

  ┌──────────────────────────────────────────┐
  │  YOUR PARTY                              │
  │                                          │
  │  #1 🔨 Pro777        142 pts  🔥 8d     │
  │  #2 🧙 torvalds        0 pts  —         │
  │  #3 🏗️ DHH              0 pts  —         │
  │  #4 🔨 defunkt          0 pts  —         │
  │                                          │
  │  Party members earn points when you      │
  │  submit receipts on their behalf.        │
  └──────────────────────────────────────────┘
```

**How party members score:**
- Only the primary character (Pro777) creates real receipts.
- Party members can have receipts attributed to them for friendly competition.
- Or: party members serve as aspirational benchmarks (their GH snapshot implies "what they would score").
- v1 decision: party members start at 0 and the builder can create receipts attributed to any party member.

### Party Leaderboard

Rank party members by total score. Ties broken by streak length, then by join date.

---

## Feedback Loops

| Trigger | Feedback | Emotional Target |
|---------|----------|-----------------|
| First receipt created | "Your first receipt! Score it to earn points." | Welcome, curiosity |
| Score > 0 | Score breakdown with checkmarks | Achievement |
| Score = 0 | "No proof primitives found. Add verification to earn points." | Guidance, not punishment |
| Streak day +1 | "🔥 Streak: N days!" | Momentum |
| Streak milestone (3, 7, 14, 30) | "New multiplier unlocked: X.Xx!" | Celebration |
| Streak broken | "Streak reset. Start a new one today." | Encouragement |
| Integrity verified | "🛡️ Integrity bonus: 1.5x" | Trust, quality |
| Party member added | Character card reveal | Social, fun |

---

## Empty States

| State | Display |
|-------|---------|
| No receipts | "No receipts yet. Run `ship-receipts init` to create your first." |
| No streak | "No active streak. Score a receipt (6+ base pts) to start one." |
| No party | "Solo adventurer. Run `ship-receipts party add <username>` to recruit." |
| Score = 0 on receipt | "This receipt has no proof primitives. Add verification entries to earn points." |

---

## State Machine (Local)

```
                    ┌──────────────────────┐
                    │                      │
    ┌───────┐   ┌───▼───┐   ┌────────┐   │
    │ (new) ├──►│ DRAFT  ├──►│ VALID  │   │
    └───────┘   └───┬───┘   └───┬────┘   │
                    │            │         │
                    │      ┌─────▼─────┐  │
                    │      │  SCORED    │  │
                    │      └─────┬─────┘  │
                    │            │         │
                    │      ┌─────▼─────┐  │
                    │      │ EXPORTED   │──┘ (can re-export)
                    │      └───────────┘
                    │
              ┌─────▼─────┐
              │ REJECTED   │  (at any validation step)
              └───────────┘
```

Events are append-only. Badge is derived from latest event for a given `content_hash`.
