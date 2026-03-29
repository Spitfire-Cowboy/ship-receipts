"""
Local scoring engine for ship-receipts.

Spec: docs/specs/ship-receipts-scoring-model-v1.md
"""

from __future__ import annotations

import math

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

MINIMUM_QUALIFYING_SCORE = 6

# Streak tiers capped at 5 days (1.5x). No penalty for breaking streak.
# Philosophy: encourages daily shipping without punishing weekends or rest.
STREAK_TIERS: list[tuple[int, float]] = [
    (5, 1.50),
    (3, 1.25),
    (2, 1.10),
]

# ---------------------------------------------------------------------------
# Base score
# ---------------------------------------------------------------------------


def compute_base_score(receipt: dict) -> tuple[int, dict[str, int]]:
    """
    Compute base score from proof element presence.

    Returns (base_score, breakdown_dict).
    The breakdown maps element names to their point contributions.

    Note: The schema uses verify[].kind == "checksum" with top-level
    algo/hash fields (not a nested checksum object). Adapted accordingly.
    """
    breakdown: dict[str, int] = {}
    score = 0

    # --- Subject fields ---
    if receipt.get("subject", {}).get("name"):
        breakdown["subject.name"] = 1
        score += 1

    profiles = receipt.get("subject", {}).get("profiles", [])
    valid_profiles = [p for p in profiles if p.get("kind") and p.get("url")]
    if valid_profiles:
        breakdown["subject.profiles"] = 2
        score += 2

    # --- Meta fields ---
    meta = receipt.get("meta", {})
    if meta.get("created_at"):
        breakdown["meta.created_at"] = 1
        score += 1

    # content_hash points are conditional on validation (caller must verify)
    if meta.get("content_hash"):
        breakdown["meta.content_hash"] = 3
        score += 3

    # --- Artifact fields ---
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
            kind = v.get("kind", "")

            if kind == "checksum" and v.get("algo") and v.get("hash"):
                breakdown[f"{vprefix}.checksum"] = 3
                score += 3
            elif kind == "link" and v.get("url"):
                breakdown[f"{vprefix}.link"] = 1
                score += 1
            elif kind == "command" and v.get("command"):
                breakdown[f"{vprefix}.command"] = 2
                score += 2
            elif kind == "attestation" and v.get("attestation"):
                breakdown[f"{vprefix}.attestation"] = 2
                score += 2

        # Signals
        signals = artifact.get("signals", {})
        for key in ("dependents", "downloads_30d", "stars"):
            val = signals.get(key)
            if val is not None and val > 0:
                breakdown[f"{prefix}.signals.{key}"] = 1
                score += 1

        # downstream_citations is an array; count if non-empty
        citations = signals.get("downstream_citations")
        if citations and len(citations) > 0:
            breakdown[f"{prefix}.signals.citations"] = 1
            score += 1

    return score, breakdown


# ---------------------------------------------------------------------------
# Streak multiplier
# ---------------------------------------------------------------------------


def streak_multiplier(streak_days: int) -> float:
    """Return the multiplier for the given streak length."""
    for threshold, mult in STREAK_TIERS:
        if streak_days >= threshold:
            return mult
    return 1.0


# ---------------------------------------------------------------------------
# Integrity multiplier
# ---------------------------------------------------------------------------


def integrity_multiplier(receipt: dict, hash_valid: bool) -> float:
    """
    1.5x if content_hash is valid AND at least one artifact
    has a checksum verification entry.
    """
    if not hash_valid:
        return 1.0

    for artifact in receipt.get("artifacts", []):
        for v in artifact.get("verify", []):
            if v.get("kind") == "checksum" and v.get("algo") and v.get("hash"):
                return 1.5

    return 1.0


# ---------------------------------------------------------------------------
# Anti-slop gate
# ---------------------------------------------------------------------------


def qualifies_for_streak(base_score: int) -> bool:
    """Receipt must score >= 6 to advance a streak."""
    return base_score >= MINIMUM_QUALIFYING_SCORE


# ---------------------------------------------------------------------------
# Final score
# ---------------------------------------------------------------------------


def compute_final_score(
    base_score: int,
    streak_days: int,
    receipt: dict,
    hash_valid: bool,
) -> int:
    """
    final_score = floor(base_score * streak_mult * integrity_mult)
    """
    s_mult = streak_multiplier(streak_days)
    i_mult = integrity_multiplier(receipt, hash_valid)
    return math.floor(base_score * s_mult * i_mult)


# ---------------------------------------------------------------------------
# Confidence level
# ---------------------------------------------------------------------------


def confidence_level(base_score: int, hash_valid: bool) -> str:
    """Map base score + hash validity to a confidence tier."""
    if not hash_valid or base_score == 0:
        return "none"
    if base_score < 6:
        return "minimal"
    if base_score < 12:
        return "moderate"
    if base_score < 20:
        return "strong"
    return "verified"
