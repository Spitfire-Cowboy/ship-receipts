# Gamification Pattern Library

This is the canonical source of truth for nudge and gamification patterns in the ship-receipts ecosystem. All products (Alcove, Golden Thread, chart-wizard, and future products) should reference these patterns rather than inventing their own.

**Principle:** DRY at the macro level. One ethical framework, one set of named patterns, one place to update when we learn something is wrong.

---

## Theoretical Foundation

These patterns draw from:

- **Bounded rationality** (Simon): humans make decisions with limited information and cognitive capacity. Good design reduces the cognitive load of good decisions.
- **Hyperbolic discounting** (Laibson): humans overweight immediate rewards vs. future ones. Patterns that close the gap between action and feedback counter this.
- **Nudge theory** (Thaler & Sunstein): the choice architecture matters. Defaults, framing, and feedback shape behavior without restricting choice.
- **Strategic reflectivism**: making current decisions visible in relation to stated long-term goals interrupts automatic behavior with intentional reflection.
- **Self-determination theory** (Deci & Ryan): intrinsic motivation (autonomy, competence, relatedness) is more durable than extrinsic motivation (rewards, punishments).

---

## Named Patterns

### 1. Immediate Feedback Loop
**Mechanism:** Anti-hyperbolic-discounting.

**What it is:** Every scored receipt produces immediate output — score, streak status, compass reflection. The feedback arrives within seconds of the action.

**Why it works:** Hyperbolic discounting makes the future feel abstract. Closing the feedback gap makes the long-term value of shipping feel present.

**Guardrails:**
- Feedback must be honest — no inflation of scores to feel good
- Feedback must be proportionate — a small ship gets a small score, not false praise
- Feedback must be finite — no infinite notification spirals

---

### 2. Streak as Commitment Device
**Mechanism:** Commitment device (Ariely / behavioral economics).

**What it is:** A streak tracks consecutive shipping days and applies a multiplier (capped at 1.5x at 5 days).

**Why it works:** People are loss-averse. Once a streak is established, breaking it feels like a loss. This is useful for building habits.

**Guardrails:**
- Cap at 5 days. Beyond that, streaks become anxiety, not habit.
- No penalty for breaking a streak — it resets to 1.0x, nothing is taken away.
- Monk mode and Siege mode both correctly suspend streak mechanics.
- Rest is not a streak break if the user returns and ships. The system records the gap but does not punish it.

---

### 3. Default-to-Ship
**Mechanism:** Status quo bias as ally.

**What it is:** The `init --from-git` command makes it trivially easy to generate a receipt from existing work. The default behavior is to document, not to skip.

**Why it works:** Status quo bias means people stick with defaults. If the default is "generate receipt from your last 7 days of commits," most people will do that rather than opting out.

**Guardrails:**
- The generated receipt must reflect real work. No synthetic receipts.
- The default should be deletable — the user can discard the generated receipt if it doesn't represent a real ship.

---

### 4. Goal as Compass Heading (Ithaca)
**Mechanism:** Implementation intentions (Gollwitzer).

**What it is:** Users declare a qualitative goal — "Get one project to revenue." The goal appears in streak output and compass reflections.

**Why it works:** Implementation intentions ("I intend to X in context Y") dramatically increase follow-through vs. vague goals. The Ithaca goal makes the commitment explicit and visible at every scoring event.

**Guardrails:**
- The goal must be qualitative, not metric-based. "Ship 30 receipts" is a metric; "Get one project to revenue" is a compass heading.
- The system never tells the user they failed. It asks: "Are you still sailing toward Ithaca?"
- Goal is self-directed and can be changed or completed at any time.

---

### 5. DR Score Visibility at Decision Moment
**Mechanism:** Strategic reflectivism trigger.

**What it is:** The compass hook fires after each successful score, surfacing the user's declared goal and an LLM reflection at the exact moment they are most engaged (just shipped something).

**Why it works:** Strategic reflectivism interrupts automatic behavior with intentional reflection. The moment just after shipping is when a person is most receptive to examining whether their work is aligned with their long-term direction.

**Guardrails:**
- The LLM is a compass, not a judge. It asks questions; it does not score or rate the user's choices.
- Opt-in only — the compass hook requires explicit configuration.
- No dark patterns: the reflection cannot be designed to increase time-on-platform.

---

### 6. Social Proof via Co-Commitment (Guild)
**Mechanism:** Descriptive norms (Cialdini).

**What it is:** Guild mode makes each member's receipts visible to the group as evidence of commitment. No leaderboard, no rankings — only "did the group reach the milestone together?"

**Why it works:** Descriptive norms ("others like me do X") are more effective than injunctive norms ("you should do X"). Seeing peers ship makes shipping feel normal and achievable.

**Guardrails:**
- No leaderboard. Leaderboards convert social proof into social anxiety.
- No individual ranking within a guild. The group result is separate from individual scoring.
- Maximum 8 members. Above 8, accountability diffuses.

---

## Patterns We Will Never Implement

| Pattern | Mechanism | Why it's rejected |
|---|---|---|
| Streak punishment | Loss aversion exploitation | Punishes life; induces anxiety |
| Leaderboards | Social comparison | Produces anxiety spirals, not motivation |
| Variable-ratio reward schedules (loot boxes) | Operant conditioning | Addiction mechanic; exploits impulsivity |
| Timed urgency ("3x today only!") | Artificial scarcity | Manufactured FOMO; dishonest |
| Social shaming | Negative social proof | Anti-human; destroys intrinsic motivation |
| Infinite treadmill goals | Goalpost shifting | Burns out contributors; no satisfaction point |
| Micro-transactions | Pay-to-win | Undermines credibility of receipts |

---

## Importing These Patterns

Any product in the ecosystem that wants to implement nudges or gamification should:

1. Reference the named patterns above by name
2. Check the anti-patterns table before proposing a new mechanic
3. File an issue in this repo if a new pattern is needed (don't invent independently)

The pattern library is version-controlled. Updates are visible.

Closes #65
