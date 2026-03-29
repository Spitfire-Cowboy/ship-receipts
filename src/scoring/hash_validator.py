"""
Content hash computation and validation for ship-receipts.

Spec: docs/specs/ship-receipts-scoring-model-v1.md §3
"""

from __future__ import annotations

import hashlib
import json


def canonical_json(obj: dict) -> str:
    """Produce canonical JSON: sorted keys, compact separators, UTF-8."""
    return json.dumps(obj, sort_keys=True, separators=(",", ":"), ensure_ascii=False)


def compute_content_hash(receipt: dict) -> str:
    """
    Compute SHA-256 of the canonical receipt JSON, excluding meta.content_hash.

    Returns "sha256:<hex>".
    """
    receipt_copy = json.loads(json.dumps(receipt))
    meta = receipt_copy.get("meta", {})
    meta.pop("content_hash", None)
    if meta == {}:
        receipt_copy.pop("meta", None)

    canonical = canonical_json(receipt_copy)
    digest = hashlib.sha256(canonical.encode("utf-8")).hexdigest()
    return f"sha256:{digest}"


def validate_content_hash(receipt: dict) -> bool:
    """
    Check that meta.content_hash matches the computed hash.

    Returns True if:
    - content_hash is present and matches
    Returns False if:
    - content_hash is present but does NOT match
    Returns True if:
    - content_hash is absent (nothing to validate)
    """
    claimed = receipt.get("meta", {}).get("content_hash", "")
    if not claimed:
        return True  # No hash to validate

    if not claimed.startswith("sha256:"):
        return False

    computed = compute_content_hash(receipt)
    return computed == claimed
