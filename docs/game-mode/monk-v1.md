# Game Mode: Monk

**Status:** SPEC
**Closes:** #50

---

## Summary

Monk mode is for intentional learning phases where shipping is not the goal. When you declare a monk period, no receipts are scored. The period closes with a single reflection receipt.

---

## Philosophy

The most dangerous trap in a shipping incentive system is optimizing for receipts when what you need is depth. Monk mode makes the choice explicit: "I am going deep, not shipping." This is not an escape hatch — it is a legitimate phase of creative work.

---

## Mechanics

### Starting monk mode
```
ship-receipts monk start --focus "Learning Rust ownership model" --days 7
```

- Declares a focus area and expected duration
- Receipts submitted during monk mode are not scored (but may still be saved locally)
- Streak freezes: the streak does not break or advance during monk mode

### Closing monk mode
```
ship-receipts monk end
```

- Prompts for a reflection note
- Generates a single `reflection` receipt (kind: `other`, with monk metadata)
- The reflection receipt is scored normally and counts as the required "one scored receipt between monk periods"
- The reflection receipt also resumes and can advance the frozen streak (if it clears the qualifying threshold)

### Structural limits
- Cannot stack monk periods continuously: must have at least one scored receipt between monk periods
- Maximum monk period: 30 days (prevents permanent monk mode as a scoring avoidance strategy)
- If monk period expires without explicitly closing, it auto-closes with a minimal reflection receipt; that receipt follows the same scoring/re-entry/streak rules above

---

## Storage

Monk state stored in `.ship-receipts/monk.json`:
```json
{
  "active": true,
  "focus": "Learning Rust ownership model",
  "started_at": "2026-03-20T09:00:00Z",
  "expires_at": "2026-03-27T09:00:00Z",
  "streak_snapshot": 4
}
```

---

## Constraints

- One active monk period at a time
- Monk mode and Siege mode are mutually exclusive
- Must ship at least one scored receipt before re-entering monk mode

---

## Use cases

- Studying a new language or framework
- Reading a technical book
- Attending a course or bootcamp
- Deep research phases before a large project
