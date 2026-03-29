# Site Map — ship-receipts repo information architecture

**Purpose:** Reduce dead ends. Every file in the repo should be findable from at most two navigation hops.

**Last updated:** 2026-02-26

---

## Navigation hierarchy

```text
README.md                          ← primary entry point (GitHub landing page)
├── docs/README.md                 ← secondary entry point (docs index)
│   ├── concepts.md                ← "what is this" for people who want more than the README
│   ├── specs/                     ← implementation contracts
│   │   ├── ship-receipts-mvp-spec-v1.md
│   │   ├── ship-receipts-data-model-v1.md
│   │   ├── ship-receipts-api-contract-v1.md
│   │   ├── ship-receipts-scoring-model-v1.md
│   │   ├── ship-receipts-game-loop-local-v1.md
│   │   ├── local-to-global-proof-envelope-v1.md
│   │   └── ship-receipts-roadmap-v1.md
│   ├── integration/               ← proofofship bridge docs
│   │   ├── ship-receipts-to-proofofship-v1.md
│   │   ├── handoff-packet-for-seton-v1.md
│   │   └── proofofship-integration-smoke-v1.md
│   ├── plans/                     ← dated planning artifacts
│   ├── status/                    ← dated status reports
│   ├── game-mode/                 ← planned visual game interface
│   ├── positioning/               ← repo presentation and copy
│   │   ├── github-page-design-v1.md
│   │   └── repo-copy-deck-v1.md
│   └── research/                  ← academic/theoretical background
├── schema/                        ← JSON schemas (v0.1)
│   └── ship-receipts.v0.1.schema.json
├── schemas/                       ← additional schemas (events, envelopes)
│   ├── receipt-event.v1.json
│   └── proof-envelope.v1.json
├── examples/                      ← working example files
│   ├── ship-receipts.example.json
│   └── local-to-global-proof-example.v1.json
├── src/                           ← CLI implementation (Python)
│   ├── cli.py
│   ├── scoring/
│   └── envelope/
├── tests/                         ← test suite
├── scripts/                       ← utility scripts
├── CONTRIBUTING.md
├── SECURITY.md
├── CHANGELOG.md
├── CODE_OF_CONDUCT.md
├── CLAUDE.md                      ← AI assistant instructions
├── AGENTS.md                      ← AI agent ground rules
└── LICENSE
```

---

## Entry points by audience

| Audience | Start at | Then go to |
|----------|----------|------------|
| First-time visitor | `README.md` | `docs/concepts.md` or `examples/` |
| Contributor | `README.md` → Contributing section | `CONTRIBUTING.md`, then `docs/specs/` |
| Implementor (build a client) | `README.md` → Schema section | `schema/`, `docs/specs/ship-receipts-data-model-v1.md` |
| Reviewer (evaluate the design) | `README.md` | `docs/specs/ship-receipts-mvp-spec-v1.md` |
| AI agent | `AGENTS.md` or `CLAUDE.md` | `docs/specs/` |

---

## Known navigation issues

| Issue | Status | Notes |
|-------|--------|-------|
| `schema/` vs `schemas/` — two directories with similar names | Open | `schema/` has the receipt schema; `schemas/` has event and envelope schemas. Consider consolidating in a future pass. |
| Docs index doesn't surface game-mode or positioning subdirs | Fixed | Updated `docs/README.md` to list all subdirectories. |
| No cross-links from specs back to README | Acceptable | Specs are implementation contracts; they link forward to each other, not back to marketing copy. |

---

## Link integrity rules

- Every markdown file in `docs/` should be reachable from `docs/README.md`.
- Every schema file should be linked from both `README.md` and `docs/README.md`.
- Every example should be linked from `README.md`.
- Dead links should be caught in CI (planned — not yet implemented).
