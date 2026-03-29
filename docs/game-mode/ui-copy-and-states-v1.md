# UI Copy and States v1

**Status:** DRAFT
**Date:** 2026-02-26
**Author:** Seton (Claude Cowork)

---

## Badge Copy

| State | Badge Text | Color | Hex | Copy When Shown |
|-------|-----------|-------|-----|-----------------|
| Draft | `DRAFT` | Gray | `#9CA3AF` | "Receipt created. Run `score` to earn points." |
| Valid | `VALID` | Blue | `#3B82F6` | "Schema and hash check passed." |
| Scored | `SCORED: {n}` | Green | `#22C55E` | "You earned {n} points!" |
| Exported | `EXPORTED` | Purple | `#A855F7` | "Proof envelope ready for submission." |
| Pending | `PENDING` | Yellow | `#EAB308` | "Awaiting verification from proofofship." |
| Accepted | `ACCEPTED` | Green | `#22C55E` | "Accepted into verification pipeline." |
| Rejected | `REJECTED` | Red | `#EF4444` | "Verification failed: {reason}" |
| Verified | `VERIFIED` | Gold | `#F59E0B` | "Canonically verified. Depth: {depth}" |

---

## Screen Inventory

### S1: Dashboard (Home)

```
┌─────────────────────────────────────────┐
│  SHIP RECEIPTS                    ⚙️    │
├─────────────────────────────────────────┤
│                                         │
│  Pro777                    🔨 BUILDER   │
│  Total: 184 pts                         │
│  Receipts: 13                           │
│  🔥 Streak: 8 days (1.5x)              │
│                                         │
├─────────────────────────────────────────┤
│  RECENT RECEIPTS                        │
│                                         │
│  proof-engine v0.3.0    SCORED: 42  ✓   │
│  api-gateway v1.2.1     SCORED: 27  ✓   │
│  docs-site              SCORED: 15  ✓   │
│                                         │
├─────────────────────────────────────────┤
│  PARTY                                  │
│                                         │
│  #1 Pro777     184 pts  🔥 8d           │
│  #2 torvalds     0 pts  —              │
│                                         │
└─────────────────────────────────────────┘
```

### S2: Receipt Detail

```
┌─────────────────────────────────────────┐
│  ← Back          SCORED: 42    🟢       │
├─────────────────────────────────────────┤
│                                         │
│  proof-engine v0.3.0                    │
│  Pro777 · 2026-02-26                    │
│                                         │
│  PROOF BREAKDOWN                        │
│  ✓ subject.name            1            │
│  ✓ subject.profiles        2            │
│  ✓ meta.created_at         1            │
│  ✓ meta.content_hash       3            │
│  ✓ artifact.immutable_ref  2            │
│  ✓ artifact.ci_url         1            │
│  ✓ verify[checksum]        3            │
│  ✓ verify[link]            1            │
│  ✓ verify[command]         2            │
│  ✓ signals (3)             3            │
│  ─ verify[attestation]     —            │
│                           ────          │
│  Base: 19                               │
│                                         │
│  MULTIPLIERS                            │
│  🔥 Streak (8d)          × 1.5         │
│  🛡️  Integrity            × 1.5         │
│                                         │
│  FINAL: 42 pts                          │
│                                         │
│  [Export to Proofofship →]              │
└─────────────────────────────────────────┘
```

### S3: Streak View

```
┌─────────────────────────────────────────┐
│  ← Back              STREAK             │
├─────────────────────────────────────────┤
│                                         │
│  🔥 8 days                              │
│  Current multiplier: 1.5x              │
│  Next tier: 1.75x in 6 days            │
│                                         │
│  MULTIPLIER TIERS                       │
│  ✓  3 days  → 1.25x                    │
│  ✓  7 days  → 1.5x   ← you are here   │
│  ○ 14 days  → 1.75x                    │
│  ○ 30 days  → 2.0x                     │
│                                         │
│  THIS WEEK                              │
│  Mon  Tue  Wed  Thu  Fri  Sat  Sun      │
│   ■    ■    ■    ■    ■    □    □       │
│  18   22   15   27   42    -    -       │
│                                         │
│  STREAK HISTORY                         │
│  Best: 12 days (Feb 8-19)              │
│  Current: 8 days (Feb 19-26)           │
└─────────────────────────────────────────┘
```

### S4: Party Roster

```
┌─────────────────────────────────────────┐
│  ← Back              PARTY             │
├─────────────────────────────────────────┤
│                                         │
│  ┌─────────────────────────────────┐    │
│  │ 🔨 Pro777          YOU         │    │
│  │ Score: 184   🔥 8d   13 rcpts  │    │
│  │ Top: proof-engine, api-gateway │    │
│  └─────────────────────────────────┘    │
│                                         │
│  ┌─────────────────────────────────┐    │
│  │ 🧙 torvalds                    │    │
│  │ Score: 0     —       0 rcpts   │    │
│  │ GH: 186k★  7 repos  Since '11 │    │
│  └─────────────────────────────────┘    │
│                                         │
│  ┌─────────────────────────────────┐    │
│  │ 🏗️ DHH                         │    │
│  │ Score: 0     —       0 rcpts   │    │
│  │ GH: 42k★   89 repos Since '04 │    │
│  └─────────────────────────────────┘    │
│                                         │
│  [+ Add to Party]                       │
└─────────────────────────────────────────┘
```

### S5: Verification Progress (Global)

```
┌─────────────────────────────────────────┐
│  ← Back          VERIFICATION           │
├─────────────────────────────────────────┤
│                                         │
│  proof-engine v0.3.0                    │
│  Envelope: 01JMFGHT5V...               │
│                                         │
│  PIPELINE STATUS                        │
│                                         │
│  [✓] Schema valid                       │
│  [✓] Hash integrity                     │
│  [✓] Identity confirmed                │
│  [✓] Artifact exists                    │
│  [✓] Signature verified                │
│  [ ] Attestation received               │
│                                         │
│  ████████████████████░░░░  83%          │
│  Verification depth: 0.83              │
│                                         │
│  Badge: VERIFIED (gold)                 │
│  Verified at: 2026-02-25 14:31 UTC     │
└─────────────────────────────────────────┘
```

---

## Empty States

| Screen | Empty Condition | Heading | Body | CTA |
|--------|----------------|---------|------|-----|
| Dashboard | No receipts | "Nothing shipped yet" | "Create your first receipt to start earning points." | `ship-receipts init` |
| Dashboard | No streak | "No active streak" | "Score a receipt with 6+ base points to start a streak." | `ship-receipts score` |
| Recent Receipts | No receipts | "Your receipt log is empty" | "Receipts you score will appear here." | — |
| Party | Solo | "Solo adventurer" | "Add party members from any public GitHub profile." | `ship-receipts party add <user>` |
| Verification | No exports | "Nothing exported yet" | "Export a scored receipt to submit to proofofship." | `ship-receipts export` |

---

## Error States

| Error | Code | User-Facing Copy |
|-------|------|-----------------|
| Invalid JSON | `E_PARSE` | "This file isn't valid JSON. Check for syntax errors." |
| Schema fail | `E_SCHEMA` | "Receipt doesn't match the expected format. Missing: {field}" |
| Hash missing | `E_HASH_MISSING` | "No content_hash found. Run `ship-receipts hash` to add one." |
| Hash mismatch | `E_HASH_INVALID` | "Content hash doesn't match. The receipt may have been modified." |
| No subject | `E_SUBJECT` | "Receipt needs a subject name. Who shipped this?" |
| No GitHub profile | `E_NO_GITHUB` | "No GitHub profile found. Add one to subject.profiles." |
| No artifact | `E_NO_ARTIFACT` | "No artifacts with URLs. What did you ship?" |
| Duplicate | `W_DUPLICATE` | "This receipt was already submitted. Use --force to resubmit." |

---

## Notification Copy (CLI Output)

| Event | Copy |
|-------|------|
| Receipt created | "Receipt created: {filename}" |
| Validation passed | "All checks passed. Receipt is valid." |
| Validation failed | "Validation failed: {error_code} — {message}" |
| Score computed | "Score: {final} pts ({base} base × {streak}x streak × {integrity}x integrity)" |
| Streak advanced | "Streak: {n} days! Multiplier: {mult}x" |
| Streak milestone | "New milestone! {n}-day streak unlocks {mult}x multiplier." |
| Streak broken | "Streak broken at {n} days. Score a receipt today to start a new one." |
| Integrity verified | "Integrity bonus applied: 1.5x multiplier." |
| Envelope exported | "Proof envelope exported: {filename}" |
| Submission accepted | "Submitted to proofofship. Envelope: {id}" |
| Verification complete | "Verified! Depth: {depth}. Badge: VERIFIED." |
| Verification rejected | "Rejected at stage: {stage}. Reason: {reason}" |
| Party member added | "{username} joined your party! Class: {class}" |
| Party member removed | "{username} left your party." |

---

## Tone Guidelines

- **Encouraging, never punitive.** "No proof primitives found" not "Your receipt is worthless."
- **Direct and concise.** No filler. Every word earns its place.
- **Show, don't lecture.** Show the score breakdown; don't explain why proof matters.
- **Celebrate milestones.** Streak thresholds, first receipt, first verified — these matter.
- **Respect privacy.** Never mention what data goes where unless the builder asks.
