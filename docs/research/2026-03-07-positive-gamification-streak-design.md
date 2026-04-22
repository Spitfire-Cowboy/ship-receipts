# Positive Gamification Research Note for Streak Design

**Date:** 2026-03-07
**Author:** Codex via Rowan MCP
**Scope:** Research support for [issue #45](https://github.com/Spitfire-Cowboy/ship-receipts/issues/45), which proposes capping streak multipliers at 5 days and removing punitive reset behavior.

---

## Method

- Queried Rowan MCP `search_psyarxiv` on 2026-03-07 using: `gamification`, `self-determination`, `intrinsic motivation`, `autonomy`, `competence`, `relatedness`, and `habit`.
- Selected papers that directly inform point systems, autonomy support, manipulation risk, habit disruption, and interpretation of engagement metrics.
- This memo uses the Rowan MCP surface available in this execution lane. It complements, but does not reproduce, the earlier `coord:arxiv-positive-gamification-2026-03-01` ChromaDB/arXiv task.

---

## Bottom Line

The direction in issue #45 looks right.

The strongest design signal is not about exact numeric multipliers. It is about guardrails:

- cap streak rewards early
- avoid shame or punishment when a streak breaks
- preserve user choice and a sense of agency
- do not confuse retention with flourishing
- design the streak as lightweight competence feedback, not as a coercive loop

On that basis, a 5-day cap with no break penalty is a conservative and defensible move.

---

## Key Papers

### 1. Optimal Gamification of Self-Directed Learning

**Reena Pauly, Teshinee Kukamjad, Lovis Heindrich, Victoria Amo, Falk Lieder (2025)**  
DOI: https://doi.org/10.31234/osf.io/s4kqc_v1  
URL: https://osf.io/preprints/psyarxiv/s4kqc_v1/

Why it matters here:
A direct warning that point systems can optimize the wrong behavior. The paper argues that many gamified point systems accidentally incentivize behaviors that hurt the real objective.

Implication for ship-receipts:
Short, bounded streak bonuses are safer than long ladders. Reward the act of showing up and shipping, but avoid a scoring curve that pressures users to optimize the streak itself.

### 2. Decision Processes through Dungeons and Dragons: Meaningful Gamification using a Tabletop Roleplaying Game

**Julia Marianne Smith (2025)**  
DOI: https://doi.org/10.31234/osf.io/sh95j_v1  
URL: https://osf.io/preprints/psyarxiv/sh95j_v1/

Why it matters here:
The paper frames "meaningful gamification" around freedom, choice, and narrative coherence rather than raw reward schedules.

Implication for ship-receipts:
The streak system should feel like a progress marker, not a leash. Copy and UX should emphasize momentum, craft, and continuity rather than pressure or loss aversion.

### 3. A Unifying Framework to Understand Digital Autonomy

**Georgia Turner, Amy Orben (2026)**  
DOI: https://doi.org/10.31234/osf.io/bufmv_v2  
URL: https://osf.io/preprints/psyarxiv/bufmv_v2/

Why it matters here:
The paper argues that digital autonomy is not only about helping people execute current goals, but also about keeping those goals free from manipulation.

Implication for ship-receipts:
Do not design streaks that make users feel trapped into shipping when rest, weekends, or slower seasons would be healthier. Early caps and clean resets reduce manipulation risk.

### 4. Trait Questionnaires or Ambulatory Assessment? Predictive Validity of Within-Person Effects of Need Fulfillment on Well-Being

**Joana Thiel, Anne Grunert, Andreas Neubauer (2026)**  
DOI: https://doi.org/10.31234/osf.io/5dbqj_v3  
URL: https://osf.io/preprints/psyarxiv/5dbqj_v3/

Why it matters here:
The paper reinforces the self-determination theory frame: autonomy, competence, and relatedness are tied to well-being and dropout risk.

Implication for ship-receipts:
If streaks are kept at all, they should reinforce competence without undermining autonomy. A small, bounded bonus is more consistent with that balance than a 30-day climb.

### 5. All BANG, little buck: Need-related experiences are weakly linked with behavior in the video game domain

**Nick Ballou, Tamas Andrei Foldes, Matti Vuorre, Thomas Hakman, Kristoffer Magnusson, Andrew K Przybylski (2026)**  
DOI: https://doi.org/10.31234/osf.io/wqr6u_v2  
URL: https://osf.io/preprints/psyarxiv/wqr6u_v2/

Why it matters here:
The paper finds a weak link between reported need satisfaction and observed gameplay behavior.

Implication for ship-receipts:
Do not treat streak retention as proof that the system is psychologically healthy. Track human outcomes separately from streak length.

### 6. Disrupting Digital Habits Among Danish Adolescence: Evidence from 1.2 Million Social Media Interactions

**Lasse Hyldig Hansen, David Joachim Gruning, Andreas Maaloe Jespersen, Frederik Riedel, Catrine Normann (2026)**  
DOI: https://doi.org/10.31234/osf.io/ruvp3_v1  
URL: https://osf.io/preprints/psyarxiv/ruvp3_v1/

Why it matters here:
Reintroducing decision points reduced unintentional, habit-driven engagement without harming well-being.

Implication for ship-receipts:
After a missed day, the product should reintroduce a conscious choice to resume rather than trying to preserve automatic compulsion. Reset is fine; coercion is not.

### 7. Enhanced Expectancies by Generic Positive Feedback Do Not Influence the Learning of a Form-Based Motor Skill in Gymnastics

**Bianca Maria Laroere, Jiri Mudrak, Roman Malir, Takehiro Iwatsuki, Vit Trebicky (2026)**  
DOI: https://doi.org/10.31234/osf.io/ufesa_v1  
URL: https://osf.io/preprints/psyarxiv/ufesa_v1/

Why it matters here:
Generic positive feedback did not improve learning outcomes in this study.

Implication for ship-receipts:
Do not assume that cheerful streak copy or generic praise is doing the heavy lifting. The structure of the incentive matters more than hype language.

---

## Recommended Design Constraints for Issue #45

1. Keep the streak ceiling low.
A max bonus at 5 days is easier to defend than a 14- or 30-day ladder because it reduces compulsion pressure and narrows the gaming surface.

2. Breaks should reset, not punish.
Returning to `1.0x` is enough. Avoid debt, cooldown penalties, shame text, or negative multipliers.

3. Treat streaks as light encouragement, not the product's main reward loop.
The core reward should still be shipping verifiable work. The streak should remain secondary.

4. Preserve autonomy in copy and flow.
Use language like "resume" or "start a new run" instead of loss-framed copy. Missing a day should feel clean, not moralized.

5. Avoid stacking pressure systems.
Do not combine streaks with scarcity timers, leaderboards, or escalating social comparison without a separate abuse review.

6. Measure health separately from retention.
If this ever ships to users, evaluate well-being, perceived pressure, and voluntary usage alongside streak completion.

---

## What This Supports in #45

This research supports the following parts of the issue:

- reducing the streak horizon from 30 days to 5 days
- keeping the baseline at `1.0x`
- removing punishment for broken streaks
- treating the change as a human-flourishing decision, not merely a balance tweak

This research does **not** strongly justify the exact proposed numeric curve (`1.1x`, `1.25x`, `1.5x`). Those values are reasonable product choices, but the evidence here is much stronger for the cap-and-no-punishment policy than for the precise coefficients.

---

## Risks and Limits

- These are mostly PsyArXiv preprints, not yet final peer-reviewed publications.
- The evidence is adjacent rather than exact; there is little direct literature on OSS shipping streaks specifically.
- Several relevant papers are about education, games, or digital habits rather than developer tooling.
- The current Rowan MCP surface exposed PsyArXiv search directly; it did not expose the original ChromaDB/arXiv query interface used by the source coordination task.

---

## Recommended Next Step

Use this memo as the rationale for the issue #45 redesign, then change both Python and TypeScript streak tiers in a separate implementation PR with tests and spec updates.
