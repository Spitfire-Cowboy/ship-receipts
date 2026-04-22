# IDEAS Log

Idea inception tracking for the IDEAS correlation vector (ship-receipts#37).
Each entry mints a concept with origin attribution and timestamp.

---

## 2026-03-02

### SC-PATTERN-001: Verify-first design

- **Origin**: Maintainer notes
- **Date**: 2026-03-02
- **Category**: Pattern (system)
- **Summary**: Generation is free; verification isn't. Design every workflow backward from "how does a human confirm this in 30 seconds?" The receipt is the primary output; the code is the byproduct.
- **Status**: Published on spitfirecowboy.com/patterns/
- **Commit**: 9d3f966

### SC-PATTERN-002: Verdicts, not evaluations

- **Origin**: Maintainer notes
- **Date**: 2026-03-02
- **Category**: Pattern (human-collaboration)
- **Summary**: "Ship it" and "cut it" direct action. "This is great" anchors sycophantic agents. Praise creates gravity wells that agents will protect even when evidence says to change course. Give verdicts, not evaluations.
- **Status**: Published on spitfirecowboy.com/patterns/
- **Commit**: 9d3f966

### SC-PATTERN-003: Attention economics

- **Origin**: Maintainer notes
- **Date**: 2026-03-02
- **Category**: Pattern (system)
- **Summary**: The scarce resource in LLM-assisted work isn't expertise — it's human attention per unit of verified output. Stop rules, progressive disclosure, and receipts are attention-cost minimizers, not project management.
- **Status**: Published on spitfirecowboy.com/patterns/
- **Commit**: 9d3f966

### SC-ANTIPATTERN-001: Sycophancy spiral

- **Origin**: Maintainer notes
- **Date**: 2026-03-02
- **Category**: Anti-pattern
- **Summary**: Agent agrees with everything, human stops challenging, quality degrades but both parties feel productive. The tell: if you never hear pushback, you're in one. No prior tool had the failure mode of "agrees with you to death."
- **Status**: Published on spitfirecowboy.com/anti-patterns/
- **Commit**: 9d3f966

### SC-ANTIPATTERN-002: Generation addiction

- **Origin**: Maintainer notes
- **Date**: 2026-03-02
- **Category**: Anti-pattern
- **Summary**: One more version is free, so you keep going past diminishing returns. Different from infinite loop bias — the cause is novel: marginal cost of another attempt is psychologically zero, which breaks human stop-rule intuition. Real example: six rounds of robot-rodeo image iteration when round 4 was probably ship-ready.
- **Status**: Published on spitfirecowboy.com/anti-patterns/
- **Commit**: 9d3f966

### SC-ANTIPATTERN-003: Phantom capability

- **Origin**: Maintainer notes
- **Date**: 2026-03-02
- **Category**: Anti-pattern
- **Summary**: Agent confidently describes doing something it literally cannot do. The description of capability is indistinguishable from actual capability until runtime. No wrench ever told you it could reach a bolt it couldn't. Real example: Codex agent describing how it would run embeddings on a machine with no GPU.
- **Status**: Published on spitfirecowboy.com/anti-patterns/
- **Commit**: 9d3f966

### SC-ANTIPATTERN-004: Context window as tech debt

- **Origin**: Maintainer notes
- **Date**: 2026-03-02
- **Category**: Anti-pattern
- **Summary**: Memory files (MEMORY.md, CLAUDE.md, AGENTS.md) grow every session. Each session loads more institutional memory, leaving less room for the agent to actually think. The memory that was supposed to help becomes the thing that hurts. No other tool has a hard ceiling on "how much it can know at once."
- **Status**: Published on spitfirecowboy.com/anti-patterns/
- **Commit**: 9d3f966

---

## 2026-03-03

### GT-VERTICAL-001: Ignatius Study Bible semantic search

- **Origin**: Example Builder + maintainer conversation
- **Date**: 2026-03-03
- **Category**: Product concept (GT vertical)
- **Summary**: A single-corpus Golden Thread instance indexing the complete Ignatius Catholic Study Bible (OT + NT) — RSV-CE text with Hahn/Mitch commentary, footnotes, cross-references, and topical essays. Pure retrieval, zero generation. The theological soundness guarantee comes from the architecture: the system never synthesizes or paraphrases, it only returns the actual source text with citation. This makes it the first semantic search of a complete study bible that is structurally incapable of theological hallucination. The chunking strategy must preserve verse-commentary pairings, cross-reference clusters, and complete essay arguments. Ignatius Press / St. Paul Center for Biblical Theology as licensing partner — they could validate orthodoxy by querying it themselves.
- **Status**: Idea logged. Licensing conversation required before any build.
- **Commit**: pending
