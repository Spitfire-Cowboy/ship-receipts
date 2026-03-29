# Ship-Receipts → Proofofship Integration Smoke v1

**Date:** 2026-02-25
**Author:** Campion
**Status:** EXECUTABLE

---

## Overview

End-to-end flow: generate receipt → score locally → export envelope → validate for proofofship ingestion.

---

## Prerequisites

```bash
# Both repos cloned side by side:
# C:\Work\git-repos\ship-receipts
# C:\Work\git-repos\proofofship

# Python 3.10+ with pytest installed
pip install pytest
```

---

## Step 1: Generate a Receipt

Create `smoke-receipt.json`:

```json
{
  "version": "0.1",
  "subject": {
    "name": "SmokeTest Builder",
    "profiles": [
      {"kind": "github", "url": "https://github.com/smoketest"}
    ]
  },
  "meta": {
    "created_at": "2026-02-25T12:00:00Z"
  },
  "artifacts": [
    {
      "kind": "repo",
      "name": "smoke-app",
      "url": "https://github.com/smoketest/smoke-app",
      "immutable_ref": "abc123def456",
      "ci_url": "https://github.com/smoketest/smoke-app/actions/runs/1",
      "verify": [
        {
          "kind": "checksum",
          "algo": "sha256",
          "hash": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
        },
        {
          "kind": "command",
          "command": "npm test"
        }
      ],
      "signals": {
        "stars": 10,
        "downloads_30d": 500
      }
    }
  ]
}
```

---

## Step 2: Score Locally

```python
# Run from ship-receipts repo root
import json, sys
sys.path.insert(0, ".")
from src.scoring.state import GameState
from src.scoring.hash_validator import compute_content_hash

# Load receipt
with open("smoke-receipt.json") as f:
    receipt = json.load(f)

# Add content hash
receipt.setdefault("meta", {})["content_hash"] = compute_content_hash(receipt)

# Score
state = GameState(root_dir=".")
result = state.score_receipt(receipt)
state.save()

print(json.dumps(result, indent=2))
```

**Expected output:**
```json
{
  "status": "ACCEPTED",
  "score": 22,
  "base_score": 15,
  "breakdown": {
    "subject.name": 1,
    "subject.profiles": 2,
    "meta.created_at": 1,
    "meta.content_hash": 3,
    "artifact[0].immutable_ref": 2,
    "artifact[0].ci_url": 1,
    "artifact[0].verify[0].checksum": 3,
    "artifact[0].verify[1].command": 2,
    "artifact[0].signals.stars": 1,
    "artifact[0].signals.downloads_30d": 1
  },
  "multipliers": {
    "base": 15,
    "streak_multiplier": 1.0,
    "integrity_multiplier": 1.5
  },
  "streak": 1,
  "confidence": "strong",
  "qualifies_for_streak": true
}
```

Note: `score` = floor(15 × 1.0 × 1.5) = 22.

---

## Step 3: Export Proof Envelope

```python
from src.envelope.export import export_proof_envelope

envelope = export_proof_envelope(receipt, state.state)
with open("smoke-envelope.json", "w") as f:
    json.dump(envelope, f, indent=2)

print(f"Envelope ID: {envelope['envelope_id']}")
print(f"Content Hash: {envelope['content_hash']}")
print(f"Actor: {envelope['actor']['github_username']}")
```

---

## Step 4: Ingest into Proofofship

```python
# Run from proofofship repo root
import json, sys
sys.path.insert(0, ".")
from src.ledger.store import LedgerStore

# Load envelope
with open("../ship-receipts/smoke-envelope.json") as f:
    envelope = json.load(f)

# Ingest
store = LedgerStore("smoke-ledger.db")
result = store.ingest(envelope, authenticated_user="smoketest")

print(f"Entry ID: {result.entry_id}")
print(f"Status: {result.status}")
print(f"Duplicate: {result.is_duplicate}")
print(f"Verification Depth: {result.verification_depth}")
```

**Expected output:**
```
Entry ID: 01HW...
Status: verified
Duplicate: False
Verification Depth: 0.6
```

---

## Step 5: Compute Reputation

```python
from src.reputation.aggregator import reputation_score, actor_confidence

entries = store.get_entries_for_actor("smoketest")
score, breakdown = reputation_score("smoketest", entries)
confidence = actor_confidence(score, len(entries))

print(f"Reputation Score: {score}")
print(f"Confidence Tier: {confidence}")
print(f"Breakdown: {json.dumps(breakdown, indent=2)}")
```

**Expected output:**
```
Reputation Score: 0.6
Confidence Tier: established
Breakdown: [
  {
    "entry_id": "01HW...",
    "age_days": 0.0,
    "time_weight": 1.0,
    "depth": 0.6,
    "dispute_mult": 1.0,
    "contribution": 0.6
  }
]
```

---

## Step 6: Verify Idempotency

```python
# Re-ingest same envelope
result2 = store.ingest(envelope, authenticated_user="smoketest")
print(f"Status: {result2.status}")
print(f"Duplicate: {result2.is_duplicate}")
print(f"Entry ID matches: {result2.entry_id == result.entry_id}")
```

**Expected output:**
```
Status: already_exists
Duplicate: True
Entry ID matches: True
```

---

## Automated Smoke Script

See `scripts/smoke_integration.py` in each repo for a single-file executable version of this flow.
