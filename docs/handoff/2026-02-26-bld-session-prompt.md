# BLD Assignment Archive — 2026-02-26

This file is historical context only. Do not paste it directly into a live
session.

For current execution, create a GitHub issue and assign work through the issue:
1. Open a new issue with full task details (scope, file map, guardrails, tests).
2. Label the issue with the target agent lane (for example `BLD` or `Codex`).
3. Include branch and PR requirements in the issue body.
4. Paste the issue link in handoff notes; use the issue as the single source of truth.

---

## Context

You are reviewing two repos that work together:

1. **ship-receipts** — `git clone git@github.com:Spitfire-Cowboy/ship-receipts.git`
   Local CLI tool. Free, open source. Creates structured proof-of-work receipts with JSON schema, scoring engine, streak tracking, badges, party mode. Game mode is single player.

2. **proofofship** — use the current canonical repo URL from the assignment issue
   Global reputation ledger. Free canonical ledger. FastAPI + SQLite. Independently verifies receipts via 6-stage pipeline. Time-decayed reputation scoring (90-day half-life). Game mode is MMO.

Both repos are **code complete** as of 2026-02-26.
- ship-receipts: 124 tests passing, 10 build slices, all PRs merged to `develop`
- proofofship: 146 tests passing (1 skipped: live GitHub test), all PRs merged to `develop`

## Read These First

In **ship-receipts**:
- `CLAUDE.md` — repo conventions
- `docs/status/2026-02-26-code-complete.md` — what's built
- `docs/game-mode/strategic-analysis-v1.md` — the strategic "why" (Universal Paperclips parallel, adoption thesis, moltbook vector, reference benchmarks, humans+agents on same ledger)
- `docs/game-mode/game-mode-foundation-v1.md` — core mechanics
- `schema/` — the receipt JSON schema

In **proofofship**:
- `CLAUDE.md` — repo conventions
- `docs/status/2026-02-26-code-complete.md` — what's built
- `docs/specs/proofofship-reputation-model-v1.md` — reputation formula, anti-gaming controls, confidence tiers
- `docs/research/2026-02-arxiv-math-and-reputation-map.md` — 19 arxiv papers mapped to components
- `docs/research/2026-02-26-deep-research-brief.md` — 6 open research questions (see tasks below)
- `docs/runbooks/public-staging-deploy.md` — Hetzner deploy runbook

## Available Tasks

### 1. Deploy proofofship to Hetzner staging

The deploy runbook is at `docs/runbooks/public-staging-deploy.md`. Target: `staging.proofofship.com`. This machine has the SSH keys. Cloudflare handles DNS/TLS. Docker Compose is ready. Two other projects already run on the Hetzner box.

### 2. Deep research — arxiv ChromaDB analysis

This machine has arxiv abstracts in a ChromaDB collection and ollama available. The deep research brief (`docs/research/2026-02-26-deep-research-brief.md`) has 6 structured questions:

1. **Half-life appropriateness** — Is 90-day half-life correct for OSS contribution decay? What does the literature say?
2. **Streak attack vectors** — How can an adversary game the streak multiplier system? Model specific attacks.
3. **Sybil resistance** — How vulnerable is the identity-anchored-on-GitHub model to Sybil attacks?
4. **Verification blind spots** — What legitimate contributions can't reach depth > 0.4 without signatures/attestations?
5. **Competitive landscape** — How does proofofship compare to ARMS (arXiv 2505.18760) and other OSS reputation systems?
6. **Confidence tier calibration** — Are the tier thresholds (emerging/established/trusted/authority) well-calibrated?

For each question, query the ChromaDB collection for relevant arxiv abstracts, synthesize findings, and write results back to `docs/research/` in the proofofship repo. Commit and open a PR as defined in the assignment issue.

### 3. Review the strategic analysis

Read `ship-receipts/docs/game-mode/strategic-analysis-v1.md` with a critical eye. It covers:
- Universal Paperclips as structural parallel for agent reputation
- Game mode as adoption mechanism (not decoration)
- Three adoption vectors: game mode (humans), GitHub Action (repos), moltbook (agents)
- Reference benchmarks for pre-seeding scoreboard
- Humans and agents on the same ledger
- Risks and open questions

Push back on anything that doesn't hold up. File issues or write counter-analysis, and link all outputs back to the assignment issue.

## Conventions

- **No Co-Authored-By lines** in commits. This is John's project.
- **Use issue-based handoff** (no copy-paste session prompts).
- **GitHub is canonical** for all machine-to-machine assignment and status.
- **Target branch comes from the assignment issue** (do not assume `develop`).
- Keep commits clean and descriptive.
- Both repos use the same CLAUDE.md conventions: additive changes, simple schema, clear examples.

## Domains

- proofofship.com, proof-of-ship.com, shipreceipts.com, ship-receipts.com — all owned
- Cloudflare for DNS/TLS
- Hetzner VPS for staging

## The Mission

Proofofship becomes the canonical ledger for LLM agent reputation, encouraging socially positive use of AI agents. Ship-receipts is the free, open-source local tool that creates the proof artifacts. The game mode makes humans want to use it. The moltbook listing makes agents want to play it. The verification pipeline makes the reputation trustworthy.
