# Build Order for Campion v1

**Status:** DRAFT
**Date:** 2026-02-26
**Author:** Seton (Claude Cowork)
**For:** Campion (Claude Code) — implementation slices, ordered by dependency

---

## Guiding Principles

1. Each slice is small, testable, and independently useful.
2. No slice depends on network access.
3. Every slice has a clear "done" definition.
4. Earlier slices unblock later ones.

---

## Slice 1: Score Calculator (Pure Function)

**What:** Implement `receipt → { base_score, breakdown }` as a pure function.

**Inputs:** A parsed receipt JSON object.

**Outputs:**

```json
{
  "base_score": 19,
  "breakdown": {
    "subject_name": 1,
    "subject_profiles": 2,
    "meta_created_at": 1,
    "meta_content_hash": 3,
    "immutable_refs": 2,
    "ci_urls": 1,
    "verify_checksum": 3,
    "verify_link": 1,
    "verify_command": 2,
    "verify_attestation": 0,
    "signals": 3
  }
}
```

**Rules:**
- Walk the scoring table from `ship-receipts-game-loop-local-v1.md`
- Zero proof primitives beyond required fields → score = 0
- Invalid `content_hash` → score = 0
- Empty `artifacts` → fail (not scorable)

**Test fixture:** `examples/local-to-global-proof-example.v1.json` → expected base ≈ 18-19.

**Done when:** Pure function passes against fixture with deterministic output.

---

## Slice 2: Content Hash Validator

**What:** Implement canonical JSON hashing per the data model spec.

**Steps:**
1. Parse receipt JSON
2. Deep-clone, remove `meta.content_hash`
3. Serialize with sorted keys, compact, UTF-8, no trailing newline
4. SHA-256 → `sha256:<hex>`
5. Compare to `meta.content_hash`

**Done when:** Hash of known receipt matches expected value. Round-trip test passes (compute → embed → verify).

---

## Slice 3: Game State File (Read/Write)

**What:** Read and write `.ship-receipts/game-state.json`.

**Schema:**

```json
{
  "version": "1",
  "subject": "Pro777",
  "total_score": 0,
  "receipts_submitted": 0,
  "receipts_rejected": 0,
  "streak": {
    "current": 0,
    "longest": 0,
    "last_qualifying_date": null,
    "streak_start_date": null
  },
  "history": [],
  "events": [],
  "known_hashes": [],
  "party": []
}
```

**Operations:**
- `init()` — create state file if not exists
- `load()` — read and parse
- `save(state)` — write atomically (write to tmp, rename)
- `appendEvent(event)` — add event, enforce 1000-event cap (keep last 1000)

**Done when:** Init/load/save/append round-trip works. State file survives process restart.

---

## Slice 4: Streak Tracker

**What:** Track consecutive qualifying days.

**Inputs:** Current game state + new receipt score + current date.

**Logic:**
1. If `base_score < 6` → receipt doesn't qualify for streak. No streak change.
2. If `last_qualifying_date == today` → already qualified today. No streak change.
3. If `last_qualifying_date == yesterday` → advance streak by 1.
4. If `last_qualifying_date < yesterday` → break streak, start new at 1.
5. If no `last_qualifying_date` → start new streak at 1.

**Multiplier lookup:**
- 0-2 days → 1.0x
- 3-6 days → 1.25x
- 7-13 days → 1.5x
- 14-29 days → 1.75x
- 30+ days → 2.0x

**Done when:** All 5 logic branches tested. Multiplier lookup table tested at boundaries.

---

## Slice 5: Event Emitter

**What:** Create and append lifecycle events.

**Event types (local):**
- `receipt.created`
- `receipt.validated`
- `receipt.scored`
- `receipt.rejected`
- `receipt.duplicate`
- `streak.advanced`
- `streak.broken`

**Event schema:**

```json
{
  "event_id": "evt_01JMFG...",
  "event_type": "receipt.scored",
  "content_hash": "sha256:...",
  "timestamp": "2026-02-26T...",
  "source": "local",
  "detail": {},
  "actor": "ship-receipts-cli"
}
```

**Needs:** ULID generation (pick a library or implement — spec is simple).

**Done when:** Events append to state file. Event IDs are ULID-formatted and time-ordered.

---

## Slice 6: Wire It Together — `ship-receipts score`

**What:** The main scoring command that ties slices 1-5 together.

**Flow:**
1. Load state file (slice 3)
2. Parse receipt file
3. Validate schema (existing validator)
4. Validate content hash (slice 2)
5. Check for duplicate (known_hashes in state)
6. Compute base score (slice 1)
7. Compute streak (slice 4)
8. Compute final score (base × streak × integrity)
9. Emit events (slice 5)
10. Update state file (slice 3)
11. Print score card to stdout

**Done when:** `ship-receipts score <file>` produces correct score card and updates state.

---

## Slice 7: Badge Renderer

**What:** Derive current badge from event stream.

**Logic:** For a given `content_hash`, find the latest event. Map `event_type` to badge:

| Event Type | Badge |
|-----------|-------|
| `receipt.created` | DRAFT (gray) |
| `receipt.validated` | VALID (blue) |
| `receipt.scored` | SCORED (green) |
| `envelope.exported` | EXPORTED (purple) |
| `envelope.submitted` | PENDING (yellow) |
| `envelope.accepted` | ACCEPTED (green) |
| `envelope.rejected` | REJECTED (red) |
| `envelope.verified` | VERIFIED (gold) |

**Done when:** Badge derivation works for all 8 states. Test with example event history.

---

## Slice 8: Party Mode (Bootstrap)

**What:** Add/remove GH users to party, store snapshots.

**Operations:**
- `party add <username>` — fetch public GH profile, create character snapshot, add to state
- `party remove <username>` — remove from state
- `party list` — show party roster

**Character snapshot:**

```json
{
  "username": "torvalds",
  "display_name": "Linus Torvalds",
  "avatar_url": "https://avatars.githubusercontent.com/...",
  "public_repos": 7,
  "stars": 186000,
  "created_at": "2011-09-03",
  "class": "LEGENDARY",
  "snapshot_date": "2026-02-26",
  "score": 0,
  "receipts": 0,
  "streak": 0
}
```

**Class derivation:**
- < 5 repos AND < 50 stars → ROOKIE
- 5-20 repos OR 50-500 stars → BUILDER
- 20-50 repos OR 500-5k stars → ARCHITECT
- 50+ repos OR 5k-50k stars → VETERAN
- 100+ repos OR 50k+ stars → LEGENDARY

**Note:** This is the ONLY slice that makes a network call (one-time GH API fetch). All subsequent party operations are local.

**Done when:** Can add a public GH user, see their character card, and class assignment.

---

## Slice 9: Export Tool (`ship-receipts export`)

**What:** Generate proof envelope from scored receipt.

**Flow:**
1. Load receipt file
2. Run 8-step export validation (see global-loop-ux-spec)
3. Generate ULID for `envelope_id`
4. Extract actor from subject
5. Copy receipt verbatim into envelope
6. Attach local_score_snapshot from game state
7. Write envelope JSON to `envelopes/` directory
8. Emit `envelope.exported` event

**Input:** Scored receipt file path.
**Output:** Proof envelope JSON file.

**Done when:** Generated envelope validates against `schemas/proof-envelope.v1.json`. All 8 pre-flight checks pass or fail correctly.

---

## Slice 10: Streak Display (`ship-receipts streak`)

**What:** Pretty-print streak status to terminal.

**Display:**
- Current streak length and multiplier
- Distance to next tier
- Weekly grid (M-Su) with daily scores
- Best streak record

**Done when:** Output matches the format in local-loop-ux-spec. Handles all streak states (active, broken, none).

---

## Dependency Graph

```text
Slice 1 (Score Calculator) ──┐
Slice 2 (Hash Validator)  ───┤
Slice 3 (State File)      ───┼──→ Slice 6 (Wire Together)
Slice 4 (Streak Tracker)  ───┤         │
Slice 5 (Event Emitter)   ───┘         ▼
                                  Slice 7 (Badge Renderer)
                                  Slice 10 (Streak Display)

Slice 8 (Party Mode)      ← independent, can build in parallel

Slice 9 (Export Tool)      ← depends on Slice 6 (needs scored state)
```

**Recommended order:** 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 (parallel) → 9 → 10

---

## What Comes After v1

These are NOT in the build order. They're noted for future planning:

- Submit command (`ship-receipts submit`) — requires proofofship API
- Verification status polling — requires proofofship API
- Scoreboard display — requires proofofship API
- Visual UI (web dashboard) — enhancement layer over CLI
- Party receipt attribution — v2 party feature
- Streak grace period — v2 quality-of-life
