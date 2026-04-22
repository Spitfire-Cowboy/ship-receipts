# PsyArXiv Research Note: Health, Wellbeing, Exercise, and Habit Formation Outcomes for Gamification

**Date:** 2026-03-07
**Author:** Codex
**Scope:** Evidence relevant to [issue #45](https://github.com/Spitfire-Cowboy/ship-receipts/issues/45) and the broader "human thriving, not grinding" design goal in ship-receipts.

---

## Method

This note follows source task `coord:arxiv-gamification-health-2026-03-01`.

The original coordination task referenced a ChromaDB `arxiv-meta-v0` query path. In this execution lane, the exposed Rowan MCP surface was `search_psyarxiv`, so the search was run against PsyArXiv rather than the original local arXiv metadata collection.

### Exact composite queries attempted

All of the following returned **0 PsyArXiv hits** via Rowan MCP:

- `gamification health wellbeing exercise habit formation`
- `gamification exercise physical activity self determination theory`
- `habit formation gamification wellbeing motivation autonomy`
- `physical activity motivation`
- `exercise motivation autonomy`
- `habit formation wellbeing`
- `gamification motivation`

### Broad fallback queries used

These broader queries returned usable adjacent literature:

- `gamification` -> 47 total PsyArXiv results
- `exercise` -> 579 total PsyArXiv results
- `habit` -> 754 total PsyArXiv results
- `wellbeing` -> 972 total PsyArXiv results
- `self determination` -> 1 total PsyArXiv result

Result: the evidence below is **adjacent rather than exact**. It is still useful for design direction, but it does not justify precise multiplier tuning on its own.

---

## Selected Papers

### 1. Exercise adherence seems less sensitive to motivation-profile segmentation than expected

- **Paper:** [Similar exercise adherence and physical fitness outcomes are observed across distinct motivation profiles in older adults participating in a home-based structured exercise programme](https://osf.io/preprints/psyarxiv/gk74p_v2/)
- **Authors:** Alexandra Munns, Jack Feron, Joan Duda, Sindre Fosstveit, Kelsey E. Joyce, Foyzul Rahman, Linda Wheeldon, Hilde Lohne Seiler, Sveinung Berntsen, Jet Veldhuijzen van Zanten
- **Why it matters:** The title and abstract framing suggest that distinct psychological motivation profiles did **not** lead to meaningfully different adherence and fitness outcomes in a structured home exercise program.
- **Implication for ship-receipts:** Do not overfit the product to personality-specific reward ladders. Consistent, low-friction participation may matter more than elaborate user segmentation.

### 2. Reintroducing decision points can interrupt unhealthy habits without a wellbeing penalty

- **Paper:** [Disrupting Digital Habits Among Danish Adolescence: Evidence from 1.2 Million Social Media Interactions](https://osf.io/preprints/psyarxiv/ruvp3_v1/)
- **Authors:** Lasse Hyldig Hansen, David Joachim Gruning, Andreas Maaloe Jespersen, Frederik Riedel, Catrine Normann
- **Why it matters:** The abstract preview reports a randomized field experiment testing whether reintroducing decision points at access moments can reduce unintentional, habit-driven engagement, while noting a goal of doing so without harming wellbeing.
- **Implication for ship-receipts:** Healthy gamification should not maximize automatic continuation. It should create intentional re-entry points, clean resets, and opportunities to choose the next action deliberately.

### 3. Point systems can help, but they can also incentivize the wrong behavior

- **Paper:** [Optimal Gamification of Self-Directed Learning: A Computational Method and its Real-World Evaluation in an App for Learning English](https://osf.io/preprints/psyarxiv/s4kqc_v1/)
- **Authors:** Reena Pauly, Teshinee Kukamjad, Lovis Heindrich, Victoria Amo, Falk Lieder
- **Why it matters:** The abstract explicitly states that many point systems inadvertently incentivize unintended behaviors that hurt learning outcomes.
- **Implication for ship-receipts:** Reward functions must stay tightly coupled to the target behavior. If the goal is sustainable shipping and human thriving, the scoring system should avoid rewarding mere activity volume, compulsive check-ins, or fear-driven streak preservation.

### 4. "Meaningful gamification" appears strongest when autonomy and narrative are preserved

- **Paper:** [Decision processes through Dungeons and Dragons: Meaningful gamification using a tabletop roleplaying game](https://osf.io/preprints/psyarxiv/sh95j_v1/)
- **Author:** Julia Marianne Smith
- **Why it matters:** The abstract preview says gamelike elements can improve engagement and motivation especially when they involve freedom, choice, and storytelling.
- **Implication for ship-receipts:** The Odyssey framing is directionally consistent with the evidence, but only if it preserves agency. The system should feel like self-authored travel, not externally imposed compliance.

### 5. Future-self interventions can strengthen orientation, but behavior transfer is not automatic

- **Paper:** [The Day Preconstruction Method: A novel method to strengthen Future Self-Continuity](https://osf.io/preprints/psyarxiv/6btk2_v1/)
- **Authors:** Jonas Hjalmar Blom, Per Kristensson, Erik Wastlund
- **Why it matters:** The abstract preview reports four preregistered randomized experiments and says the intervention reliably increased future self-continuity. The same preview also suggests weak or limited transfer to some downstream behavioral outcomes.
- **Implication for ship-receipts:** Reflection and future-self framing may help users stay oriented to long-term goals, but those cues should supplement, not replace, concrete design choices that reduce friction and compulsion.

### 6. Gamification can boost participation while still failing the long game

- **Paper:** [Gamification of Medical School Formative Assessments](https://osf.io/preprints/psyarxiv/ah4ev_v1/)
- **Authors:** Muhammad R. Irfan, Maheen Qureshi, Fesih Muhammad Waseem
- **Why it matters:** The abstract preview reports improved participation and discussion, but also emphasizes limitations in sustaining engagement.
- **Implication for ship-receipts:** Short-term engagement spikes are not enough. The right test is whether the mechanic remains humane and useful after novelty wears off.

### 7. Autonomy remains the right north star, even where direct gamification evidence is sparse

- **Paper:** [자율적인 기능하기 척도 타당화 연구](https://osf.io/preprints/psyarxiv/29ua4_v1/)
- **Author:** Bomi SONG
- **Why it matters:** This is not an intervention study, but it is a useful construct reference. The abstract frames autonomous functioning in terms of self-congruence, interest-taking, and low susceptibility to control.
- **Implication for ship-receipts:** If the product is meant to support human flourishing, mechanics that increase felt control pressure are suspect even when they improve raw engagement.

---

## Synthesis

The strongest signal from this search is not "gamification works" in the abstract. It is narrower:

1. **Autonomy-preserving designs are more defensible than pressure-based designs.**
2. **Decision points and reset moments matter.** Friction is not always bad; sometimes it protects users from sliding into habit loops they did not choose.
3. **Short-term engagement is a weak success metric.** Some gamified systems increase participation while still creating distortions, burnout, or shallow proxy optimization.
4. **Behavioral outcomes should be judged separately from wellbeing outcomes.** A mechanic can increase activity while still being bad for the person.

For ship-receipts, that means the product should optimize for:

- short reward horizons
- clean streak resets with no shame mechanics
- copy that preserves choice and agency
- explicit alignment between score and meaningful progress
- willingness to trade some engagement for healthier long-run use

---

## Design Guidance for Issue #45

These findings do **not** pin down exact streak multipliers.

They do support the overall direction of [issue #45](https://github.com/Spitfire-Cowboy/ship-receipts/issues/45):

- cap the streak horizon early rather than stretching to 30 days
- avoid mechanics that punish weekends, illness, travel, or family life
- treat a broken streak as a neutral reset, not a loss event
- preserve the sense that the user is choosing the journey, not serving the scoreboard

A five-day cap is more defensible than a 30-day ladder because it rewards rhythm without training users to protect the number at the expense of the life the tool is supposed to serve.

---

## Risks and Limits

- This memo is based on **PsyArXiv preprints**, not a full peer-reviewed systematic review.
- The Rowan MCP surface available in this lane was **PsyArXiv**, not the original ChromaDB `arxiv-meta-v0` path named in the source task.
- The exact requested compound search returned zero direct hits, so several conclusions above are inferences from adjacent evidence.
- Several abstract previews were truncated by the search surface, so this note should guide direction, not settle exact numeric tuning.

---

## References

- [Issue #45: Revise streak multipliers — cap at 5 days](https://github.com/Spitfire-Cowboy/ship-receipts/issues/45)
- [Similar exercise adherence and physical fitness outcomes are observed across distinct motivation profiles in older adults participating in a home-based structured exercise programme](https://osf.io/preprints/psyarxiv/gk74p_v2/)
- [Disrupting Digital Habits Among Danish Adolescence: Evidence from 1.2 Million Social Media Interactions](https://osf.io/preprints/psyarxiv/ruvp3_v1/)
- [Optimal Gamification of Self-Directed Learning: A Computational Method and its Real-World Evaluation in an App for Learning English](https://osf.io/preprints/psyarxiv/s4kqc_v1/)
- [Decision processes through Dungeons and Dragons: Meaningful gamification using a tabletop roleplaying game](https://osf.io/preprints/psyarxiv/sh95j_v1/)
- [The Day Preconstruction Method: A novel method to strengthen Future Self-Continuity](https://osf.io/preprints/psyarxiv/6btk2_v1/)
- [Gamification of Medical School Formative Assessments](https://osf.io/preprints/psyarxiv/ah4ev_v1/)
- [자율적인 기능하기 척도 타당화 연구](https://osf.io/preprints/psyarxiv/29ua4_v1/)
