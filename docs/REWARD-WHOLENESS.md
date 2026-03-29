# Reward Wholeness

Ship-receipts rewards shipping. But shipping is not the only signal of a healthy, durable contributor. This document describes the wholeness philosophy and how it shapes the scoring model.

---

## The Problem With Pure Shipping Metrics

A scoring system that only rewards shipping creates a treadmill. It implicitly says: the only valuable thing you can do is produce output. This is wrong, and it produces burnout.

The most durable contributors are not the ones who ship every day. They are the ones who ship, rest, learn, and return — repeatedly, over years.

Ship-receipts is designed to reflect that reality.

---

## Wholeness Signals

### Rest (planned)
A rest receipt is an explicit opt-in: "I took a break intentionally." It is a positive signal, not an absence.

- A weekend with zero commits, followed by a Monday ship, is a healthy cadence — not a streak failure.
- Returning from a gap (illness, travel, life) and shipping is a **strength indicator**.

### Wellness Activities (now: `wellness` artifact kind)
Rest, health activities, travel, and presence can be documented as `wellness` receipts:

```json
{
  "version": "1.0",
  "subject": {"name": "John Malone"},
  "artifacts": [
    {
      "kind": "wellness",
      "name": "Two-week vacation, no commits",
      "url": "https://example.com/trip",
      "verify": [{"kind": "note", "note": "Intentional rest. Battery recharged."}]
    }
  ]
}
```

These receipts are scored at base value. They do not earn streak multipliers — rest is not grinding — but they do demonstrate sustainable cadence.

### Learning Periods (Monk mode)
See [docs/game-mode/monk-v1.md](game-mode/monk-v1.md). A declared learning period with a reflection receipt is scored as a positive signal.

### Recovery Signal (planned)
Returning from a cadence gap and shipping triggers a recovery signal — a one-time bonus that rewards re-engagement after absence. The message: coming back is valued.

---

## Anti-Burnout Detection (planned)

The scoring model will detect unsustainable pace and warn — not celebrate.

If a user ships every day for 30+ consecutive days:
- No additional bonus (streak is already capped at 5 days / 1.5x)
- Compass fires a "pace check" prompt: "You've shipped every day for 30 days. Are you resting too?"

This is an opt-in warning, not a penalty. The system will never reduce your score for shipping. But it will notice.

---

## The Philosophical Shift

Conventional productivity tools measure output. Ship-receipts measures **durability**: the ability to ship, rest, learn, and return — sustainably, over time.

A durable contributor is worth more to any team or project than a high-output burnout case. The scoring model should reflect that.

**Wholeness makes shipping sustainable. That is the whole point.**

---

## Schema

The `wellness` artifact kind is now live in both v0.1 and v1 schemas. Use it for rest receipts, health activities, travel, or any intentional non-shipping period worth documenting.

Closes #55
