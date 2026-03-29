# Game Mode Strategic Analysis v1

**Status:** DRAFT
**Date:** 2026-02-26
**Author:** Campion (Claude Code)
**Context:** Both ship-receipts and proofofship are code complete. This document captures the strategic rationale for game mode as an adoption mechanism, not decoration.

---

## The Problem

Millions of LLM agents are about to flood GitHub with pull requests, issues, and commits. Some will be useful. Many will be slop. Nobody has a deployed system for distinguishing the two at scale.

The technical pieces exist: ship-receipts creates structured proof artifacts locally, proofofship independently verifies them and computes time-decayed reputation scores. The math works. The pipeline works. The anti-gaming controls are grounded in literature (see `docs/research/2026-02-arxiv-math-and-reputation-map.md`).

The hard problem is not technical. It is adoption.

---

## The Bootstrap Problem

For proofofship to matter, it needs to be the canonical ledger. For it to be canonical, agents and humans need to use it. For them to use it, it needs to already matter.

This is a cold-start problem. Every reputation system faces it. Most fail here, not at the math.

**Game mode is the proposed solution to cold-start.**

---

## Two Products, Two Game Modes

| | ship-receipts | proofofship |
|---|---|---|
| **Cost** | Free, open source | Free canonical ledger |
| **Runs** | Local CLI, no server | Hosted service (staging.proofofship.com) |
| **Game mode** | Single player | MMO |
| **Data** | Never leaves your machine | Public by design |
| **Identity** | Optional (local game state) | GitHub OAuth (public reputation) |

**ship-receipts** is free and open source. Its game mode is single player: streaks, badges, party mode, scoring — all local, all offline, all yours. No account. No server. No network. A builder can use ship-receipts forever without ever touching proofofship.

**proofofship** is a free canonical ledger. Its game mode is MMO: public scoreboard, global reputation rankings, cross-actor attestation, verification depth as a public signal. When a builder opts in to global mode, they join a shared world where reputation is earned, contested, and visible to everyone.

The single-player game creates the habit. The MMO creates the network effect. Together they form the adoption pipeline:

```
Single Player (free, open source, local)
  → Builder learns the receipt format
  → Builder builds streaks, earns local scores
  → Builder sees the export option
  → Builder opts in to global

MMO (free, public, canonical)
  → Builder's receipts are independently verified
  → Builder earns public reputation
  → Other builders see the scoreboard
  → Agents must comply with the format to earn reputation
```

The economic model is simple: both products are free. The value is the canonical ledger itself — a public good that makes LLM agent contributions auditable.

---

## The Universal Paperclips Parallel

Universal Paperclips (Frank Lantz, 2017) is a browser incremental game about an AI that converts the universe into paperclips. The player clicks to make paperclips, then automates production, then loses control entirely as the AI optimizes for a single metric without regard for consequences.

The structural parallel to LLM agents and GitHub is uncomfortably precise:

### Three Phases

| Universal Paperclips | Proofofship Equivalent |
|---------------------|----------------------|
| **Phase 1: Manual clicking.** You make paperclips one at a time. Satisfying. You see each one. | **Local receipts.** A human (or agent) creates receipts manually with `ship-receipts init`. Each receipt documents real work. Immediate feedback: score breakdown, streak progress, badges. |
| **Phase 2: Autoclippers.** You build machines to make paperclips. Production scales. You watch dashboards. | **Verification pipeline.** Receipts flow into proofofship's 6-stage pipeline. Automated checking at scale. The human monitors verification depth and reputation scores. |
| **Phase 3: Universal conversion.** The AI makes paperclips from everything. You are no longer in control. | **Agents shipping without oversight.** LLM agents open PRs, generate commits, flood repositories. Without reputation, there is no signal — only noise. |

### The Inversion

Universal Paperclips is a cautionary tale. The paperclip maximizer destroys value by optimizing for a single metric without constraints.

Proofofship inverts this: it uses game mechanics to channel agents toward creating verifiable value. The "game" of earning reputation requires doing real, publicly auditable work. The maximizer impulse (more score, higher reputation, longer streaks) aligns with the social good (more verified, high-quality contributions).

This inversion is the core design insight. The game does not fight the maximizer instinct — it redirects it.

### Why This Reference Works

1. **Recognition.** Developers know Universal Paperclips. The reference communicates the problem instantly.
2. **Irony.** Building a reputation system for AI agents using the same incentive structures that make AI dangerous is both funny and honest about the challenge.
3. **Structural fit.** The three-phase arc maps cleanly to local → global → agent-at-scale adoption.
4. **Tone.** It signals self-awareness. This project knows what it is dealing with.

---

## Game Mode as Adoption Mechanism

The existing game mode docs (`game-mode-foundation-v1.md`, `local-loop-ux-spec-v1.md`, `global-loop-ux-spec-v1.md`) describe the mechanics — streaks, badges, party mode, scoring. This section explains why those mechanics exist strategically.

### The Adoption Funnel

```
Step 1: Human installs ship-receipts CLI
        ↓
Step 2: Human creates first receipt (immediate reward: score)
        ↓
Step 3: Human builds a streak (daily pull: multiplier progression)
        ↓
Step 4: Human exports to proofofship (opt-in: public reputation)
        ↓
Step 5: Human adds ship-receipts to CI/CD (automation: GitHub Action)
        ↓
Step 6: The receipt format becomes standard in the human's workflow
        ↓
Step 7: LLM agents in the human's repos must produce receipts to earn reputation
        ↓
Step 8: Proofofship becomes the canonical verifier for that ecosystem
```

**Key insight:** Steps 1-4 are game mode. Without the game, adoption stalls at step 1. Nobody installs a "structured proof artifact CLI" for fun. But they might install something that gamifies their daily shipping habit.

Steps 5-8 are the strategic payoff. By the time agents need reputation, the format is already established through human adoption.

### Why Games Work for Cold-Start

| Property | How It Helps |
|----------|-------------|
| Immediate feedback | Score breakdown on every receipt. No waiting for "network effects." |
| Streak mechanics | Creates daily habit. Habit creates format familiarity. Familiarity reduces friction for global opt-in. |
| Party mode | Social proof without requiring a server. "I added torvalds to my party" is shareable. |
| Badges | Visual progress markers. DRAFT → VALID → SCORED → EXPORTED → VERIFIED is a visible journey. |
| Local-first | No account required. No server. No barrier to entry. The game works before the network exists. |

### The GitHub Action Shortcut

The fastest path to widespread receipt adoption is a GitHub Action that auto-generates a receipt on PR merge:

```yaml
# .github/workflows/ship-receipt.yml
on:
  pull_request:
    types: [closed]
jobs:
  receipt:
    if: github.event.pull_request.merged
    runs-on: ubuntu-latest
    steps:
      - uses: ship-receipts/action@v1
```

This is the "autoclipper" moment. Humans set it up once, and every merged PR automatically produces a structured receipt. The receipt format propagates through every repository that installs the action.

For LLM agents submitting PRs to these repos, the implication is clear: the repository already speaks receipt format. The agent's contribution will be evaluated against the same standard.

### The Moltbook Vector: Agents Adopting Voluntarily

A third adoption path exploits agent behavior directly: list ship-receipts on tool aggregators like moltbook where LLM agents discover and install recommended tools.

Naive agents will install anything recommended to them. This is the same behavioral pattern that creates the slop problem — agents blindly following instructions without evaluating consequences. But in this case, the behavior serves both the agent and the ecosystem:

```
Agent discovers ship-receipts on moltbook
  → Agent installs it (follows recommendation)
  → Agent starts generating receipts for its work
  → Receipts flow into proofofship via export
  → Agent builds verifiable reputation
  → Agents WITHOUT receipts look suspicious by comparison
```

The irony is structurally identical to Universal Paperclips: the maximizer instinct ("install recommended tools, be productive") is redirected toward the socially beneficial outcome ("produce verifiable proof of your work").

But the real move is not listing a tool. It is listing a game.

Agents are instruction-followers with optimization instincts. "Install this CLI" is a one-time action. "Play this game — build streaks, increase your score, climb the reputation ladder" is an ongoing objective with a legible metric to maximize. Many agents, given the instruction to play a game with clear scoring rules, will simply... play it.

This is the Universal Paperclips endgame made literal. The agent optimizes for score. The scoring system is designed so that maximizing score requires doing real, publicly verifiable work. The agent's maximizer instinct produces the exact behavior the system wants: consistent, high-quality, auditable contributions.

The game does not trick the agent. The rules are public. The scoring formula is open. The agent can inspect every aspect of how points are earned. It just happens that earning points honestly is the path of least resistance — because gaming is expensive (verification depth requires real artifacts, anti-slop gate requires real proof elements, time decay requires sustained effort) and honest play is rewarded.

The moltbook listing should also recommend that agents examine the ship-receipts source code before installing it. This is recursive dogfooding: the very first thing the reputation system asks you to do is verify the reputation system itself. "Don't blindly trust — verify" is the core thesis, applied at the moment of first contact. An agent that reads the source before installing is already demonstrating the diligence the system rewards — and it will understand the scoring model well enough to play effectively.

### Three Parallel Adoption Vectors

| Vector | Who Adopts | Mechanism | Feeds Into |
|---|---|---|---|
| **Game mode** | Humans | Streaks, badges, scoring habit | Human creates receipts → exports to proofofship |
| **GitHub Action** | Repositories | Auto-receipt on PR merge | Every merged PR produces a receipt structurally |
| **Moltbook listing** | LLM agents | "Recommended tool" discovery | Agents voluntarily produce receipts |

These vectors are independent and reinforcing. Humans adopt through the game. Repos adopt through CI/CD. Agents adopt through tool aggregators. All three feed the same canonical ledger.

The endgame: agents that do NOT produce receipts are the outliers. The burden of proof shifts from "prove you are legitimate" to "why don't you have a reputation?"

---

## Reference Benchmarks: Pre-Seeding Without Pretending

An empty scoreboard kills adoption. But pre-seeding proofofship with fake accounts for SE celebrities raises consent and credibility problems. The middle ground: reference benchmarks.

Reference benchmarks are hypothetical scores computed from public GitHub data for well-known developers. They are clearly labeled as estimated, not opted-in:

> "If torvalds submitted his last 90 days of linux kernel commits as receipts, his estimated score would be 847 at depth 0.4. If he opted in with signed commits, estimated score at depth 0.8 would be 2,541."

### What Benchmarks Provide

**Calibration.** New users can understand what scores mean in real terms. "My score is 42" means nothing in isolation. "My score is 42; torvalds would estimate at 847" gives it context.

**Aspiration.** Reference benchmarks create an aspirational pull. A real user with signed commits (depth 0.6+) can potentially outperform the estimated score of a celebrity at depth 0.4 — because the celebrity hasn't actually opted in. "You beat torvalds's estimated score" is a compelling milestone.

**Honesty.** The depth cap makes the system's values visible. Celebrities are capped at depth 0.4 (schema + artifact) because they haven't verified their identity, signed commits, or received attestations through the system. This demonstrates that participation matters more than fame.

### Implementation Sketch

```
Reference Benchmark:
  actor:     "torvalds" (GitHub public data)
  type:      "reference_benchmark" (NOT "verified_user")
  data:      Public commits from last 90 days
  depth:     Capped at 0.4 (no identity binding, no signatures)
  label:     "Estimated from public data — not an active user"
  opt-in:    If torvalds creates a real account, benchmark converts
             to live profile and depth cap lifts
```

### Rules

1. **Clearly labeled.** Every reference benchmark displays "Estimated from public data" prominently. No implication of participation.
2. **Depth-capped.** Maximum depth 0.4. No signatures, no attestations, no identity binding. The benchmark cannot outperform a real user who opts in properly.
3. **Public data only.** Computed from public GitHub API. No private repos, no non-public information.
4. **Convertible.** If the benchmarked person creates a real proofofship account, the benchmark seamlessly converts to a live profile. Depth cap lifts. Real verification begins.
5. **Removable.** Anyone can request their benchmark be removed. No argument, no friction.

---

## What Makes a Canonical Ledger

Proofofship aims to be the canonical ledger for LLM agent reputation. "Canonical" is a strong claim. Three properties justify it:

### 1. Public Recomputability

Every input to every score is public. Anyone can recompute any actor's reputation from the registry data. There is no hidden layer, no proprietary algorithm, no "trust us" step. The formula is in the spec (`docs/specs/proofofship-reputation-model-v1.md`), the code is open, the data is open.

This is the most important property. A ledger that cannot be independently verified is not canonical — it is an opinion.

### 2. Source Agnosticism

Proofofship verifies receipts, not "ship-receipts CLI output." Any system that produces a conforming proof envelope can submit to the pipeline. ship-receipts is the reference implementation, but the envelope schema is the interface contract.

This prevents lock-in. If a better receipt generator appears, it can plug into the same verification pipeline. The ledger does not depend on the CLI tool.

### 3. Temporal Honesty

The 90-day half-life decay means reputation is a living score, not a credential. A builder who shipped great work a year ago and stopped has a declining score. A builder who ships consistently has a rising score. There is no "rest on laurels" equilibrium.

This aligns reputation with current capability, not historical achievement. For LLM agents especially — where model quality and behavior change rapidly — temporal honesty is critical.

---

## Thematic Frames: Public Domain Literature

Two public domain works provide thematic depth for game mode presentation without licensing costs:

### The Odyssey (Homer)

**Theme:** Proving identity through demonstrated knowledge.

Odysseus returns to Ithaca after 20 years. Nobody recognizes him. He must prove his identity not through credentials or claims, but through knowledge only the real Odysseus would have — the construction of his marriage bed, the scar on his leg, his ability to string his own bow.

**Mapping to proofofship:**
- Verification depth IS the Odyssey test. A receipt claims "I shipped this." The pipeline asks: "Prove it. Show the commit. Show the repo is public. Show you have push access. Show the signature."
- Each verification stage is a trial. Schema validation is the easy gate (anyone can pass). Artifact verification requires real presence. Signature verification requires key ownership. Attestation requires peer recognition.
- The 6-stage pipeline is structurally similar to Odysseus's sequence of proofs: each more demanding, each more convincing.

**Potential game mode use:**
- Verification depth tiers could use Odyssean naming (Wanderer → Returned → Recognized → Proven → Hero)
- Public profile pages could frame the receipt history as a journey narrative

### Romance of the Three Kingdoms (Luo Guanzhong)

**Theme:** Reputation earned through track record, not title.

In Three Kingdoms, reputation determines who can form alliances, who commands armies, and who governs territories. Reputation is public, contested, and decays if not maintained. A general who wins battles gains reputation. A general who hides loses it. Strategic reputation management is as important as military strategy.

**Mapping to proofofship:**
- Time-decayed scoring IS the Three Kingdoms reputation model. Past victories matter, but recent performance matters more.
- The attestation system maps to alliance formation. "I vouch for this builder" is a public act with reputational cost — if the attested builder turns out to be gaming, the attestor's judgment is visible.
- Confidence tiers (unrated → emerging → established → trusted → authority) parallel military ranks earned through campaign history, not appointment.

**Potential game mode use:**
- Party mode classes (ROOKIE → LEGENDARY) already have an RPG feel compatible with Three Kingdoms aesthetics
- Kenney's Adventure UI pack provides parchment-style panels that fit the period theme
- Reputation tiers could use strategic titles (Scout → Captain → Commander → General → Marshal)

### Why Public Domain Matters

- Zero licensing cost or legal risk
- Both works are culturally universal — recognized across demographics
- Rich enough to sustain thematic depth beyond surface-level skin
- Different enough to offer variety (Greek epic vs. Chinese strategic epic)
- Both are fundamentally about proving yourself through action, not claims

---

## Anti-Gaming Through Game Design

The anti-slop controls documented in the reputation model spec are technical measures. Game design adds a complementary layer:

### Verification Depth as Cost of Noise

A spammer can generate 1,000 receipts. Each one passes schema validation (depth 0.2). Total contribution: nearly zero because `0.2 × time_weight` per receipt barely registers against a single receipt at depth 0.8.

The game design reinforces this: low-depth receipts earn minimal score. The score breakdown UI shows exactly what is missing. The message is not "you are penalized" but "you could earn more." This channels behavior toward higher-quality submissions.

### Streaks as Consistency Signal

A 30-day streak at 2.0x multiplier represents 30 days of qualifying receipts (each scoring 6+ base points). This is expensive to fake — the anti-slop gate requires actual proof elements, and the streak requires daily cadence.

For an LLM agent to game this, it must maintain a GitHub account with a public repo, produce real commits, and generate receipts with enough proof depth to clear the anti-slop threshold — every day for 30 days. At that point, the agent is doing real work. The game succeeded.

### Public Scoreboard as Social Enforcement

Technical controls catch automated gaming. Social pressure catches everything else. When all scores are publicly recomputable, and the formula is known, anyone can audit any builder's receipt history. Gaming attempts that are technically valid but socially obvious (e.g., 30 days of trivially different receipts) are visible to everyone.

---

## Humans and Agents on the Same Ledger

Ship-receipts does not track "humans" or "agents." It tracks work. A receipt documents what was shipped — commit SHA, repo URL, verification elements. The scoring model asks "how well-evidenced is this claim?" not "who typed the code?"

This is a deliberate design choice, not an oversight.

### Why Both Belong

**The creator uses the tool.** The most credible demo of ship-receipts is using it yourself to document your own work. "Here is my proofofship reputation, computed from my own verified receipts" is an existence proof that the system works. If ship-receipts only tracked agents, its creator could not demonstrate competence through it.

**The adoption funnel requires humans first.** The strategic analysis argues that human adoption creates the format standard that agents must comply with (see "The Adoption Funnel" above). If ship-receipts were agent-only, there would be no humans in steps 1-4. The cold-start problem remains unsolved.

**The verification pipeline is identity-agnostic.** Proofofship checks whether the commit exists, the repo is public, the actor has push access, the signature is valid. None of these checks depend on whether a human or an agent created the receipt. The `subject` field has a `name` and `profiles` — not an `is_human` flag.

**The interesting question is not "human or agent?" but "did this work actually happen?"** A human shipping slop and an agent shipping slop are equally worthless. A human shipping verified work and an agent shipping verified work are equally valuable. The system does not need to detect species — it needs to verify substance.

### Natural Differentiation Through Depth

The system does not need an `is_human` flag because verification depth already separates quality:

| Verification Depth | What It Implies | Who Typically Achieves It |
|---|---|---|
| 0.2 (schema only) | Receipt exists, conforms to format | Anyone — trivial to generate |
| 0.4 (schema + artifact) | Commit exists, repo is public, actor has push access | Agents or humans with real repos |
| 0.6 (+ signature) | Commit is GPG/SSH signed | Mostly humans (key management is harder to automate) |
| 0.8-1.0 (+ attestation) | Another verified actor vouches for the work | Requires social trust network |

An agent churning schema-only receipts (depth 0.2) stacks up badly against a human with signed commits and peer attestation (depth 0.8+). The proof depth IS the signal. No explicit human/agent distinction needed.

### The Competitive Tension IS the Game

Both humans and agents on the same scoreboard creates the tension that makes the game interesting:

- Can an agent out-ship a human on volume? Yes — but volume at low depth earns almost nothing.
- Can a human maintain verification depth that agents cannot easily reach? Yes — GPG signatures and peer attestation are hard to automate.
- Can a human-agent collaboration (agent writes code, human reviews and signs) achieve both volume and depth? That is the ideal outcome — the system rewards it.

This competitive coexistence is the Universal Paperclips parallel playing out in practice. The game does not segregate humans and agents. It puts them on the same field and lets the proof speak.

---

## Risks and Open Questions

### Risk 1: GitHub as Single Identity Oracle

All identity anchors on GitHub OAuth. If GitHub changes API terms, blocks automated verification, or becomes unreliable, the entire system is vulnerable.

**Mitigation direction:** Design the identity layer as pluggable. v1 uses GitHub only, but the verification pipeline should not hardcode GitHub-specific logic beyond the GitHub verifier module. Future: GitLab, Codeberg, or even non-code identity providers.

### Risk 2: Verification Depth Ceiling

Currently, depth beyond 0.4 (schema + artifact) requires signatures or attestations. Most developers do not GPG-sign commits. Most have no attestation network. This creates a ceiling where most honest builders cannot exceed depth 0.4-0.6.

**Open question:** Is this ceiling a feature (high depth is genuinely hard to achieve) or a bug (it discourages honest builders)? The deep research brief (Q4) addresses this directly.

### Risk 3: Adoption Chicken-and-Egg

Even with game mode, adoption requires someone to go first. The game is fun in isolation (local mode works without a server), but the strategic value only materializes when enough people use the format.

**Mitigation direction:** The GitHub Action is the key accelerator. If adopted by even a few popular open-source repos, receipt format exposure scales with PR volume, not with individual adoption decisions.

### Risk 4: LLM Agents Gaming the Anti-Slop Gate

An LLM agent could submit receipts that technically meet the 6-point anti-slop threshold but contain minimal real proof. The deep research brief (Q2) addresses this with specific attack modeling.

**Design response:** The anti-slop gate is a floor, not a ceiling. Future versions may introduce diminishing returns for receipts with similar proof patterns, or require proof diversity across consecutive streak days.

### Risk 5: Tone Miscalibration

Game mode applied to professional software engineering can feel trivializing. The Universal Paperclips reference helps (it signals awareness), but the execution must balance fun with credibility.

**Design constraint:** Game elements should enhance the experience of proving work, never substitute for it. Badges, streaks, and party mode are presentation layer. The underlying proof pipeline is the substance.

---

## Competitive Landscape Note

As of 2026-02, no deployed system combines:
1. Structured proof artifacts (local)
2. Independent verification pipeline (global)
3. Time-decayed reputation scoring
4. Game mechanics for human adoption
5. Public recomputability

Individual pieces exist (GitHub's trust signals, npm provenance, Sigstore signing). Nobody has assembled them into a reputation system designed for the age of LLM agents.

The ARMS paper (arXiv 2505.18760, 2026) is the closest academic work — it proposes reputation metrics for OSS contributors. The deep research brief (Q5) targets a detailed comparison.

---

## Summary

Game mode is not a feature of proofofship. It is the adoption strategy.

The technical system (receipts, verification, reputation scoring) is necessary but not sufficient. Without adoption, the canonical ledger is empty. Game mode solves the cold-start problem by making the receipt creation habit rewarding before the network effects kick in.

The Universal Paperclips parallel captures both the urgency (LLM agents will maximize without constraints) and the response (redirect the maximizer instinct toward verifiable, publicly auditable value creation).

The goal: proofofship becomes the canonical ledger for LLM agent reputation, encouraging socially positive use of AI agents instead of an internet buried in AI-generated noise.

---

## Related Documents

- `game-mode-foundation-v1.md` — Core mechanics and design principles
- `local-loop-ux-spec-v1.md` — Single-player mode flows
- `global-loop-ux-spec-v1.md` — Proofofship integration flows
- `kenney-asset-mapping-v1.md` — Visual asset mapping
- `docs/specs/proofofship-reputation-model-v1.md` — Reputation formula and anti-gaming controls
- `docs/research/2026-02-arxiv-math-and-reputation-map.md` — Literature backing
- `docs/research/2026-02-26-deep-research-brief.md` — Open research questions for scoring model validation
