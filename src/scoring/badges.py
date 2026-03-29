"""
Badge renderer for ship-receipts.

Derives a receipt's current badge from the event stream.
Spec: docs/game-mode/build-order-for-campion-v1.md (Slice 7)
"""

from __future__ import annotations

BADGE_STATES: dict[str, str] = {
    "receipt.created": "DRAFT",
    "receipt.validated": "VALID",
    "receipt.scored": "SCORED",
    # Backward compatibility for older local event history files.
    "receipt.submitted": "SCORED",
    "envelope.exported": "EXPORTED",
    "envelope.submitted": "PENDING",
    "envelope.accepted": "ACCEPTED",
    "envelope.rejected": "REJECTED",
    "envelope.verified": "VERIFIED",
}

BADGE_COLORS: dict[str, str] = {
    "DRAFT": "gray",
    "VALID": "blue",
    "SCORED": "green",
    "EXPORTED": "purple",
    "PENDING": "yellow",
    "ACCEPTED": "green",
    "REJECTED": "red",
    "VERIFIED": "gold",
    "UNKNOWN": "white",
}


def derive_badge(events: list[dict], content_hash: str) -> str:
    """
    Derive the current badge for a receipt identified by content_hash.

    Walks events in reverse (latest first) and returns the badge
    for the first matching event. Returns "UNKNOWN" if no match.
    """
    for event in reversed(events):
        if not isinstance(event, dict):
            continue
        payload = event.get("payload", {})
        if not isinstance(payload, dict):
            continue
        event_hash = payload.get("receipt_hash") or payload.get("content_hash")
        if event_hash == content_hash:
            event_type = event.get("type", "")
            if event_type in BADGE_STATES:
                return BADGE_STATES[event_type]
    return "UNKNOWN"
