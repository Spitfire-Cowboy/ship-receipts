# GitHub Page Design v1 — ship-receipts

**Purpose:** Design rationale and standards for the public-facing repo presentation.
**Date:** 2026-02-26
**Scope:** README.md, docs index, repo navigation, and copy tone.

---

## Design goals

1. **Comprehensible in 60 seconds.** A first-time visitor should understand what ship-receipts does from the first 30 lines of the README.
2. **Trustworthy without hype.** Every claim in the README should be supportable by an existing artifact in the repo (schema, spec, code, example).
3. **Fork-friendly.** A developer should be able to clone, install, and score a receipt within 10 minutes.
4. **Anti-slop in presentation, not just in code.** The repo's public face should model the same standard it enforces: substance over volume.

---

## Design principles

### 1. Show, don't market

The README is not a landing page. It is a technical document for builders.

- No emoji in headings.
- No superlatives ("revolutionary", "game-changing", "blazing fast").
- No vague claims. Replace "powerful verification" with "SHA-256 content hash of canonical JSON."
- If a feature is planned, label it "planned" explicitly.

### 2. Structure for skimming

GitHub visitors skim. Design for scan patterns:

- Strong headings that are self-explanatory without reading the body.
- Short sections (aim for under 15 lines per section).
- Bullets for lists, but prose for explanations.
- Code blocks for anything runnable.

### 3. Progressive disclosure

Layer information from general to specific:

- **README.md** — What, why, quickstart, architecture (5-minute read)
- **docs/concepts.md** — Deeper explanation of the model
- **docs/specs/** — Full implementation contracts
- **examples/** — Working JSON files

The README should link down. Specs should not need to link up.

### 4. Accurate claims only

Every assertion in the README must be traceable to one of:

- A schema file in `schema/` or `schemas/`
- A spec file in `docs/specs/`
- Working code in `src/`
- A passing test in `tests/`
- An example in `examples/`

If something exists only as a plan, it must say "planned."

---

## README structure standard

The README follows this section order. Sections may be omitted if not applicable, but should not be reordered.

1. **Title + one-liner** — Project name and one-sentence value proposition.
2. **Why this exists** — Problem statement. Anti-slop motivation.
3. **What it is / is not** — Explicit boundary with proofofship.
4. **What you can do in 10 minutes** — Capability summary.
5. **Quickstart** — Copy-paste runnable commands.
6. **How a receipt works** — Minimal example with annotations.
7. **Architecture** — ASCII/Mermaid diagram showing local vs. global boundary.
8. **Local game loop** — Scoring overview, anti-slop rules, multipliers.
9. **Verification model** — Proof primitives (provenance, integrity, ship).
10. **CLI commands** — Command table with descriptions.
11. **Project status** — Current phase + roadmap table.
12. **Docs** — Links to all documentation.
13. **Contributing** — Link + good first tasks.
14. **Safety and abuse** — Anti-gaming posture, link to specs.
15. **License** — One line.

---

## Tone guidelines

**Do:** Confident, direct, specific. "The content hash is SHA-256 of the canonical JSON with sorted keys and no whitespace."

**Don't:** Hedging, marketing, jargon-without-definition. "Our advanced hashing technology ensures data integrity."

**Voice model:** A senior engineer writing a README for their team. Assumes intelligence, doesn't assume context.

---

## Trust signals to include

These are the elements that build credibility with technical visitors:

- Working quickstart (not aspirational commands).
- Real example JSON that validates against the real schema.
- Explicit boundaries (what this does NOT do).
- Documented abuse vectors and mitigations.
- Deterministic scoring formula (not "AI-powered" or "smart").
- MIT license.
- CI badge (when CI runs meaningful tests).

---

## Patterns to reuse for proofofship

This design system is intended to be portable. When proofofship gets its public README pass, reuse:

- The section order standard.
- The "is / is not" boundary pattern.
- The "proof before claim" tone.
- The quickstart-first structure.
- ASCII architecture diagrams (avoid images that can't be diffed).
- The practice of linking every claim to a supporting artifact.
