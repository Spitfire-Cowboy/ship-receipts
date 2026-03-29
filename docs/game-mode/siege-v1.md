# Game Mode: Siege

**Status:** SPEC
**Closes:** #49

---

## Summary

Siege is a time-boxed sprint mode for focused delivery. You declare a target and a window before receipts are scored. Anti-gaming by design: the window cannot be extended after it is declared.

---

## Philosophy

Some work has a hard deadline. Siege makes that explicit and scores accordingly. A 3-day siege to ship a feature is a fundamentally different signal than a casual streak. The game mode makes the commitment public and immutable.

---

## Mechanics

### Starting a siege
```
ship-receipts siege start --goal "Ship the intake form" --days 3
```

- Declares target text and window length
- Window start is immutable: it cannot be backdated or extended
- Receipts submitted during the siege are siege-tagged

### Scoring
- No streak multiplier during siege — daily consistency is not the measure
- Receipts earn base score + verification bonuses as normal
- At window close: single **completion bonus** if at least one receipt was submitted and DR novelty_rate passes threshold
- If window expires with no receipts: siege is recorded as abandoned (no penalty, but visible in history)

### DR novelty scan
At siege close, if configured, DR runs `novelty_rate` against the corpus of siege receipts to score output quality. This is the anti-slop check: volume without novelty scores lower than focused output.

### Window close
- Siege ends when the declared window expires — not when you decide you're done
- You can submit receipts up until the final second
- Cannot extend: if you try to add receipts after window close, they are scored as normal receipts (not siege-tagged)

---

## Storage

Siege state stored in `.ship-receipts/siege.json`:
```json
{
  "active": true,
  "goal": "Ship the intake form",
  "started_at": "2026-03-20T09:00:00Z",
  "ends_at": "2026-03-23T09:00:00Z",
  "receipts": ["hash1", "hash2"],
  "closed": false,
  "result": null
}
```

---

## Constraints

- One active siege at a time
- Must wait 24 hours after closing a siege before starting another (prevents chaining siege mode to avoid normal scoring)
- Monk mode and Siege mode are mutually exclusive

---

## Use cases

- Hackathons
- "Ship this feature by Friday" commitments
- Freelance milestone deliveries
- Personal project launches
