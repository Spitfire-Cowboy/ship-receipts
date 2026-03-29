"""
Proof envelope export module.

Wraps a scored local receipt into a proof envelope for submission
to proofofship.

Spec: docs/specs/local-to-global-proof-envelope-v1.md
"""

from __future__ import annotations

import json
import re
import time
import random
from datetime import datetime, timezone

from ..scoring.hash_validator import compute_content_hash


# ---------------------------------------------------------------------------
# ULID generation (no external dependency)
# ---------------------------------------------------------------------------

_CROCKFORD = "0123456789ABCDEFGHJKMNPQRSTVWXYZ"


def _generate_ulid() -> str:
    """Generate a ULID-like string (timestamp + random)."""
    ts_ms = int(time.time() * 1000)
    ts_chars = []
    for _ in range(10):
        ts_chars.append(_CROCKFORD[ts_ms & 0x1F])
        ts_ms >>= 5
    ts_chars.reverse()
    rand_chars = [random.choice(_CROCKFORD) for _ in range(16)]
    return "".join(ts_chars) + "".join(rand_chars)


# ---------------------------------------------------------------------------
# Actor extraction
# ---------------------------------------------------------------------------

_GITHUB_URL_RE = re.compile(
    r"https?://github\.com/([a-zA-Z0-9](?:[a-zA-Z0-9]|-(?=[a-zA-Z0-9])){0,38})"
)


def extract_actor(receipt: dict) -> dict:
    """Extract actor identity from receipt subject."""
    subject = receipt.get("subject", {})
    profiles = subject.get("profiles", [])

    github_username = None
    profile_urls = []

    for p in profiles:
        url = p.get("url", "")
        if url:
            profile_urls.append(url)
        if p.get("kind") == "github":
            match = _GITHUB_URL_RE.match(url)
            if match:
                github_username = match.group(1)

    if not github_username:
        raise ValueError("No GitHub profile found in receipt subject.profiles")

    return {
        "github_username": github_username,
        "display_name": subject.get("name", github_username),
        "profile_urls": profile_urls,
    }


# ---------------------------------------------------------------------------
# Export
# ---------------------------------------------------------------------------


def export_proof_envelope(
    receipt: dict,
    game_state: dict | None = None,
) -> dict:
    """
    Convert a receipt into a proof envelope.

    Args:
        receipt: Schema-valid receipt dict.
        game_state: Optional local game state for score snapshot.

    Returns:
        Proof envelope dict conforming to proof-envelope.v1.json.

    Raises:
        ValueError: If no GitHub profile is found.
    """
    actor = extract_actor(receipt)
    content_hash = compute_content_hash(receipt)

    envelope: dict = {
        "envelope_version": "1.0",
        "envelope_id": _generate_ulid(),
        "content_hash": content_hash,
        "submitted_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "actor": actor,
        "receipt": receipt,
        "export_metadata": {
            "generator": "ship-receipts",
            "generator_version": "0.1.0",
            "ship_receipts_schema_version": receipt.get("version", "0.1"),
        },
    }

    # Pass through receipt_id if present
    if receipt.get("receipt_id"):
        envelope["receipt_id"] = receipt["receipt_id"]

    # Pass through DR attestation if embedded in receipt
    if receipt.get("attestation"):
        envelope["attestation"] = receipt["attestation"]

    # Optional local score snapshot
    if game_state:
        snapshot = _extract_local_snapshot(receipt, game_state)
        if snapshot:
            envelope["local_score_snapshot"] = snapshot

    return envelope


def _extract_local_snapshot(receipt: dict, game_state: dict) -> dict | None:
    """Extract local score snapshot from game state history."""
    content_hash = receipt.get("meta", {}).get("content_hash")
    if not content_hash:
        content_hash = compute_content_hash(receipt)

    for entry in game_state.get("history", []):
        if entry.get("receipt_hash") == content_hash:
            return {
                "base_score": entry["breakdown"]["base"],
                "final_score": entry["score"],
                "streak_days": game_state.get("streak", {}).get("current", 0),
                "streak_multiplier": entry["breakdown"].get("streak_multiplier", 1.0),
                "integrity_multiplier": entry["breakdown"].get("integrity_multiplier", 1.0),
                "computed_at": datetime.now(timezone.utc).isoformat(),
            }

    return None
