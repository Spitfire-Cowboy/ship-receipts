# Ship Receipts Scoring Model v1

**Status:** SPEC
**Date:** 2026-02-25
**Author:** Campion
**Depends on:** ship-receipts-game-loop-local-v1.md, proof-envelope.v1.json
**Research:** 2026-02-arxiv-math-and-reputation-map.md (R2, R5, R10, R13)

---

## Purpose

This spec defines the exact formulas, algorithms, and edge cases for the local scoring engine. It is the implementation contract — code must match this spec exactly.

---

## 1. Input: Receipt JSON

A valid receipt conforms to `schema/ship-receipts.v0.1.schema.json` and contains:
- `subject` (name, profiles)
- `meta` (created_at, content_hash)
- `artifacts[]` (each with optional immutable_ref, ci_url, verify[], signals)

---

## 2. Base Score Computation

```python
def compute_base_score(receipt: dict) -> tuple[int, dict]:
    """Returns (base_score, breakdown_dict)."""
    breakdown = {}
    score = 0

    # Subject fields
    if receipt.get("subject", {}).get("name"):
        breakdown["subject.name"] = 1
        score += 1

    profiles = receipt.get("subject", {}).get("profiles", [])
    valid_profiles = [p for p in profiles if p.get("kind") and p.get("url")]
    if valid_profiles:
        breakdown["subject.profiles"] = 2
        score += 2

    # Meta fields
    meta = receipt.get("meta", {})
    if meta.get("created_at"):
        breakdown["meta.created_at"] = 1
        score += 1

    if meta.get("content_hash"):
        breakdown["meta.content_hash"] = 3  # Awarded only if valid; see §3
        score += 3

    # Artifact fields (per artifact)
    for i, artifact in enumerate(receipt.get("artifacts", [])):
        prefix = f"artifact[{i}]"

        if artifact.get("immutable_ref"):
            breakdown[f"{prefix}.immutable_ref"] = 2
            score += 2

        if artifact.get("ci_url"):
            breakdown[f"{prefix}.ci_url"] = 1
            score += 1

        for j, v in enumerate(artifact.get("verify", [])):
            vprefix = f"{prefix}.verify[{j}]"

            if v.get("checksum") and v["checksum"].get("algo") and v["checksum"].get("hash"):
                breakdown[f"{vprefix}.checksum"] = 3
                score += 3

            if v.get("link"):
                breakdown[f"{vprefix}.link"] = 1
                score += 1

            if v.get("command"):
                breakdown[f"{vprefix}.command"] = 2
                score += 2

            if v.get("attestation"):
                breakdown[f"{vprefix}.attestation"] = 2
                score += 2

        signals = artifact.get("signals", {})
        for key in ["dependents", "downloads", "stars", "citations"]:
            val = signals.get(key)
            if val is not None and val > 0:
                breakdown[f"{prefix}.signals.{key}"] = 1
                score += 1

    return score, breakdown
```

---

## 3. Content Hash Validation

```python
import hashlib, json

def validate_content_hash(receipt: dict) -> bool:
    """
    Compute SHA-256 of the canonical receipt JSON (sorted keys,
    no extra whitespace, UTF-8) and compare to meta.content_hash.
    """
    claimed = receipt.get("meta", {}).get("content_hash", "")
    if not claimed.startswith("sha256:"):
        return False

    claimed_hex = claimed[7:]  # strip "sha256:" prefix

    # Canonical form: the receipt WITHOUT the content_hash field
    receipt_copy = json.loads(json.dumps(receipt))
    receipt_copy.get("meta", {}).pop("content_hash", None)

    canonical = json.dumps(receipt_copy, sort_keys=True, separators=(",", ":"))
    computed = hashlib.sha256(canonical.encode("utf-8")).hexdigest()

    return computed == claimed_hex
```

**Rule:** If `meta.content_hash` is present but `validate_content_hash()` returns `False`, the entire receipt scores **0** and is rejected. The 3 points for content_hash are only awarded when validation passes.

---

## 4. Anti-Slop Gate

```python
MINIMUM_QUALIFYING_SCORE = 6

def qualifies_for_streak(base_score: int) -> bool:
    return base_score >= MINIMUM_QUALIFYING_SCORE
```

Rationale (R10): Setting a minimum threshold prevents low-effort receipts from contributing to streak multipliers. The threshold of 6 requires meaningful proof beyond just `subject.name` (1 point).

---

## 5. Streak Multiplier

```python
STREAK_TIERS = [
    (5,  1.50),
    (3,  1.25),
    (2,  1.10),
]

def streak_multiplier(streak_days: int) -> float:
    for threshold, mult in STREAK_TIERS:
        if streak_days >= threshold:
            return mult
    return 1.0
```

---

## 6. Integrity Multiplier

```python
def integrity_multiplier(receipt: dict, hash_valid: bool) -> float:
    """
    1.5x if content_hash is valid AND at least one artifact
    has a checksum verification entry.
    """
    if not hash_valid:
        return 1.0

    for artifact in receipt.get("artifacts", []):
        for v in artifact.get("verify", []):
            if v.get("checksum") and v["checksum"].get("algo") and v["checksum"].get("hash"):
                return 1.5

    return 1.0
```

---

## 7. Final Score Formula

```python
import math

def compute_final_score(
    base_score: int,
    streak_days: int,
    receipt: dict,
    hash_valid: bool,
) -> int:
    s_mult = streak_multiplier(streak_days)
    i_mult = integrity_multiplier(receipt, hash_valid)
    return math.floor(base_score * s_mult * i_mult)
```

```
final_score = floor(base_score × streak_multiplier × integrity_multiplier)
```

**Properties:**
- Deterministic: same inputs → same output
- Non-negative: minimum is 0
- Bounded per receipt: practical ceiling ~60 for a single-artifact receipt at max streak + integrity
- Scales with artifact count (multiple artifacts = more proof surface)

---

## 8. Duplicate Detection

```python
def is_duplicate(content_hash: str, state: dict) -> bool:
    """Check if content_hash already exists in submitted history."""
    return any(
        h["receipt_hash"] == content_hash
        for h in state.get("history", [])
    )
```

Duplicate receipts score **0** and emit a `receipt.duplicate` event. They are NOT added to history.

---

## 9. Dispute Penalties

v1 dispute model is simple: disputes are manual flags that freeze a receipt's contribution.

```python
class DisputeStatus:
    NONE = "none"
    FLAGGED = "flagged"       # Under review
    UPHELD = "upheld"         # Receipt invalidated
    DISMISSED = "dismissed"   # Receipt restored

def dispute_penalty(receipt_entry: dict) -> float:
    """
    Returns a multiplier applied to the receipt's contribution.
    NONE or DISMISSED: 1.0 (full contribution)
    FLAGGED: 0.0 (frozen, no contribution while under review)
    UPHELD: 0.0 (permanently invalidated)
    """
    status = receipt_entry.get("dispute_status", DisputeStatus.NONE)
    if status in (DisputeStatus.NONE, DisputeStatus.DISMISSED):
        return 1.0
    return 0.0
```

When a dispute is upheld:
- The receipt's score contribution becomes 0
- The streak is NOT retroactively broken (too complex for v1)
- The receipt remains in history with `dispute_status: "upheld"`
- Total score is recalculated

---

## 10. Confidence Score Composition

Each receipt carries an implicit confidence level based on proof depth:

```python
def confidence_level(base_score: int, hash_valid: bool) -> str:
    """
    Confidence tiers for display and export.
    These map to how much weight proofofship should give in global aggregation.
    """
    if not hash_valid or base_score == 0:
        return "none"        # 0.0 — no trust
    if base_score < 6:
        return "minimal"     # 0.2 — schema-valid but thin proof
    if base_score < 12:
        return "moderate"    # 0.5 — decent proof surface
    if base_score < 20:
        return "strong"      # 0.8 — rich proof with multiple signals
    return "verified"        # 1.0 — comprehensive proof surface
```

Confidence levels are informational in the local loop but exported in the proof envelope for proofofship to use as a signal (not trusted directly — proofofship re-verifies independently).

---

## 11. Anti-Gaming Section

### Attack: Receipt stuffing (high volume, low quality)
- **Mitigation:** Anti-slop gate (§4). Receipts below 6 points don't count toward streaks.
- **Source:** R10 (optimal rating design under moral hazard)

### Attack: Hash collision / pre-image
- **Mitigation:** SHA-256 is collision-resistant. Content hash computed on canonical JSON.
- **Risk:** Negligible for v1.

### Attack: Duplicate submission farming
- **Mitigation:** Content-hash dedup (§8). Same hash → score 0.
- **Source:** R18 (transparency protocol verification)

### Attack: Streak gaming via minimal-effort daily receipts
- **Mitigation:** 6-point threshold means each receipt needs real proof elements.
- **Future:** Consider velocity limits (max N receipts per day contributing to streak).

### Attack: Self-attestation loops
- **Mitigation:** Local loop doesn't process attestations from others. Attestation gaming is a proofofship-layer concern.
- **Source:** R16 (collusion rings)

### Attack: Fabricated signals (fake stars/downloads)
- **Mitigation:** Signals contribute only 1 point each. Low leverage.
- **Future:** Cross-reference signals against GitHub API at verification time (proofofship layer).

### Attack: Schema-valid but semantically empty receipts
- **Mitigation:** Base score formula only awards points for specific proof primitives. Empty arrays and null fields contribute 0.

---

## 12. State Management

### State File: `.ship-receipts/game-state.json`

```json
{
  "version": "1",
  "subject": "BuilderName",
  "total_score": 142,
  "receipts_submitted": 12,
  "receipts_rejected": 1,
  "streak": {
    "current": 5,
    "longest": 12,
    "last_qualifying_date": "2026-02-25",
    "streak_start_date": "2026-02-21"
  },
  "history": [
    {
      "receipt_hash": "sha256:abc...",
      "score": 18,
      "date": "2026-02-25",
      "dispute_status": "none",
      "confidence": "strong",
      "breakdown": {
        "base": 12,
        "streak_multiplier": 1.5,
        "integrity_multiplier": 1.0
      }
    }
  ]
}
```

### Initialization

On first `ship-receipts score`, if `.ship-receipts/game-state.json` does not exist, create it with default values (total_score: 0, streak: all zeros, empty history).

---

## 13. Full Scoring Pipeline (pseudocode)

```
INPUT: receipt JSON, game_state JSON
OUTPUT: score_result, updated game_state

1. VALIDATE receipt against schema
   → fail? REJECT, emit receipt.rejected

2. COMPUTE content_hash validity
   → present but invalid? REJECT (score=0), emit receipt.rejected

3. CHECK duplicate (content_hash in history)
   → duplicate? score=0, emit receipt.duplicate, STOP

4. COMPUTE base_score, breakdown

5. COMPUTE final_score = floor(base × streak_mult × integrity_mult)

6. IF qualifies_for_streak(base_score):
     UPDATE streak (advance or maintain)
   ELSE:
     streak unchanged (no break, just no advance)

7. APPEND to history
8. UPDATE total_score
9. EMIT receipt.submitted event
10. RETURN score_result with breakdown
```

---

## Appendix: Test Vectors

### Vector 1: Minimal qualifying receipt
```json
{
  "subject": {"name": "Alice", "profiles": [{"kind": "github", "url": "https://github.com/alice"}]},
  "meta": {"created_at": "2026-02-25T10:00:00Z"},
  "artifacts": [{"name": "myapp", "immutable_ref": "sha:abc123"}]
}
```
Expected: base=6 (name:1 + profiles:2 + created_at:1 + immutable_ref:2), qualifies for streak.

### Vector 2: Rich receipt with integrity bonus
```json
{
  "subject": {"name": "Alice", "profiles": [{"kind": "github", "url": "https://github.com/alice"}]},
  "meta": {"created_at": "2026-02-25T10:00:00Z", "content_hash": "sha256:<valid>"},
  "artifacts": [{
    "name": "myapp",
    "immutable_ref": "sha:abc123",
    "ci_url": "https://ci.example.com/123",
    "verify": [{"checksum": {"algo": "sha256", "hash": "def456"}}]
  }]
}
```
Expected: base=13 (1+2+1+3+2+1+3), integrity_mult=1.5, at 7-day streak → floor(13 × 1.5 × 1.5) = floor(29.25) = 29.

### Vector 3: Schema-valid but empty proof
```json
{
  "subject": {"name": "Alice"},
  "meta": {},
  "artifacts": [{"name": "myapp"}]
}
```
Expected: base=1 (only subject.name), does NOT qualify for streak (below 6).
