# Bridge Status — Campion BLD Phase 5 → Rowan Follow-up

**Date:** 2026-02-26  
**Branch:** `develop`  
**Scope:** `ship-receipts` ↔ `proofofship`

## What is shipped on `develop`

### ship-receipts

- Local scoring pipeline is implemented (score engine, hash validation, state persistence, streak logic, envelope export).
- Integration smoke path is green (`16/16` checks).
- Campion handoff packet v2 is published with stable/provisional boundaries and module map.

### proofofship

- Envelope validator, append-only ledger store, and reputation aggregator are implemented.
- Ingest smoke path is green (`18/18` checks).
- Campion handoff packet v2 is published with formula, states, and anti-gaming control inventory.

## Pending from Campion BLD Phase 5 (Anti-Gaming Hardening)

From roadmap/specs, the phase-5 items not yet complete are:
1. **Attestation graph tracking** (store edges + actor relationships over time).
2. **Closed-loop/collusion detection** (rule-based flagging over attestation graph).
3. **Monitoring surface** (dashboard/report for anti-gaming signals).
4. **Private-repo detection + exclusion** in verification depth path.
5. **Receipt submission rate limiting** at ingest boundary.

## Next 3 implementation slices (Rowan-side)

1. **Slice A — Ingest Guardrails (fast hardening)**
   - Add per-actor + per-IP rate limiting on envelope ingest.
   - Add explicit reject/flag reason codes in ledger events.
   - Add tests for burst + retry behavior.

2. **Slice B — Private Visibility Gate**
   - In verification stage, resolve repo visibility (public/private/unknown).
   - Force `verification_depth=0.0` (or non-contributing) for private/unknown visibility per spec.
   - Persist visibility evidence for auditability.

3. **Slice C — Attestation Graph v1 + Flags**
   - Add graph tables (`attestations`, `attestation_edges`, rollups).
   - Implement first closed-loop heuristics (small-cycle repetition, reciprocal concentration).
   - Emit daily anti-gaming report artifact for operator review.

## Bridge note

- `ship-receipts` can stay mostly unchanged for phase-5 completion; primary work is in `proofofship` ingest/verification/monitoring.
- Keep trust boundary unchanged: never trust `local_score_snapshot`; continue independent global verification.
