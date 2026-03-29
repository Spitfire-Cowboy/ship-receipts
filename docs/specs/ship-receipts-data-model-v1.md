# Ship Receipts Data Model v1

**Status:** DRAFT
**Date:** 2026-02-25
**Author:** Campion (spec pass)
**Backwards Compat:** All v0.1 receipts MUST validate against v1 schema

---

## Design Principles

1. **Additive only** — V1 adds fields to v0.1. No removals, no renames.
2. **Optional by default** — New fields are optional. V0.1 receipts remain valid.
3. **Deterministic hashing** — Same logical receipt always produces same hash.
4. **No polymorphism** — Every field has exactly one type.

---

## Receipt Schema v1

### Top-Level Structure

```json
{
  "version": "1.0",
  "subject": { ... },
  "artifacts": [ ... ],
  "meta": { ... },
  "notes": "..."
}
```

### Required Fields

| Field | Type | Description |
|-------|------|-------------|
| `version` | string | Schema version. `"1.0"` for v1. |
| `subject` | object | Who is claiming this work. |
| `subject.name` | string | Builder name (human or agent). |
| `artifacts` | array | Shipped work items. Min 1. |
| `artifacts[].kind` | string enum | `repo`, `release`, `package`, `dataset`, `paper`, `demo`, `other` |
| `artifacts[].name` | string | Human-readable artifact name. |
| `artifacts[].url` | string | Primary URL for the artifact. |

### Optional Fields (new in v1)

| Field | Type | Description |
|-------|------|-------------|
| `subject.profiles` | array | Identity links. Each has `kind` (string) + `url` (string). |
| `meta` | object | Receipt metadata (new in v1). |
| `meta.created_at` | string | ISO 8601 timestamp of receipt creation. |
| `meta.content_hash` | string | `sha256:<hex>` hash of canonical receipt. |
| `meta.schema_version` | string | Redundant version for tooling. |
| `meta.generator` | string | Tool that created the receipt (e.g., `ship-receipts-cli/1.0`). |
| `artifacts[].version` | string | Artifact version string. |
| `artifacts[].immutable_ref` | string | Commit SHA, package digest, DOI, etc. |
| `artifacts[].ci_url` | string | CI/CD pipeline URL. |
| `artifacts[].verify` | array | Verification entries (see below). |
| `artifacts[].signals` | object | Social proof metrics (see below). |
| `notes` | string | Free-text notes about the receipt. |

### Verification Entry

Each entry in `artifacts[].verify[]`:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `kind` | string enum | Yes | `command`, `checksum`, `note`, `link`, `attestation` |
| `command` | string | If kind=command | Shell command to verify |
| `algo` | string | If kind=checksum | Hash algorithm (e.g., `sha256`) |
| `hash` | string | If kind=checksum | Expected hash value |
| `url` | string | If kind=link/attestation | Verification URL |
| `note` | string | If kind=note | Human-readable verification note |
| `attestation` | object | If kind=attestation | Freeform attestation data |

### Signals Object

`artifacts[].signals`:

| Field | Type | Description |
|-------|------|-------------|
| `dependents` | integer (>= 0) | Number of dependent projects |
| `downloads_30d` | integer (>= 0) | Downloads in last 30 days |
| `stars` | integer (>= 0) | Stars/likes/upvotes |
| `downstream_citations` | array of strings | URLs or identifiers of citing work |

---

## Backwards Compatibility

V1 schema MUST accept all valid v0.1 receipts. The strategy:

| V0.1 Field | V1 Treatment |
|------------|-------------|
| `version: "0.1"` | V1 schema accepts both `"0.1"` and `"1.0"` |
| All v0.1 fields | Unchanged in v1 |
| Missing `meta` | Optional; v0.1 receipts won't have it |
| `additionalProperties: true` | Preserved at all levels |

**Migration path:** A v0.1 receipt becomes a v1 receipt by changing `version` to `"1.0"` and optionally adding `meta`. No other changes required.

---

## Content Hash Strategy

### Algorithm

SHA-256 of the **canonical JSON** representation of the receipt.

### Canonical Form

1. Parse the receipt JSON.
2. Remove `meta.content_hash` if present (the hash cannot include itself).
3. Serialize to JSON with:
   - Keys sorted alphabetically at every nesting level
   - No whitespace (compact form)
   - UTF-8 encoding
   - No trailing newline
4. Compute SHA-256 of the resulting byte string.
5. Encode as lowercase hex.
6. Store as `meta.content_hash: "sha256:<hex>"`

### Example

Input receipt (simplified):
```json
{
  "version": "1.0",
  "subject": {"name": "Builder"},
  "artifacts": [{"kind": "repo", "name": "MyProject", "url": "https://github.com/me/myproject"}],
  "meta": {"created_at": "2026-02-25T14:00:00Z", "content_hash": "sha256:will-be-replaced"}
}
```

Step 1: Remove `meta.content_hash`:
```json
{
  "version": "1.0",
  "subject": {"name": "Builder"},
  "artifacts": [{"kind": "repo", "name": "MyProject", "url": "https://github.com/me/myproject"}],
  "meta": {"created_at": "2026-02-25T14:00:00Z"}
}
```

Step 2: Canonical JSON (sorted keys, compact):
```
{"artifacts":[{"kind":"repo","name":"MyProject","url":"https://github.com/me/myproject"}],"meta":{"created_at":"2026-02-25T14:00:00Z"},"subject":{"name":"Builder"},"version":"1.0"}
```

Step 3: SHA-256 of that string = `sha256:<computed-hex>`

### Verification

To verify a receipt's hash:
1. Read `meta.content_hash`
2. Remove it from the receipt
3. Compute canonical hash
4. Compare. Match = valid. Mismatch = tampered.

---

## Proof Primitives (Detailed)

### Provenance Proof

**Purpose:** Establish who created the receipt and when.

**Components:**
- `subject.name` (required) — The claimed identity
- `subject.profiles[]` (optional) — External identity links
- `meta.created_at` (optional) — When the receipt was created
- `meta.generator` (optional) — What tool created it

**What it proves in v1:** Nothing cryptographically. It's a claim. V2 may add signatures.

**What it enables:** Attribution, deduplication by subject, game loop identity.

### Integrity Proof

**Purpose:** Detect tampering after receipt creation.

**Components:**
- `meta.content_hash` — SHA-256 of canonical receipt (see above)
- `artifacts[].immutable_ref` — Pinned reference to a specific version
- `artifacts[].verify[kind=checksum]` — Hash of the artifact itself

**What it proves in v1:** The receipt hasn't changed since the hash was computed. The artifact had a known hash at receipt time.

**What it enables:** Tamper detection, score gating (invalid hash = score 0).

### Ship Proof

**Purpose:** Establish that the artifact exists and is reachable.

**Components:**
- `artifacts[].url` (required) — Where to find it
- `artifacts[].ci_url` (optional) — CI/CD evidence
- `artifacts[].verify[kind=link]` — Additional verification URLs
- `artifacts[].verify[kind=command]` — Commands that can verify
- `artifacts[].signals` — Social proof (downloads, stars, etc.)

**What it proves in v1:** The builder knows a URL for the artifact and optionally provides supporting evidence. V1 does not resolve URLs.

**What it enables:** Scoring based on evidence depth. Future automated verification.

---

## Event Model

Events record every state change in the game loop. They are append-only.

### Event Envelope

```json
{
  "id": "evt_<ulid>",
  "type": "<event_type>",
  "timestamp": "<iso8601>",
  "payload": { ... }
}
```

### Event Types

| Type | Payload Fields | Description |
|------|---------------|-------------|
| `receipt.submitted` | `receipt_hash`, `score`, `breakdown` | Receipt accepted and scored |
| `receipt.rejected` | `receipt_hash`, `reason` | Receipt failed validation |
| `receipt.duplicate` | `receipt_hash` | Hash already in state |
| `streak.advanced` | `new_length`, `date` | Streak incremented |
| `streak.broken` | `previous_length`, `break_date` | Streak reset |

### ID Format

Event IDs use ULID (Universally Unique Lexicographically Sortable Identifier):
- Timestamp-ordered
- 128-bit, encoded as 26-character string
- Example: `01ARZ3NDEKTSV4RRFFQ69G5FAV`
- Prefixed with `evt_` for readability

---

## State File Schema

File: `.ship-receipts/game-state.json`

```json
{
  "$schema": "local",
  "version": "1",
  "subject": "<string>",
  "total_score": "<integer>",
  "receipts_submitted": "<integer>",
  "receipts_rejected": "<integer>",
  "streak": {
    "current": "<integer>",
    "longest": "<integer>",
    "last_qualifying_date": "<YYYY-MM-DD>",
    "streak_start_date": "<YYYY-MM-DD | null>"
  },
  "history": [
    {
      "receipt_hash": "sha256:<hex>",
      "score": "<integer>",
      "date": "<YYYY-MM-DD>",
      "breakdown": {
        "base": "<integer>",
        "streak_multiplier": "<float>",
        "integrity_multiplier": "<float>"
      }
    }
  ],
  "events": [
    "<Event Envelope>"
  ],
  "known_hashes": ["sha256:<hex>"]
}
```

`known_hashes` is a flat array for O(1) duplicate detection (loaded into a Set at runtime).

---

## Type Reference (for implementors)

```typescript
// Receipt v1
interface Receipt {
  version: "0.1" | "1.0";
  subject: Subject;
  artifacts: Artifact[];   // minItems: 1
  meta?: Meta;
  notes?: string;
}

interface Subject {
  name: string;
  profiles?: Profile[];
}

interface Profile {
  kind: string;
  url: string;
}

interface Meta {
  created_at?: string;     // ISO 8601
  content_hash?: string;   // "sha256:<hex>"
  schema_version?: string;
  generator?: string;
}

interface Artifact {
  kind: "repo" | "release" | "package" | "dataset" | "paper" | "demo" | "other";
  name: string;
  url: string;
  version?: string;
  immutable_ref?: string;
  ci_url?: string;
  verify?: VerifyEntry[];
  signals?: Signals;
}

interface VerifyEntry {
  kind: "command" | "checksum" | "note" | "link" | "attestation";
  command?: string;
  algo?: string;
  hash?: string;
  url?: string;
  note?: string;
  attestation?: Record<string, unknown>;
}

interface Signals {
  dependents?: number;
  downloads_30d?: number;
  stars?: number;
  downstream_citations?: string[];
}
```

---

## What Cowork Needs Next

1. **Update JSON Schema file** — Translate the v1 data model into `schema/ship-receipts.v1.schema.json`. Keep v0.1 schema file unchanged.
2. **Create v1 example** — New example receipt with `meta` block and content_hash.
3. **Implement canonical hash function** — This is the highest-risk piece. Get it right first. Test with known inputs.
4. **ULID generation** — Pick a ULID library for the chosen language, or implement the spec (it's simple).
