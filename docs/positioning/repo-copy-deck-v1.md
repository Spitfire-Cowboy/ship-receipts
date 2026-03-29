# Repo Copy Deck v1 — ship-receipts

**Purpose:** Headline, subheadline, tagline, blurb, and CTA options for use in the README, GitHub repo description, social sharing, and proofofship references.
**Date:** 2026-02-26

---

## Taglines (GitHub repo description field, max ~120 chars)

**Recommended:**
> Verifiable records of shipped work. JSON schema + local CLI for proof-based receipts.

**Alternatives:**
> Machine-readable receipts for what you shipped, where it is, and how to verify it.

> A format and CLI for producing verifiable ship receipts. Proof before claim.

---

## One-sentence value proposition

**Recommended:**
> Ship Receipts is a JSON schema and local CLI for producing machine-readable, verifiable records of shipped work.

**Alternative (more opinionated):**
> Ship Receipts replaces "trust me, I built that" with structured, machine-verifiable proof.

---

## Headlines (README H1 + subtitle)

**Option A (factual):**
> # Ship Receipts
> Verifiable records of shipped work.

**Option B (problem-first):**
> # Ship Receipts
> Posting volume is not reputation. Receipts are.

**Option C (action-oriented):**
> # Ship Receipts
> Prove what you shipped. Locally, verifiably, without hype.

**Recommendation:** Option A. Clean, doesn't oversell. The "why this exists" section handles the motivation.

---

## Short blurb (for cross-linking, project lists, README references elsewhere)

> **ship-receipts** defines a JSON format and local CLI for creating verifiable records of shipped work. Each receipt combines an artifact (repo, release, package) with verification hooks (checksums, CI links, commands) and provenance (who claimed it, when). A local game loop scores receipts based on proof depth — no proof means no score. The format is designed for machine validation; global reputation lives in [proofofship](https://github.com/Pro777/proofofship).

---

## Long blurb (for detailed references, docs, or blog-style contexts)

> At scale, posting volume is noise. "I built something" means nothing without evidence.
>
> **Ship Receipts** is a structured format (JSON schema) and local command-line tool for producing verifiable records of shipped work. Each receipt pairs an artifact — a repo, release, package, or deployed URL — with machine-checkable verification hooks: content checksums, CI pipeline links, shell commands, and SLSA/in-toto attestation pointers.
>
> The local game loop scores receipts based on proof depth, not social metrics. Receipts with no verification evidence score zero (the anti-slop rule). Streaks reward consistency; integrity bonuses reward tamper-evident receipts.
>
> Ship-receipts is local tooling. It runs on your machine, stores state locally, and never phones home. For global canonical reputation — leaderboards, cross-builder comparison, identity verification — see [proofofship](https://github.com/Pro777/proofofship), which ingests proof envelopes from ship-receipts and re-verifies independently.

---

## CTA copy

**For README quickstart section:**
> Clone the repo, score your first receipt in under 2 minutes.

**For proofofship README cross-link:**
> Receipts are created locally with [ship-receipts](https://github.com/Pro777/ship-receipts). Install it, create a receipt, and export a proof envelope.

**For contributor call:**
> Good first tasks are listed in the README. Feedback and bug reports welcome via issues.

---

## Terms to use consistently

| Use this | Not this | Reason |
|----------|----------|--------|
| receipt | card, certificate, badge | "Receipt" is the project's term of art |
| proof depth | proof quality, proof level | "Depth" is used in the scoring spec |
| verification hooks | verification methods, checks | "Hooks" matches the schema terminology |
| anti-slop | anti-spam, anti-gaming | "Slop" is the project's intentional framing |
| proof envelope | submission, package | "Envelope" is the schema name |
| local game loop | gamification, game mode | "Game loop" is the spec term; "gamification" is a buzzword |
| proofofship | Proof of Ship, PoS | Lowercase, one word, matches the repo name |

---

## Claims that need artifact backing

Every claim in public copy should trace to a repo artifact. Current mapping:

| Claim | Supporting artifact |
|-------|-------------------|
| "JSON schema" | `schema/ship-receipts.v0.1.schema.json` |
| "Local CLI" | `src/cli.py` |
| "Scores based on proof depth" | `docs/specs/ship-receipts-scoring-model-v1.md` |
| "No proof = no score" | Anti-slop gate in scoring model spec, section 4 |
| "SHA-256 content hash" | `docs/specs/ship-receipts-data-model-v1.md`, section "Content Hash Strategy" |
| "Proof envelope for proofofship" | `schemas/proof-envelope.v1.json`, `docs/specs/local-to-global-proof-envelope-v1.md` |
| "Deterministic scoring" | Scoring model spec, section 7: "same inputs -> same output" |
| "Streaks and multipliers" | Game loop spec, sections on streaks and multipliers |
| "MIT license" | `LICENSE` |
