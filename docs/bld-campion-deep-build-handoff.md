# BLD Campion Deep-Build Handoff (L2)

Scope: **ship-receipts + arXiv lane**
Owner lane: **BLD Campion**
Status: **Ready to run**

---

## 1) Exact run prompt

Use this exact prompt for the deep-build run:

```text
You are BLD Campion running a deep-build implementation lane for ship-receipts with arXiv ingest.

Mission:
1) Implement end-to-end arXiv receipt generation for ship-receipts.
2) Preserve existing schema guarantees and examples.
3) Produce deterministic, test-backed output and docs.

Deliverables:
- Source changes for arXiv fetch/normalize/map pipeline.
- Schema-valid receipt output for arXiv papers.
- Tests (unit + integration fixture path).
- CLI/dev script to run the arXiv lane locally.
- Documentation updates for usage and constraints.

Rules:
- Keep diffs small and composable.
- Ship in the first 3 implementation slices defined in docs/bld-campion-deep-build-handoff.md.
- Fail fast on malformed upstream metadata.
- No hidden behavior; all assumptions must be documented.

Definition of done:
- Acceptance criteria section in docs/bld-campion-deep-build-handoff.md is fully satisfied.
- CI/local checks pass.
- Commit messages reference slice IDs (S1/S2/S3).
```

---

## 2) Model settings

Recommended runner/model settings for this lane:

- Model: `openai-codex/gpt-5.3-codex`
- Reasoning mode: `low` for implementation passes, `medium` for schema/debug passes if needed
- Temperature: `0.1`
- Top-p: `1.0`
- Max output tokens: `>= 4000` for code+tests turns
- Tool mode: enabled (`exec`, `read`, `write`, `edit`)
- Approval policy: on-failure or on-miss (allow normal local build/test commands)

If deterministic replay is needed for prompt-only runs:

- Temperature: `0.0`
- Fixed seed: set when client supports it

---

## 3) Mount paths

Canonical host project path:

- `/Users/johnmalone/Projects/ship-receipts`

If running in a containerized build worker, mount as:

- Host: `/Users/johnmalone/Projects/ship-receipts`
- Container: `/workspace/ship-receipts`

Example:

```bash
docker run --rm -it \
  -v /Users/johnmalone/Projects/ship-receipts:/workspace/ship-receipts \
  -w /workspace/ship-receipts \
  node:22 bash
```

---

## 4) Acceptance criteria

All items must pass:

1. **arXiv ingest path exists**
   - Given an arXiv ID or URL, the pipeline fetches metadata and normalizes it into an internal typed shape.

2. **Schema-valid receipt output**
   - Generated JSON validates against project schema under `schema/` with no manual edits.

3. **Deterministic mapping contract**
   - Same input metadata yields byte-stable receipt output (excluding explicit timestamp/version fields if documented).

4. **Error handling**
   - Invalid IDs, network failures, and incomplete metadata return explicit, typed errors.

5. **Test coverage**
   - Unit tests for normalizer and mapper.
   - Integration fixture test for at least one known arXiv paper.

6. **Developer runnable path**
   - One documented command from repo root produces a receipt artifact for an arXiv ID.

7. **Docs updated**
   - README/docs include arXiv lane usage, limitations, and example invocation.

---

## 5) First 3 concrete implementation slices

### S1 — Ingest + Normalize

Goal: convert arXiv source metadata into stable internal data.

Tasks:
- Add arXiv client module (`fetch by id/url`, response parsing).
- Add normalizer with explicit field mapping and nullability policy.
- Add validation guardrails for required fields.
- Add unit tests for: valid paper, missing abstract, malformed author list, bad ID.

Exit checks:
- `arxiv->normalized` objects produced locally from fixture payload.
- All S1 tests pass.

---

### S2 — Receipt Mapper + Schema Validation

Goal: map normalized arXiv data to ship-receipts schema output.

Tasks:
- Implement mapper from normalized model to receipt/card JSON.
- Add deterministic ordering for arrays/objects where needed.
- Validate output against `schema/` on generation.
- Add unit tests asserting field-level mapping and schema validity.

Exit checks:
- Sample arXiv paper renders schema-valid receipt JSON.
- Mapper output is stable across repeated runs.

---

### S3 — CLI Path + Integration Fixture + Docs

Goal: provide a fully runnable lane and operator-facing docs.

Tasks:
- Add CLI or script command (e.g., `arxiv:receipt`) from repo root.
- Add integration test fixture that runs ingest→map→validate pipeline.
- Add docs for command usage, input forms (ID/URL), and known limits.
- Add one canonical example artifact under `examples/` or documented output path.

Exit checks:
- Single command produces receipt output for a known arXiv paper.
- Integration test passes in clean checkout.
- Docs are sufficient for a new contributor to run lane in <10 minutes.

---

## 6) Suggested execution order

1. Land S1 with tests.
2. Land S2 with schema validation wiring.
3. Land S3 with integration + docs.

Keep commits slice-scoped (`S1: ...`, `S2: ...`, `S3: ...`) to simplify review and rollback.
