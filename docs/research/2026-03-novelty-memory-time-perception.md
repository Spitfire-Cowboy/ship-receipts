# Research Note: Novelty, Memory, and Time Perception

**Issue:** #61

---

## Question

How does novelty affect human memory and perception of time? How can we apply that to ship-receipts or to how humans and LLM agents interact?

---

## Key findings from literature

### Novelty and memory encoding (Tulving, Desimone)

- Novel stimuli trigger dopamine release in the hippocampus, which strengthens memory encoding.
- Repeated exposure to the same stimuli reduces encoding strength (habituation). This is why routine days feel short in retrospect — they produce fewer distinct memory traces.
- **Implication:** Each new receipt type, kind, or artifact creates a stronger memory trace than the fifth routine commit receipt. Variety in what you ship may affect how you remember the period.

### Time perception and event segmentation (Zacks, Tversky)

- Humans segment continuous experience into discrete events. Event boundaries (new context, new activity) reset the subjective clock.
- Dense novelty = many event boundaries = subjective time feels longer (richer, more eventful).
- **Implication:** Ship-receipts may inadvertently make time feel denser by creating explicit event boundaries (each receipt = an event).

### Applied to LLM agents

- LLM agents running in long sessions may exhibit "session fatigue" — declining novelty_rate as the session progresses (confirmed by DR diagnostics).
- Surfacing novel receipts vs. routine ones could be a signal for when to rotate agent context or start a new session.
- The DR `novelty_rate` metric is a rough proxy for this — it measures how much new semantic content is being produced vs. repeated.

---

## Potential ship-receipts applications

1. **Receipt diversity score**: reward shipping receipts of different kinds in a window (repo + demo + community_contribution > three repos)
2. **Time perception as a feature**: a monthly summary showing receipt count and diversity could make the month feel richer/more eventful
3. **Novelty signal in wellness export**: include `receipts_unique_kinds_today` in the wellness signal to help game clients understand variety vs. routine

---

## Sources to review

- Tulving, E. (1972). Episodic and semantic memory.
- Zacks, J. M., & Tversky, B. (2001). Event structure in perception and conception.
- Desimone, R. (1996). Neural mechanisms for visual memory and their role in attention.
- PsyArXiv: positive gamification research (already in docs/research/)
