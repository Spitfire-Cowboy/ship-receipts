# Gamification Ethics

Ship-receipts uses gamification to make consistent shipping more rewarding. This document lists every gamification mechanic in the system and explains the ethical reasoning behind each one. Every mechanic is measured against one question: **does this encourage human thriving, or does it exploit it?**

---

## Active Mechanics

### XP / Score Points

**What it does:** Each receipt earns a base score proportional to its verifiable depth — subject name, artifact URL, verification entries, content hash, claims.

**Why it's ethical:** Points are earned by doing real work and documenting it honestly. There is no manufactured scarcity. The score is a ledger, not a leaderboard. You are not competing against other people.

---

### Streak Multiplier

**What it does:** Shipping on consecutive days multiplies the base score (1.1x at 2 days, 1.25x at 3–4 days, 1.5x at 5+ days).

**Cap:** 5 days, 1.5x maximum. Deliberately low.

**Why it's ethical:** Streaks are a tool for building habits, not for inducing anxiety. The cap at 5 days means a weekend break does not undo weeks of progress. The system rewards cadence without punishing life. No badge is lost for taking a vacation, getting sick, or taking a rest day.

---

### Integrity Multiplier

**What it does:** Receipts with a verified content hash and a checksum verification entry earn a 1.5x integrity bonus.

**Why it's ethical:** This rewards verifiability, not volume. It encourages documentation that can actually be audited — a direct proxy for trust.

---

### Ithaca Goal System

**What it does:** Users can declare a qualitative goal ("Get one project to revenue"). The goal appears in streak output and compass reflections.

**Why it's ethical:** The goal is a compass heading, not a metric. It is qualitative and self-directed. The system never says you failed to reach your goal — it only asks: "Are you still sailing toward it?"

---

### LLM Compass Hook

**What it does:** After a successful score, an optional LLM command can be triggered to reflect on the receipt and the user's declared goal.

**Why it's ethical:** The LLM is a reflection tool, not a reward dispenser. It provides context, not dopamine. The feature is opt-in and configurable. The system gracefully skips it when not configured.

---

## Wellness Signals (Planned)

Rest, travel, health activities, and presence are intended to be positive scoring signals — not just productive work receipts. A day off is a ship.

---

## Anti-patterns We Will Never Introduce

These mechanics are explicitly out of scope, forever:

| Anti-pattern | Why it's out |
|---|---|
| Streak punishment (losing XP or badges for missing days) | Punishes life |
| Leaderboards | Invites social anxiety and comparison |
| Loot boxes or randomized rewards | Exploits variable-ratio reinforcement |
| Timed urgency ("score 3x today only!") | Manufactured FOMO |
| Micro-transactions or paid boosts | Pay-to-win undermines trust |
| Social shaming ("you haven't shipped in X days!") | Anti-human |
| Infinite scaling goals | Treadmill mechanics |

---

## Commitment

Ship-receipts will never knowingly introduce a gamification feature that is inherently anti-human thriving. Any proposed mechanic that cannot survive scrutiny against this document will be rejected.

If you see a mechanic that violates this commitment, [file an issue](https://github.com/Spitfire-Cowboy/ship-receipts/issues).

Closes #57
