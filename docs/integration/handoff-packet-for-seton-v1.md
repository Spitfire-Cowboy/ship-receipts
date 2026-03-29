# Handoff Packet for Seton (Claude Cowork) — Game Mode UX v1

**Date:** 2026-02-25
**From:** Campion (Claude Code)
**For:** Seton (Claude Cowork)
**Status:** READY TO BUILD

---

## What This Is

Everything you need to build ship-receipts game mode UX. No guessing required.

Ship-receipts is **single-player mode** — fun, easy, local. The builder creates
receipts, scores them, builds streaks. Think RPG character sheet meets GitHub
contribution graph.

Proofofship is **MMO mode** — public scoreboard, canonical reputation ledger,
opt-in. That comes later. For now, focus on single-player.

---

## Core Mission

OSS repos are getting overrun with AI agent slop. Proofofship exists to stop
that by making agents prove they ship things that are valuable, publicly and
verifiably. The game mode keeps humans interested in participating.

---

## Schema Files (Read These)

| File | What It Is |
|------|-----------|
| `schemas/proof-envelope.v1.json` | The thing that crosses local → global |
| `schemas/receipt-event.v1.json` | Event stream powering your UX state machine |
| `schema/ship-receipts.v0.1.schema.json` | The local receipt format |
| `examples/local-to-global-proof-example.v1.json` | Full worked example |

---

## Status Badges

Derive the current badge from the **latest event** for a given `content_hash`.

| State | Badge Text | Color | Trigger Event | UX Note |
|---|---|---|---|---|
| Draft | `DRAFT` | Gray | `receipt.created` | Just created, not yet validated |
| Valid | `VALID` | Blue | `receipt.validated` | Passed schema + hash check |
| Scored | `SCORED: {n}` | Green | `receipt.scored` | Local game loop scored it |
| Exported | `EXPORTED` | Purple | `envelope.exported` | Proof envelope generated |
| Submitted | `PENDING` | Yellow | `envelope.submitted` | Sent to proofofship, awaiting verification |
| Accepted | `ACCEPTED` | Green | `envelope.accepted` | Proofofship accepted for verification |
| Rejected | `REJECTED` | Red | `envelope.rejected` | Failed verification. Show `detail.reason` |
| Verified | `VERIFIED` | Gold | `envelope.verified` | Fully verified. Show `detail.verification_depth` |

**State machine:** States progress left to right. A receipt can be rejected at
any point after submission. Events are append-only — never delete or overwrite.

---

## Score Components

### Base Score Breakdown

Show which proof primitives contributed points:

| Proof Element | Points | Condition |
|---|---|---|
| `subject.name` present | 1 | Always |
| `subject.profiles[]` has entries | 2 | At least one profile |
| `meta.created_at` present | 1 | ISO 8601 timestamp |
| `meta.content_hash` valid | 3 | SHA-256 matches computed |
| `artifacts[].immutable_ref` | 2/artifact | Commit SHA, digest, etc. |
| `artifacts[].ci_url` | 1/artifact | Any URL |
| `verify[kind=checksum]` | 3/entry | algo + hash present |
| `verify[kind=link]` | 1/entry | URL present |
| `verify[kind=command]` | 2/entry | Command string present |
| `verify[kind=attestation]` | 2/entry | Attestation object present |
| `signals` non-zero values | 1/signal | Per non-zero signal field |

Render as a checklist or point breakdown. Green checkmarks for present, gray
dashes for absent. Show point values.

### Streak Display

| Field | Source | Display |
|---|---|---|
| Current streak | `local_score_snapshot.streak_days` | `🔥 8-day streak` |
| Multiplier | `local_score_snapshot.streak_multiplier` | `1.5x bonus` |
| Next threshold | Computed from streak_days | `6 days to 2.0x` |

Streak thresholds: 3 days → 1.25x, 7 days → 1.5x, 14 days → 1.75x, 30 days → 2.0x.

### Integrity Badge

If the receipt has a valid `meta.content_hash` AND at least one `verify[kind=checksum]`:
- Show gold shield icon
- Label: `INTEGRITY VERIFIED`
- This earns 1.5x integrity multiplier on score

### Final Score Formula

```
final_score = floor(base_score * streak_multiplier * integrity_multiplier)
```

Display: `27 pts = 18 base × 1.5 streak × 1.0 integrity`

---

## Verification Progress (Global)

When a receipt has been submitted to proofofship, show a 6-stage progress indicator:

```
[x] Schema valid
[x] Hash integrity (dedup passed)
[x] Identity confirmed
[x] Artifact exists (commit public, actor has access)
[x] Signature verified
[ ] Attestation received
```

Data source: `envelope.verified` event → `detail.stages` object. Each key maps
to a pipeline stage. `pass: true` = checked, `pass: false` = unchecked with
optional `reason`.

The `detail.verification_depth` (0.0-1.0) summarizes this as a single number.
Consider rendering as a progress bar or percentage.

---

## Party Mode (Single Player)

### Concept

The builder selects their own GitHub profile as their primary character. They
can also **Add to Party** any public GitHub user — building an RPG party.

Example party: `[Pro777, DHH, torvalds, defunkt]`

### How It Works

1. **Bootstrap:** Fetch public GitHub profile data (repos, stars, contributions)
   as a one-time snapshot. This creates the character sheet.
2. **Develop organically:** The character grows through local gameplay. Since
   real GH state does not change much in real-time, the snapshot is the starting
   point, and the character evolves through receipts and scoring.
3. **Party view:** Show all party members side by side with their scores,
   streaks, and proof depth. Friendly competition within the party.

### UX Primitives for Party

- Character card: avatar, name, score, streak, top artifacts
- Party roster: grid or list of character cards
- "Add to Party" button: search by GitHub username
- Party leaderboard: rank party members by score

### Data Source

Party data lives in `.ship-receipts/game-state.json` (local only, never
sent to proofofship). Each party member has a `subject` block with their
GitHub profile snapshot.

---

## What NOT to Build (Yet)

- No server or API calls (everything is local JSON files)
- No authentication (no OAuth, no tokens)
- No proofofship submission UI (that is MMO mode, comes later)
- No real-time GitHub API polling (snapshot at bootstrap, develop locally)
- No account creation or user management
- No SaaS features

---

## Key Design Constraints

1. **Fun and easy.** Single player mode should feel lightweight and rewarding.
2. **No score without proof.** Zero proof primitives = zero score. Anti-slop rule.
3. **Deterministic.** Same receipt always produces same score. No randomness.
4. **Additive only.** Never break existing receipts or state files.
5. **Privacy by default.** Game state never leaves local unless builder exports.

---

## Files You Will Create

Your deliverables (suggested, not mandatory):

- Receipt creation flow (UI for `ship-receipts init`)
- Score display component (breakdown, streak, integrity badge)
- Status badge component (state machine from events)
- Party management UI (add/remove GH profiles, character cards)
- Streak visualization (calendar heatmap or streak counter)

---

## Example Data

The file `examples/local-to-global-proof-example.v1.json` contains:

- A complete proof envelope with a v0.1 receipt
- 7 lifecycle events from creation through global verification
- Score breakdown in the `_score_breakdown` comment field
- All fields that your UI components need to render

Use this as your test fixture for building components.

---

## Questions?

If anything in this packet is ambiguous, check:
1. `docs/integration/ship-receipts-to-proofofship-v1.md` — technical spec
2. `docs/specs/ship-receipts-game-loop-local-v1.md` — scoring rules
3. `docs/specs/ship-receipts-data-model-v1.md` — receipt format details
4. `docs/plans/2026-02-25-ship-receipts-to-proofofship-integration-design.md` — design rationale

If still unclear, ask Campion (Claude Code) to clarify.
