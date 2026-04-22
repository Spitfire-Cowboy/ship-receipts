# Local-to-Global Proof Envelope v1

**Status:** SPEC
**Date:** 2026-02-25
**Author:** Campion
**Depends on:** proof-envelope.v1.json, ship-receipts-scoring-model-v1.md
**Research:** 2026-02-arxiv-math-and-reputation-map.md (R5, R18, R19)

---

## Purpose

This spec defines the exact process for exporting a local ship-receipt into a proof envelope for submission to proofofship. The envelope is the bridge between the local game loop (ship-receipts) and the global reputation ledger (proofofship).

---

## 1. Envelope Structure

Conforms to `schemas/proof-envelope.v1.json`. Key fields:

```
{
  envelope_version: "1.0",
  envelope_id: ULID (generated at export),
  content_hash: sha256 of canonical receipt JSON (THE idempotency key),
  submitted_at: ISO 8601 timestamp,
  actor: { github_username, display_name, profile_urls },
  receipt: <full original receipt>,
  local_score_snapshot: <optional, informational only>,
  export_metadata: { generator, generator_version, ship_receipts_schema_version }
}
```

---

## 2. Export Algorithm

```python
import json, hashlib, datetime
from ulid import ULID

def export_proof_envelope(
    receipt: dict,
    game_state: dict,
) -> dict:
    """
    Convert a scored local receipt into a proof envelope.

    Preconditions:
    - receipt is schema-valid
    - receipt has been scored locally (score > 0)
    - receipt content_hash is valid (if present)
    """

    # 1. Extract actor from receipt
    actor = extract_actor(receipt)

    # 2. Compute canonical content hash
    content_hash = compute_content_hash(receipt)

    # 3. Snapshot local score (informational)
    local_snapshot = extract_local_snapshot(receipt, game_state)

    # 4. Build envelope
    envelope = {
        "envelope_version": "1.0",
        "envelope_id": str(ULID()),
        "content_hash": content_hash,
        "submitted_at": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        "actor": actor,
        "receipt": receipt,  # Embedded verbatim
        "export_metadata": {
            "generator": "ship-receipts-cli",
            "generator_version": "0.1.0",
            "ship_receipts_schema_version": "0.1",
        },
    }

    if local_snapshot:
        envelope["local_score_snapshot"] = local_snapshot

    return envelope


def extract_actor(receipt: dict) -> dict:
    """Extract actor identity from receipt subject."""
    subject = receipt.get("subject", {})
    profiles = subject.get("profiles", [])

    github_username = None
    profile_urls = []

    for p in profiles:
        url = p.get("url", "")
        profile_urls.append(url)
        if p.get("kind") == "github" and "/" in url:
            # Extract username from GitHub URL
            github_username = url.rstrip("/").split("/")[-1]

    if not github_username:
        raise ValueError("No GitHub profile found in receipt subject.profiles")

    return {
        "github_username": github_username,
        "display_name": subject.get("name", github_username),
        "profile_urls": profile_urls,
    }


def compute_content_hash(receipt: dict) -> str:
    """
    Compute SHA-256 of canonical receipt JSON.
    Canonical form: sorted keys, no whitespace, UTF-8.
    The content_hash field itself is excluded from the hash computation.
    """
    receipt_copy = json.loads(json.dumps(receipt))
    receipt_copy.get("meta", {}).pop("content_hash", None)
    canonical = json.dumps(receipt_copy, sort_keys=True, separators=(",", ":"))
    hex_digest = hashlib.sha256(canonical.encode("utf-8")).hexdigest()
    return f"sha256:{hex_digest}"


def extract_local_snapshot(receipt: dict, game_state: dict) -> dict | None:
    """
    Extract local score snapshot from game state.
    Returns None if receipt hasn't been scored locally.
    """
    content_hash = receipt.get("meta", {}).get("content_hash")
    if not content_hash:
        return None

    for entry in game_state.get("history", []):
        if entry.get("receipt_hash") == content_hash:
            return {
                "base_score": entry["breakdown"]["base"],
                "final_score": entry["score"],
                "streak_days": game_state.get("streak", {}).get("current", 0),
                "streak_multiplier": entry["breakdown"].get("streak_multiplier", 1.0),
                "integrity_multiplier": entry["breakdown"].get("integrity_multiplier", 1.0),
                "computed_at": datetime.datetime.now(datetime.timezone.utc).isoformat(),
            }

    return None
```

---

## 3. Trust Boundary

**Critical:** The proof envelope's `local_score_snapshot` is **informational only**. Proofofship NEVER trusts it.

```
LOCAL (ship-receipts)          │  GLOBAL (proofofship)
                               │
receipt → score → envelope ──────→ ingest → re-verify → depth → reputation
                               │
local_score_snapshot ──────────────→ displayed but NOT used in scoring
```

The local score tells proofofship "the builder thinks this receipt scored X locally." Proofofship ignores this for reputation computation and runs its own verification pipeline.

Why: Local scores are trivially fabricatable. Anyone can edit their game-state.json. Only proofofship's independent verification has authority.

---

## 4. Content Hash as Idempotency Key

The `content_hash` field serves triple duty:

1. **Local:** Dedup within the local game state
2. **Envelope:** The immutable identifier for this receipt across systems
3. **Global:** Idempotency key in proofofship's ledger

Same receipt → same content_hash → same ledger entry. Submitting the same envelope multiple times is safe.

### Hash Computation Rules

- **Input:** Receipt JSON without the `meta.content_hash` field
- **Normalization:** `json.dumps(receipt, sort_keys=True, separators=(",", ":"))`
- **Algorithm:** SHA-256
- **Format:** `sha256:<hex_lowercase>`

### Collision Avoidance

SHA-256 collision probability is negligible (~2^-128 for birthday attack). No additional collision handling needed for v1.

---

## 5. Export Preconditions

| Condition | Failure Mode |
|-----------|-------------|
| Receipt is schema-valid | Error: "receipt fails schema validation" |
| Receipt has at least one artifact | Error: "receipt has no artifacts" |
| Receipt has a GitHub profile in subject.profiles | Error: "no GitHub profile found" |
| Receipt scored > 0 locally | Warning: "receipt scored 0 — exporting anyway" |
| Content hash is valid (if present) | Error: "content hash mismatch" |

Note: A receipt with score 0 CAN be exported (proofofship will re-evaluate independently) but a warning is emitted.

---

## 6. CLI Command

```
ship-receipts export <receipt-file> [--output <envelope-file>]
```

### Behavior

1. Read receipt from `<receipt-file>`
2. Validate against schema
3. Look up in local game state (if scored)
4. Build proof envelope
5. Validate envelope against `proof-envelope.v1.json`
6. Write to `<envelope-file>` (default: `<receipt-file>.envelope.json`)

### Example

```bash
$ ship-receipts export my-receipt.json
Exported proof envelope to my-receipt.envelope.json
  Content Hash: sha256:a1b2c3...
  Actor: Pro777
  Local Score: 18 (informational only)
  Envelope ID: 01HWXYZ...
```

---

## 7. Submission to Proofofship

After export, the envelope is submitted via:

```bash
$ curl -X POST https://proofofship.com/api/v1/envelopes \
    -H "Authorization: Bearer <github-oauth-token>" \
    -H "Content-Type: application/json" \
    -d @my-receipt.envelope.json
```

Response:
```json
{
  "entry_id": "01HWXYZ...",
  "status": "verified",
  "verification_depth": 0.6,
  "is_duplicate": false
}
```

Or for duplicates:
```json
{
  "entry_id": "01HWXYZ...",
  "status": "already_exists",
  "is_duplicate": true
}
```

---

## 8. Anti-Gaming Notes

### Envelope Tampering
If someone modifies the receipt after computing the content_hash, the hash won't match and proofofship will reject at Stage 2 (replay detection).

### Actor Spoofing
The envelope `actor.github_username` must match the authenticated OAuth session at submission time. Cannot submit on behalf of others.

### Local Score Inflation
Local score snapshot is informational only. Inflating it has zero effect on proofofship reputation.

---

## 9. Test Vectors

### Vector 1: Successful export
Input: schema-valid receipt with GitHub profile, scored locally at 18 points.
Expected: Valid envelope with all required fields, local_score_snapshot populated.

### Vector 2: Export without local scoring
Input: schema-valid receipt that hasn't been scored locally.
Expected: Valid envelope, local_score_snapshot is absent.

### Vector 3: Missing GitHub profile
Input: receipt with subject.profiles containing only "twitter" kind.
Expected: Error — "no GitHub profile found"

### Vector 4: Content hash mismatch
Input: receipt with meta.content_hash that doesn't match computed hash.
Expected: Error — "content hash mismatch"

### Vector 5: Idempotent re-export
Input: same receipt exported twice.
Expected: Two envelopes with different envelope_id but same content_hash. Proofofship accepts first, returns "already_exists" for second.
