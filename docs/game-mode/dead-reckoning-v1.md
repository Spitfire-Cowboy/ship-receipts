# Game Mode: Dead Reckoning

**Status:** SPEC
**Closes:** #52

---

## Summary

Dead Reckoning is a solo indie cadence mode. Scoring is drift-based — how far you've moved from your last cadence boundary — rather than streak-based. The compass fires a `dr stop` at each boundary: SHIP, ITERATE, or ABANDON.

---

## Philosophy

A streak requires external context: dates, daily check-ins, a global sense of "today." Dead reckoning requires only two things: your last known position and your heading. Solo developers often work in bursts, not daily increments. Dead Reckoning honors that reality.

The name is intentional. You are navigating without GPS. You know how long you've been sailing and in which direction. The system estimates your position from that evidence, not from an external authority.

---

## Mechanics

### Enabling Dead Reckoning mode

```text
ship-receipts dr enable --cadence weekly
```

Cadence options: `daily`, `weekly`, `biweekly`, `monthly`.

The cadence defines the boundary interval. Each interval is a checkpoint.

### Drift scoring

At each cadence boundary:
- **0 drift** (shipped this interval): full score, compass fires SHIP
- **1 interval drift** (shipped last interval, not this one): partial score, compass fires ITERATE
- **2+ interval drift** (no ships for multiple intervals): decayed score, compass fires ABANDON signal

Drift is measured in intervals, not days. A weekly cadence developer who ships every other week has 1 interval drift — not 7 days of streak break.

### Evidence decay

Receipts have a half-life proportional to the cadence:
- Daily cadence: receipts at full weight for 2 days, then decay
- Weekly: full weight for 2 weeks, then decay
- Monthly: full weight for 2 months, then decay

Decay does not delete receipts. It reduces their contribution to the running score. A ship from 6 months ago still counts — it just counts for less.

### Compass at cadence boundary

At each cadence boundary, the compass fires automatically (if configured):
```text
SHIP     — you shipped this interval. Keep sailing.
ITERATE  — you shipped last interval but not this one. Drift check.
ABANDON  — no ship in 2+ intervals. Is this project still alive?
```

These are navigational signals, not verdicts. ABANDON does not close the project — it asks the question.

---

## Storage

Dead Reckoning state in `.ship-receipts/dr.json`:
```json
{
  "enabled": true,
  "cadence": "weekly",
  "last_boundary": "2026-03-17T00:00:00Z",
  "next_boundary": "2026-03-24T00:00:00Z",
  "current_drift": 0,
  "receipts_this_interval": 2
}
```

---

## Constraints

- Dead Reckoning replaces the streak mechanic when enabled — streaks are suspended
- Siege mode is compatible with Dead Reckoning (siege overrides DR for the siege window)
- Monk mode suspends DR boundaries for its duration

---

## Use cases

- Solo indie developers with irregular shipping cadence
- Open source maintainers who ship in bursts
- Anyone who finds daily streaks anxiety-inducing but still wants cadence accountability
