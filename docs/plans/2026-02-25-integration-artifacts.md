# Ship-Receipts → Proofofship Integration Artifacts Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Create the schemas, docs, examples, and stub tooling that let ship-receipts (single player) talk to proofofship (MMO) with a clean, validated interface — and give Seton (Claude Cowork) everything needed to build game mode UX immediately.

**Architecture:** The proof envelope wraps a complete local receipt verbatim plus routing metadata. Proofofship never trusts local scores — it re-verifies everything. The receipt-event schema provides a unified event stream for UX state machines.

**Tech Stack:** JSON Schema (Draft 2020-12), Python 3.10+ (stub script), jsonschema library for validation.

---

## Task 1: Create proof-envelope.v1.json Schema

**Files:**
- Create: `schemas/proof-envelope.v1.json`

**Step 1: Write the schema file**

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://proofofship.com/schemas/proof-envelope.v1.json",
  "title": "Proof Envelope v1",
  "description": "Wraps a ship-receipt for submission to proofofship. Contains the full original receipt, actor routing, and optional local score snapshot.",
  "type": "object",
  "required": ["envelope_version", "envelope_id", "content_hash", "submitted_at", "actor", "receipt", "export_metadata"],
  "properties": {
    "envelope_version": {
      "const": "1.0",
      "description": "Envelope schema version. Independent of receipt version."
    },
    "envelope_id": {
      "type": "string",
      "pattern": "^[0-9A-HJKMNP-TV-Z]{26}$",
      "description": "ULID generated at export time. For ordering/reference, NOT the dedupe key."
    },
    "content_hash": {
      "type": "string",
      "pattern": "^sha256:[a-f0-9]{64}$",
      "description": "SHA-256 of the canonical receipt JSON. This IS the idempotency/dedupe key."
    },
    "submitted_at": {
      "type": "string",
      "format": "date-time",
      "description": "ISO 8601 timestamp of envelope creation."
    },
    "actor": {
      "type": "object",
      "required": ["github_username", "display_name"],
      "properties": {
        "github_username": {
          "type": "string",
          "minLength": 1,
          "pattern": "^[a-zA-Z0-9](?:[a-zA-Z0-9]|-(?=[a-zA-Z0-9])){0,38}$",
          "description": "GitHub username extracted from receipt subject profiles."
        },
        "display_name": {
          "type": "string",
          "minLength": 1,
          "description": "Human-readable name from receipt subject.name."
        },
        "profile_urls": {
          "type": "array",
          "items": { "type": "string", "format": "uri" },
          "description": "All profile URLs from receipt subject.profiles."
        }
      },
      "additionalProperties": false
    },
    "receipt": {
      "type": "object",
      "description": "The complete original ship-receipt, embedded verbatim. Proofofship validates this independently.",
      "required": ["version", "subject", "artifacts"],
      "additionalProperties": true
    },
    "local_score_snapshot": {
      "type": "object",
      "description": "Optional. Local game loop score at export time. Informational only — proofofship never trusts this.",
      "properties": {
        "base_score": { "type": "integer", "minimum": 0 },
        "final_score": { "type": "integer", "minimum": 0 },
        "streak_days": { "type": "integer", "minimum": 0 },
        "streak_multiplier": { "type": "number", "minimum": 1.0 },
        "integrity_multiplier": { "type": "number", "minimum": 1.0 },
        "computed_at": { "type": "string", "format": "date-time" }
      },
      "additionalProperties": false
    },
    "export_metadata": {
      "type": "object",
      "required": ["generator", "generator_version", "ship_receipts_schema_version"],
      "properties": {
        "generator": {
          "type": "string",
          "description": "Tool that created this envelope (e.g. 'ship-receipts-cli')."
        },
        "generator_version": {
          "type": "string",
          "description": "Version of the generator tool."
        },
        "ship_receipts_schema_version": {
          "type": "string",
          "enum": ["0.1", "1.0"],
          "description": "Schema version of the embedded receipt."
        }
      },
      "additionalProperties": false
    }
  },
  "additionalProperties": false
}
```

**Step 2: Verify schema is valid JSON**

Run: `python3 -c "import json; json.load(open('schemas/proof-envelope.v1.json')); print('VALID JSON')"` from repo root.
Expected: `VALID JSON`

**Step 3: Commit**

```bash
git add schemas/proof-envelope.v1.json
git commit -m "schema: add proof-envelope v1 JSON Schema"
```

---

## Task 2: Create receipt-event.v1.json Schema

**Files:**
- Create: `schemas/receipt-event.v1.json`

**Step 1: Write the schema file**

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://proofofship.com/schemas/receipt-event.v1.json",
  "title": "Receipt Event v1",
  "description": "Tracks lifecycle state changes as a receipt moves from local creation through global verification. Powers Seton UX state machine.",
  "type": "object",
  "required": ["event_id", "event_type", "content_hash", "timestamp", "source"],
  "properties": {
    "event_id": {
      "type": "string",
      "pattern": "^[0-9A-HJKMNP-TV-Z]{26}$",
      "description": "ULID for this event."
    },
    "event_type": {
      "type": "string",
      "enum": [
        "receipt.created",
        "receipt.validated",
        "receipt.scored",
        "envelope.exported",
        "envelope.submitted",
        "envelope.accepted",
        "envelope.rejected",
        "envelope.verified"
      ],
      "description": "Lifecycle event type."
    },
    "content_hash": {
      "type": "string",
      "pattern": "^sha256:[a-f0-9]{64}$",
      "description": "Links this event to a specific receipt by its content hash."
    },
    "envelope_id": {
      "type": "string",
      "pattern": "^[0-9A-HJKMNP-TV-Z]{26}$",
      "description": "Links this event to a specific envelope. Present for envelope.* events."
    },
    "timestamp": {
      "type": "string",
      "format": "date-time",
      "description": "When this event occurred."
    },
    "source": {
      "type": "string",
      "enum": ["local", "global"],
      "description": "Whether this event originated locally (ship-receipts) or globally (proofofship)."
    },
    "detail": {
      "type": "object",
      "description": "Event-specific payload.",
      "properties": {
        "reason": { "type": "string", "description": "Rejection reason." },
        "error_code": {
          "type": "string",
          "enum": ["E_PARSE", "E_SCHEMA", "E_HASH_MISSING", "E_HASH_INVALID", "E_SUBJECT", "E_NO_GITHUB", "E_NO_ARTIFACT", "W_DUPLICATE", "E_IDENTITY", "E_DEDUP", "E_ARTIFACT_MISSING"],
          "description": "Machine-readable failure code."
        },
        "verification_depth": {
          "type": "number",
          "minimum": 0.0,
          "maximum": 1.0,
          "description": "Proofofship verification depth (0.0-1.0). Present for envelope.verified."
        },
        "score": {
          "type": "integer",
          "minimum": 0,
          "description": "Score assigned. Present for receipt.scored."
        },
        "base_score": {
          "type": "integer",
          "minimum": 0,
          "description": "Base score before multipliers."
        },
        "streak_days": {
          "type": "integer",
          "minimum": 0,
          "description": "Streak length at time of scoring."
        },
        "pipeline_version": {
          "type": "string",
          "description": "Proofofship verification pipeline version. Present for envelope.verified."
        },
        "stages": {
          "type": "object",
          "description": "Per-stage verification results from proofofship pipeline.",
          "additionalProperties": {
            "type": "object",
            "properties": {
              "pass": { "type": "boolean" },
              "reason": { "type": "string" }
            }
          }
        }
      },
      "additionalProperties": true
    },
    "actor": {
      "type": "string",
      "description": "Who or what triggered this event (username, tool name, system)."
    }
  },
  "additionalProperties": false
}
```

**Step 2: Verify schema is valid JSON**

Run: `python3 -c "import json; json.load(open('schemas/receipt-event.v1.json')); print('VALID JSON')"` from repo root.
Expected: `VALID JSON`

**Step 3: Commit**

```bash
git add schemas/receipt-event.v1.json
git commit -m "schema: add receipt-event v1 JSON Schema"
```

---

## Task 3: Create End-to-End Example

**Files:**
- Create: `examples/local-to-global-proof-example.v1.json`

**Step 1: Write the example file**

This example shows a real-shaped receipt going through the full pipeline: local receipt → proof envelope → event stream.

```json
{
  "_comment": "End-to-end example: local receipt wrapped in proof envelope with event history.",

  "proof_envelope": {
    "envelope_version": "1.0",
    "envelope_id": "01JMFGHT5V4KXRB9NWQZ3P7Y2D",
    "content_hash": "sha256:a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2",
    "submitted_at": "2026-02-25T14:30:00Z",
    "actor": {
      "github_username": "Pro777",
      "display_name": "Pro777",
      "profile_urls": [
        "https://github.com/Pro777"
      ]
    },
    "receipt": {
      "version": "0.1",
      "receipt_id": "urn:ship-receipt:proof-engine:2026-02-25",
      "issued_at": "2026-02-25T12:00:00Z",
      "subject": {
        "name": "Pro777",
        "profiles": [
          { "kind": "github", "url": "https://github.com/Pro777" }
        ]
      },
      "artifacts": [
        {
          "kind": "repo",
          "name": "proof-engine",
          "url": "https://github.com/Pro777/proof-engine",
          "version": "0.3.0",
          "immutable_ref": "abc123def456789012345678901234567890abcd",
          "ci_url": "https://github.com/Pro777/proof-engine/actions/runs/12345",
          "verify": [
            {
              "kind": "checksum",
              "algo": "sha256",
              "hash": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
              "source": "release-artifact",
              "observed_at": "2026-02-25T12:00:00Z"
            },
            {
              "kind": "link",
              "url": "https://github.com/Pro777/proof-engine/actions/runs/12345",
              "source": "github-actions",
              "observed_at": "2026-02-25T12:00:00Z"
            },
            {
              "kind": "command",
              "command": "cd proof-engine && npm test",
              "source": "maintainer",
              "observed_at": "2026-02-25T12:00:00Z"
            }
          ],
          "claims": [
            {
              "name": "test_coverage",
              "value": 87,
              "unit": "percent",
              "source_url": "https://codecov.io/gh/Pro777/proof-engine",
              "observed_at": "2026-02-25T12:00:00Z",
              "methodology": "Codecov line coverage report"
            }
          ],
          "provenance": {
            "source_repo": "https://github.com/Pro777/proof-engine",
            "commit": "abc123def456789012345678901234567890abcd",
            "slsa_level": "L2",
            "verified_at": "2026-02-25T12:00:00Z"
          },
          "signals": {
            "stars": 42,
            "dependents": 3,
            "downloads_30d": 890,
            "as_of": "2026-02-25T12:00:00Z",
            "sources": ["https://api.github.com/repos/Pro777/proof-engine"],
            "methodology": "GitHub REST API point-in-time snapshot"
          }
        }
      ],
      "issuer": {
        "name": "ship-receipts-cli",
        "url": "https://github.com/proofofship/ship-receipts"
      },
      "notes": "Weekly release with new verification engine."
    },
    "local_score_snapshot": {
      "base_score": 21,
      "final_score": 39,
      "streak_days": 8,
      "streak_multiplier": 1.5,
      "integrity_multiplier": 1.5,
      "computed_at": "2026-02-25T12:05:00Z"
    },
    "export_metadata": {
      "generator": "ship-receipts-cli",
      "generator_version": "0.1.0",
      "ship_receipts_schema_version": "0.1"
    }
  },

  "event_history": [
    {
      "event_id": "01JMFG0001AAAAAAAAAAAAAA01",
      "event_type": "receipt.created",
      "content_hash": "sha256:a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2",
      "timestamp": "2026-02-25T12:00:00Z",
      "source": "local",
      "detail": {},
      "actor": "Pro777"
    },
    {
      "event_id": "01JMFG0002AAAAAAAAAAAAAA02",
      "event_type": "receipt.validated",
      "content_hash": "sha256:a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2",
      "timestamp": "2026-02-25T12:01:00Z",
      "source": "local",
      "detail": {},
      "actor": "ship-receipts-cli"
    },
    {
      "event_id": "01JMFG0003AAAAAAAAAAAAAA03",
      "event_type": "receipt.scored",
      "content_hash": "sha256:a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2",
      "timestamp": "2026-02-25T12:05:00Z",
      "source": "local",
      "detail": {
        "score": 39,
        "base_score": 21,
        "streak_days": 8
      },
      "actor": "ship-receipts-cli"
    },
    {
      "event_id": "01JMFG0004AAAAAAAAAAAAAA04",
      "event_type": "envelope.exported",
      "content_hash": "sha256:a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2",
      "envelope_id": "01JMFGHT5V4KXRB9NWQZ3P7Y2D",
      "timestamp": "2026-02-25T14:30:00Z",
      "source": "local",
      "detail": {},
      "actor": "ship-receipts-cli"
    },
    {
      "event_id": "01JMFG0005AAAAAAAAAAAAAA05",
      "event_type": "envelope.submitted",
      "content_hash": "sha256:a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2",
      "envelope_id": "01JMFGHT5V4KXRB9NWQZ3P7Y2D",
      "timestamp": "2026-02-25T14:30:05Z",
      "source": "global",
      "detail": {},
      "actor": "proofofship-api"
    },
    {
      "event_id": "01JMFG0006AAAAAAAAAAAAAA06",
      "event_type": "envelope.accepted",
      "content_hash": "sha256:a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2",
      "envelope_id": "01JMFGHT5V4KXRB9NWQZ3P7Y2D",
      "timestamp": "2026-02-25T14:30:06Z",
      "source": "global",
      "detail": {},
      "actor": "proofofship-api"
    },
    {
      "event_id": "01JMFG0007AAAAAAAAAAAAAA07",
      "event_type": "envelope.verified",
      "content_hash": "sha256:a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2",
      "envelope_id": "01JMFGHT5V4KXRB9NWQZ3P7Y2D",
      "timestamp": "2026-02-25T14:31:00Z",
      "source": "global",
      "detail": {
        "verification_depth": 0.8,
        "pipeline_version": "1.0",
        "stages": {
          "schema": { "pass": true },
          "dedup": { "pass": true },
          "identity": { "pass": true },
          "artifact": { "pass": true },
          "signature": { "pass": true },
          "attestation": { "pass": false, "reason": "no attestations present" }
        }
      },
      "actor": "proofofship-verifier"
    }
  ],

  "score_breakdown_comment": "Illustrative only: base 15 with a streak multiplier of 1.5x yields final 22.",
  "_notes": "Full recount: subject.name=1, profiles=2, immutable_ref=2, ci_url=1, checksum_verify=3, link_verify=1, command_verify=2, signals(stars+dependents+downloads_30d=3 non-zero signals)=3. No meta.created_at or meta.content_hash in v0.1. Total base=15. With 8-day streak (1.5x) and no integrity bonus (no valid content_hash in v0.1), floor(15 * 1.5)=22. local_score_snapshot in this example is illustrative."
}
```

**Step 2: Verify example is valid JSON**

Run: `python3 -c "import json; json.load(open('examples/local-to-global-proof-example.v1.json')); print('VALID JSON')"` from repo root.
Expected: `VALID JSON`

**Step 3: Validate the envelope portion against the schema**

Run:
```bash
python3 -c "
import json
from jsonschema import validate, Draft202012Validator

schema = json.load(open('schemas/proof-envelope.v1.json'))
example = json.load(open('examples/local-to-global-proof-example.v1.json'))
envelope = example['proof_envelope']
validate(instance=envelope, schema=schema, cls=Draft202012Validator)
print('ENVELOPE VALIDATES')
"
```
Expected: `ENVELOPE VALIDATES`

If jsonschema not installed: `pip3 install jsonschema`

**Step 4: Validate the event history against the event schema**

Run:
```bash
python3 -c "
import json
from jsonschema import validate, Draft202012Validator

schema = json.load(open('schemas/receipt-event.v1.json'))
example = json.load(open('examples/local-to-global-proof-example.v1.json'))
for i, event in enumerate(example['event_history']):
    validate(instance=event, schema=schema, cls=Draft202012Validator)
    print(f'Event {i+1} ({event[\"event_type\"]}): VALID')
print('ALL EVENTS VALIDATE')
"
```
Expected: All 7 events validate.

**Step 5: Commit**

```bash
git add examples/local-to-global-proof-example.v1.json
git commit -m "examples: add end-to-end local-to-global proof example"
```

---

## Task 4: Write Integration Doc

**Files:**
- Create: `docs/integration/ship-receipts-to-proofofship-v1.md`

This is the technical reference doc. Content is derived from the approved design doc at `docs/plans/2026-02-25-ship-receipts-to-proofofship-integration-design.md`. Includes:

- Field mapping table (with required/optional)
- Validation order and failure codes
- Idempotency and dedupe keys (content_hash)
- Versioning strategy
- Privacy boundaries
- Links to schemas and example

**Step 1: Write the doc** (full content in implementation)

**Step 2: Commit**

```bash
git add docs/integration/ship-receipts-to-proofofship-v1.md
git commit -m "docs: add ship-receipts to proofofship integration spec v1"
```

---

## Task 5: Write Seton Handoff Packet

**Files:**
- Create: `docs/integration/handoff-packet-for-seton-v1.md`

This doc gives Seton (Claude Cowork) everything needed to build game mode UX without guessing. Includes:

- Status badges (state → badge → color → source event)
- Score components (base breakdown, streak, integrity, global)
- Verification progress states (6-stage checklist)
- Party mode concept: user selects own GH profile, can "Add to Party" any public GH user
- Schema file locations and how to read them
- Example file location and what it demonstrates
- Event stream format for driving UI state machines
- What NOT to build (no auth, no networking, no server calls)

**Step 1: Write the doc** (full content in implementation)

**Step 2: Commit**

```bash
git add docs/integration/handoff-packet-for-seton-v1.md
git commit -m "docs: add Seton handoff packet for game mode UX v1"
```

---

## Task 6: Write Stub Export Script

**Files:**
- Create: `scripts/export_proof_envelope.py`

**Step 1: Write the script**

A minimal Python script that:
1. Reads a ship-receipt JSON file
2. Validates it against the v0.1 schema
3. Extracts GitHub username from profiles
4. Computes content_hash (SHA-256 canonical JSON)
5. Generates envelope_id (ULID)
6. Wraps in proof envelope
7. Validates envelope against proof-envelope.v1.json schema
8. Writes to stdout or output file

Dependencies: `jsonschema`, `ulid-py` (or inline ULID generation)

**Step 2: Test it against the example receipt**

Run: `python3 scripts/export_proof_envelope.py examples/ship-receipts.example.json --output /tmp/test-envelope.json`
Expected: Valid envelope JSON written. Validate with schema.

**Step 3: Commit**

```bash
git add scripts/export_proof_envelope.py
git commit -m "scripts: add stub proof envelope export tool"
```

---

## Task 7: Final Validation Pass

**Step 1: Run all schema validations end-to-end**

Validate example envelope against proof-envelope schema.
Validate all events against receipt-event schema.
Validate embedded receipt against ship-receipts v0.1 schema.

**Step 2: Verify all files committed**

Run: `git status` — should be clean.

**Step 3: Commit any final tweaks**

---

## File Manifest

| Deliverable | Path |
|---|---|
| Integration spec | `docs/integration/ship-receipts-to-proofofship-v1.md` |
| Seton handoff | `docs/integration/handoff-packet-for-seton-v1.md` |
| Proof envelope schema | `schemas/proof-envelope.v1.json` |
| Receipt event schema | `schemas/receipt-event.v1.json` |
| E2E example | `examples/local-to-global-proof-example.v1.json` |
| Stub export script | `scripts/export_proof_envelope.py` |
| Design doc | `docs/plans/2026-02-25-ship-receipts-to-proofofship-integration-design.md` |
| This plan | `docs/plans/2026-02-25-integration-artifacts.md` |
