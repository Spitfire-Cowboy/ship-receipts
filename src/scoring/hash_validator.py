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
    if not isinstance(receipt, dict):
        raise TypeError("receipt must be a dict")

    receipt_copy = json.loads(json.dumps(receipt))
    meta = receipt_copy.get("meta")
    if isinstance(meta, dict):
        meta.pop("content_hash", None)
        if not meta:
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
    if not isinstance(receipt, dict):
        return False

    meta = receipt.get("meta")
    if meta is None:
        return True  # No hash to validate
    if not isinstance(meta, dict):
        return False

    claimed = meta.get("content_hash", "")
    if not claimed:
        return True  # No hash to validate

    if not isinstance(claimed, str):
        return False
    if not claimed.startswith("sha256:"):
        return False

    computed = compute_content_hash(receipt)
    return computed == claimed
