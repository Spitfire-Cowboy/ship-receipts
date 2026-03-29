# Ship Receipts API Contract v1

**Status:** DRAFT
**Date:** 2026-02-25
**Author:** Campion (spec pass)
**Scope:** Local CLI commands only. No HTTP API in v1.

---

## Overview

V1 is a CLI tool. No server, no HTTP endpoints, no database. All operations are local filesystem operations.

The "API" is the CLI command interface. This doc specifies exact inputs, outputs, and exit codes.

---

## Commands

### `ship-receipts init`

Create a new receipt interactively or from flags.

**Usage:**
```
ship-receipts init [options]
ship-receipts init --name "MyProject" --kind repo --url https://github.com/me/myproject
```

**Options:**

| Flag | Type | Required | Description |
|------|------|----------|-------------|
| `--name` | string | No | Artifact name (prompted if missing) |
| `--kind` | string | No | Artifact kind (prompted if missing) |
| `--url` | string | No | Artifact URL (prompted if missing) |
| `--subject` | string | No | Builder name (prompted if missing) |
| `--output`, `-o` | string | No | Output file path. Default: `<name>.receipt.json` |
| `--hash` | bool | No | Compute and include content_hash. Default: true |
| `--no-hash` | bool | No | Skip content_hash computation |

**Behavior:**
1. If flags provided, use them. Prompt for any missing required fields.
2. Generate receipt JSON with `version: "1.0"`.
3. Compute `meta.content_hash` (unless `--no-hash`).
4. Set `meta.created_at` to current UTC time.
5. Set `meta.generator` to `ship-receipts-cli/<version>`.
6. Write to output file.

**Output (stdout):**
```
Created: my-project.receipt.json
Hash:    sha256:abc123...
```

**Exit codes:**

| Code | Meaning |
|------|---------|
| 0 | Success |
| 1 | Invalid input (bad kind, empty name, etc.) |
| 2 | File write error |

---

### `ship-receipts validate`

Validate a receipt against the v1 schema.

**Usage:**
```
ship-receipts validate <file>
ship-receipts validate <file> --strict
```

**Arguments:**

| Arg | Type | Required | Description |
|-----|------|----------|-------------|
| `file` | path | Yes | Receipt JSON file to validate |

**Options:**

| Flag | Type | Description |
|------|------|-------------|
| `--strict` | bool | Also verify content_hash if present. Default: false |
| `--json` | bool | Output result as JSON. Default: false |

**Behavior:**
1. Read and parse the JSON file.
2. Validate against v1 schema (accepts both v0.1 and v1.0 receipts).
3. If `--strict`: verify `meta.content_hash` matches computed hash.
4. Report all validation errors, not just the first.

**Output (stdout, default):**
```
PASS  my-project.receipt.json
  Schema:    valid
  Hash:      valid (sha256:abc123...)
  Artifacts: 1
  Proofs:    3 (1 checksum, 1 link, 1 command)
```

Or on failure:
```
FAIL  my-project.receipt.json
  Error: artifacts[0].kind must be one of: repo, release, package, dataset, paper, demo, other
  Error: meta.content_hash does not match computed hash
```

**Output (stdout, --json):**
```json
{
  "file": "my-project.receipt.json",
  "valid": false,
  "errors": [
    {"path": "artifacts[0].kind", "message": "must be one of: repo, release, package, dataset, paper, demo, other"},
    {"path": "meta.content_hash", "message": "does not match computed hash"}
  ],
  "stats": {
    "artifacts": 1,
    "proofs": 0
  }
}
```

**Exit codes:**

| Code | Meaning |
|------|---------|
| 0 | Valid |
| 1 | Invalid (schema errors or hash mismatch) |
| 2 | File not found or parse error |

---

### `ship-receipts score`

Score a receipt and update local game state.

**Usage:**
```
ship-receipts score <file>
ship-receipts score <file> --dry-run
```

**Arguments:**

| Arg | Type | Required | Description |
|-----|------|----------|-------------|
| `file` | path | Yes | Receipt JSON file to score |

**Options:**

| Flag | Type | Description |
|------|------|-------------|
| `--dry-run` | bool | Score without updating state file. Default: false |
| `--json` | bool | Output result as JSON. Default: false |

**Behavior:**
1. Validate receipt (runs full validation first).
2. If invalid: reject, emit `receipt.rejected` event, exit 1.
3. Check for duplicate hash in `known_hashes`. If duplicate: emit `receipt.duplicate` event, exit 1.
4. Compute base score from proof element table.
5. Apply anti-slop rule: if base_score < 6, score is 0 and does not count toward streak.
6. Look up current streak multiplier.
7. Check integrity bonus eligibility.
8. Compute final score.
9. Update state file (unless `--dry-run`).
10. Emit appropriate events.
11. Display score breakdown.

**Output (stdout, default):**
```
Receipt: my-project.receipt.json
Subject: BuilderName
Status:  ACCEPTED

  Base Score:          12
  Streak Multiplier:   1.5x (7-day streak)
  Integrity Bonus:     1.0x
  ---
  Final Score:         18

  Proof Breakdown:
    subject.name           1
    subject.profiles       2
    meta.created_at        1
    meta.content_hash      3
    artifact[0].immutable  2
    artifact[0].ci_url     1
    artifact[0].checksum   3
                          --
    Base Total            12

  Streak: 7 days (next: 1.75x at 14 days)
  Total Score: 160 (12 receipts)
```

**Output (stdout, --json):**
```json
{
  "file": "my-project.receipt.json",
  "subject": "BuilderName",
  "status": "accepted",
  "score": {
    "base": 12,
    "streak_multiplier": 1.5,
    "integrity_multiplier": 1.0,
    "final": 18
  },
  "breakdown": {
    "subject.name": 1,
    "subject.profiles": 2,
    "meta.created_at": 1,
    "meta.content_hash": 3,
    "artifacts[0].immutable_ref": 2,
    "artifacts[0].ci_url": 1,
    "artifacts[0].verify[0].checksum": 3
  },
  "streak": {
    "current": 7,
    "next_multiplier_at": 14
  },
  "total": {
    "score": 160,
    "receipts": 12
  }
}
```

**Exit codes:**

| Code | Meaning |
|------|---------|
| 0 | Scored successfully |
| 1 | Validation failed or duplicate |
| 2 | File not found or state file error |

---

### `ship-receipts streak`

Show current streak information.

**Usage:**
```
ship-receipts streak
ship-receipts streak --json
```

**Options:**

| Flag | Type | Description |
|------|------|-------------|
| `--json` | bool | Output as JSON. Default: false |

**Behavior:**
1. Read state file.
2. Check if streak is still active (last qualifying date = yesterday or today).
3. Display streak info.

**Output (stdout, default):**
```
Streak:  7 days (active)
Started: 2026-02-19
Last:    2026-02-25
Longest: 12 days

Multiplier: 1.5x
Next:       1.75x at 14 days (7 more days)

Total Score: 160 (12 receipts)
```

If streak is broken:
```
Streak:  0 days (broken)
Last:    2026-02-23 (2 days ago)
Longest: 12 days

Multiplier: 1.0x
Next:       1.25x at 3 days

Total Score: 142 (11 receipts)
```

**Exit codes:**

| Code | Meaning |
|------|---------|
| 0 | Success |
| 2 | State file not found (no receipts scored yet) |

---

## State File Location

**Path:** `.ship-receipts/game-state.json` relative to CWD.

**Creation:** Auto-created on first `score` command.

**Directory structure:**
```
.ship-receipts/
  game-state.json
```

Future versions may add:
```
.ship-receipts/
  game-state.json
  receipts/          # cached receipt copies
  events.jsonl       # event log (separate from state)
```

---

## Error Messages

All errors write to stderr. All normal output writes to stdout.

**Standard error format:**
```
error: <message>
  at: <file>:<path> (if applicable)
  hint: <suggestion> (if applicable)
```

**Examples:**
```
error: receipt validation failed
  at: my-project.receipt.json:artifacts[0].kind
  hint: kind must be one of: repo, release, package, dataset, paper, demo, other
```

```
error: duplicate receipt
  at: my-project.receipt.json
  hint: receipt with hash sha256:abc123... was already scored on 2026-02-24
```

```
error: content hash mismatch
  at: my-project.receipt.json:meta.content_hash
  hint: expected sha256:abc123..., got sha256:def456...
```

---

## Future Commands (Not in V1)

Reserved for future versions. Do not implement.

| Command | Purpose | Version |
|---------|---------|---------|
| `ship-receipts render <file>` | Output markdown summary | v1.1 |
| `ship-receipts verify <file>` | Resolve URLs and run commands | v2 |
| `ship-receipts push <file>` | Submit to proofofship.com | v2 |
| `ship-receipts leaderboard` | Show global rankings | v2 (proofofship) |
| `ship-receipts history` | Show scoring history | v1.1 |

---

## What Cowork Needs Next

1. **Pick a CLI framework** and implement the four commands: `init`, `validate`, `score`, `streak`.
2. **Implement `validate` first** — it's the foundation. Everything else calls it.
3. **Implement `score` second** — it's the game loop entry point.
4. **Implement `init` third** — it creates receipts for testing.
5. **Implement `streak` last** — it's a state reader, simplest command.
6. **Write tests for each command** — especially edge cases around hash computation and streak date logic.
