# Game Mode Foundation v1

**Status:** DRAFT
**Date:** 2026-02-26
**Author:** Seton (Claude Cowork)
**Inputs:** Campion handoff packet, game loop spec, data model spec, integration spec

---

## Mission

Stop AI agent slop on GitHub. Ship-receipts makes proving value fun. Proofofship makes it public.

The game mode exists to keep humans engaged with the verification pipeline. Without the game, the pipeline is a chore. Without the pipeline, the game is meaningless.

---

## Two Modes, One System

```
┌─────────────────────────────────────┐
│         SHIP-RECEIPTS (Local)       │
│         "Single Player Mode"        │
│                                     │
│  Create → Validate → Score → Streak │
│  Party mode, character sheets,      │
│  local leaderboard, no server       │
└──────────────┬──────────────────────┘
               │ opt-in export
               ▼
┌─────────────────────────────────────┐
│         PROOFOFSHIP (Global)        │
│         "MMO Mode"                  │
│                                     │
│  Submit → Verify → Rank → Attest    │
│  Public scoreboard, reputation      │
│  ledger, canonical record           │
└─────────────────────────────────────┘
```

**Local mode** is the default. Everything works offline, no accounts, no auth, no server calls. A builder creates receipts, scores them, builds streaks, and grows their party.

**Global mode** is opt-in. A builder exports a proof envelope and submits it to proofofship for public verification. Verified receipts earn canonical reputation.

---

## Core Design Principles

### 1. No Score Without Proof

The foundational anti-slop rule. A receipt with zero proof primitives scores zero. Volume without substance earns nothing. This is non-negotiable and cannot be weakened by any future feature.

### 2. Deterministic Scoring

Same receipt always produces same score. No randomness, no hidden weights, no server-side modifiers. A builder can predict their score before submitting.

### 3. Fun First, Verification Second

The game loop must feel rewarding before the builder ever thinks about verification. Score breakdown, streak multipliers, party mode — these make the daily loop compelling.

### 4. Privacy by Default

Game state never leaves local unless the builder explicitly exports. No telemetry, no analytics, no background sync.

### 5. Additive Only

Never break existing receipts, state files, or game progress. New features add; they never subtract.

---

## Core Loop: Local

```
         ┌──────────┐
         │  SHIP IT  │  ← Builder ships real work
         └─────┬─────┘
               │
         ┌─────▼─────┐
         │  RECEIPT   │  ← Create receipt (ship-receipts init)
         └─────┬─────┘
               │
         ┌─────▼─────┐
         │ VALIDATE   │  ← Schema + hash check
         └─────┬─────┘
               │
       ┌───────▼───────┐
       │ SCORE & STORE  │  ← Base points + multipliers
       └───────┬───────┘
               │
       ┌───────▼───────┐
       │ STREAK CHECK   │  ← Advance or break streak
       └───────┬───────┘
               │
       ┌───────▼───────┐
       │   FEEDBACK     │  ← Score card, badges, progress
       └───────┬───────┘
               │
               └──────────→ Loop back to SHIP IT
```

Each cycle takes minutes. The builder ships work, creates a receipt, gets immediate feedback. The streak system provides the daily pull.

---

## Core Loop: Global

```
       ┌───────────────┐
       │ LOCAL RECEIPT  │  ← Already scored locally
       │  (SCORED)      │
       └───────┬───────┘
               │ export
       ┌───────▼───────┐
       │ PROOF ENVELOPE │  ← Wrap receipt + metadata
       └───────┬───────┘
               │ submit (opt-in)
       ┌───────▼───────┐
       │  PROOFOFSHIP   │  ← 6-stage verification
       │   PIPELINE     │
       └───────┬───────┘
               │
       ┌───────▼───────┐
       │   VERIFIED     │  ← Canonical reputation
       │   or REJECTED  │
       └───────────────┘
```

---

## Player Identity

The builder's GitHub profile is their identity. In local mode, the `subject.name` field is their handle. No accounts, no passwords.

**Primary character:** `Pro777` (the builder's own GH profile).

**Party members:** Any public GH user added via "Add to Party." Party members are bootstrapped from a one-time GH snapshot and develop through local gameplay.

---

## Reward System

All rewards tie to verified proof depth. No exceptions.

| Reward | Source | Rule |
|--------|--------|------|
| Base points | Proof primitive presence | Deterministic from receipt content |
| Streak multiplier | Consecutive qualifying days | 2d→1.10x, 3d→1.25x, 5d+→1.50x (cap) |
| Integrity bonus | Valid hash + checksum verify | 1.5x multiplier |
| Status badges | Event stream | 8 states from DRAFT to VERIFIED |
| Gold shield | Integrity verified receipt | Visual prestige indicator |
| Party rank | Score relative to party members | Friendly competition |

**Formula:** `final_score = floor(base_score × streak_multiplier × integrity_multiplier)`

---

## Anti-Slop Design Rules

These rules are immutable. Any feature that violates them is rejected.

1. **Zero proof = zero score.** A receipt with only required fields (name, artifact kind/name/url) and no proof primitives scores 0.
2. **Invalid hash = zero score.** If `content_hash` is present but wrong, the entire receipt is untrusted.
3. **Duplicates score zero.** Same `content_hash` already in state = no points.
4. **Minimum 6 points for streak.** Prevents gaming with minimal receipts.
5. **No unverified prestige.** Global badges (VERIFIED, gold) require passing the proofofship pipeline. Local can't fake these.
6. **No negative scores.** Worst case is 0 and streak reset. Never punitive.
7. **Empty artifacts = not scorable.** Fails validation before scoring.

---

## State Architecture

All state lives in `.ship-receipts/game-state.json`. One file, append-only events, pure JSON.

```
.ship-receipts/
├── game-state.json      ← Player state, history, events, party
├── receipts/            ← Local receipt files
└── envelopes/           ← Exported proof envelopes (for global)
```

No database. No server. No dependencies beyond the filesystem.

---

## Technology Constraints

- **Local only.** No network calls in single player mode.
- **Pure JSON.** All data is JSON files on disk.
- **CLI first.** Game loop is driven by `ship-receipts` CLI commands.
- **UI optional.** Visual components (score cards, badges, party view) are enhancement layer, not core.
- **Kenney assets.** Use existing Kenney packs for visual elements. No custom art in v1.

---

## What This Doc Does NOT Cover

Each of these has its own spec:

- Detailed UX flows → `local-loop-ux-spec-v1.md`
- Global submission flows → `global-loop-ux-spec-v1.md`
- UI copy and state inventory → `ui-copy-and-states-v1.md`
- Kenney asset mapping → `kenney-asset-mapping-v1.md`
- Build order → `build-order-for-campion-v1.md`
