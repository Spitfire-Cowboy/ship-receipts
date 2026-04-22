# Site Genome Prompt v1

## Purpose

A **site genome prompt** is a single prompt that contains enough information to recreate a shipped site from scratch in a clean environment.

It serves three jobs:

1. Provenance artifact (what decisions were made and why)
2. Reproducibility receipt (can another builder regenerate a close equivalent)
3. Knowledge transfer bundle (fast onboarding without reading all commits first)

## Scope

This spec is for web/product projects where output can be compared against a shipped repository.

This spec does not require exact byte-for-byte output. It requires reproducible structure and intent.

## Genome Contract

A valid site genome prompt must include the sections below in one prompt body.

1. Product intent
   - Problem statement
   - Target user
   - Success criteria
2. Hard constraints
   - Runtime, framework, package manager
   - Browser/device support
   - Accessibility and performance targets
   - Explicit non-goals
3. Information architecture
   - Routes/pages and purpose
   - Core user flows
4. Design system essentials
   - Typography stack
   - Color tokens
   - Spacing/radius/shadow rules
   - Motion rules
5. Component map
   - Required components and behavior
   - State variations
6. Data contract
   - Local/static data shape
   - Remote API contracts (if any)
7. Build and run instructions
   - Install, build, test, and run commands
   - Environment variables required
8. Verification instructions
   - How to compare generated output to shipped output
   - What differences are acceptable
9. Human delta notes
   - Where taste and iteration intentionally diverged from the generated baseline

## Fidelity Levels

Use one explicit level in the prompt:

- `L1` Structural: routes/components/flows must match
- `L2` Behavioral: user interactions and state transitions must match
- `L3` Presentational: design tokens and visual style must substantially match

Recommended default: `L2`.

## Verification Procedure

1. Run genome prompt in a clean directory.
2. Build and test generated project.
3. Compare against shipped repo:
   - route/component parity
   - behavior parity for critical flows
   - token/style parity at declared fidelity level
4. Record delta report:
   - generated output hash
   - shipped output hash
   - accepted deltas
   - rejected deltas

## Suggested Prompt Envelope

Use this shell for the actual single prompt:

```text
SYSTEM:
You are recreating a shipped project from a genome prompt. Follow constraints exactly.

GENOME VERSION: 1
PROJECT: <name>
FIDELITY: <L1|L2|L3>

[Product intent]
...
[Hard constraints]
...
[Information architecture]
...
[Design system essentials]
...
[Component map]
...
[Data contract]
...
[Build and run instructions]
...
[Verification instructions]
...
[Human delta notes]
...
```

Reference example: [`examples/site-genome-prompt.example.md`](../../examples/site-genome-prompt.example.md)

## Relationship to Ship Receipts

The genome prompt can be referenced from a receipt as an artifact (`kind: "other"` today) with:

- immutable reference (commit/tag/hash)
- verification command proving regeneration run
- notes documenting accepted delta

This aligns with the trust boundary: `ship-receipts` stores claims and local proofs; downstream verification systems evaluate them independently.
