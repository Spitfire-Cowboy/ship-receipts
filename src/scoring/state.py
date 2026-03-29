"""
Game state management for ship-receipts local scoring.

Spec: docs/specs/ship-receipts-scoring-model-v1.md §12
"""

from __future__ import annotations

import json
import os
from datetime import date, datetime, timezone
from pathlib import Path

from .engine import (
    compute_base_score,
    compute_final_score,
    confidence_level,
    qualifies_for_streak,
    streak_multiplier,
)
from .hash_validator import compute_content_hash, validate_content_hash

STATE_DIR = ".ship-receipts"
STATE_FILE = "game-state.json"
MAX_EVENTS = 1000


class GameState:
    """Manages the local game state file and scoring pipeline."""

    def __init__(self, root_dir: str | Path = "."):
        self.root = Path(root_dir)
        self.state_path = self.root / STATE_DIR / STATE_FILE
        self.state = self._load()

    def _load(self) -> dict:
        if self.state_path.exists():
            with open(self.state_path) as f:
                return json.load(f)
        return self._default_state()

    def _default_state(self) -> dict:
        return {
            "version": "1",
            "subject": "",
            "total_score": 0,
            "receipts_submitted": 0,
            "receipts_rejected": 0,
            "streak": {
                "current": 0,
                "longest": 0,
                "last_qualifying_date": None,
                "streak_start_date": None,
            },
            "history": [],
            "events": [],
            "party": [],
            "odyssey": {},
        }

    def save(self) -> None:
        self.state_path.parent.mkdir(parents=True, exist_ok=True)
        with open(self.state_path, "w") as f:
            json.dump(self.state, f, indent=2)
            f.write("\n")

    # ------------------------------------------------------------------
    # Duplicate check
    # ------------------------------------------------------------------

    def is_duplicate(self, content_hash: str) -> bool:
        return any(
            h.get("receipt_hash") == content_hash
            for h in self.state.get("history", [])
        )

    # ------------------------------------------------------------------
    # Streak management
    # ------------------------------------------------------------------

    def _update_streak(self, today: str, qualifies: bool) -> None:
        """
        Advance or break the streak based on today's date and whether
        the receipt qualifies.
        """
        streak = self.state["streak"]
        last_date = streak.get("last_qualifying_date")

        if not qualifies:
            return  # Non-qualifying receipt doesn't affect streak

        if last_date == today:
            return  # Already qualified today

        if last_date is None:
            # First qualifying receipt ever
            streak["current"] = 1
            streak["last_qualifying_date"] = today
            streak["streak_start_date"] = today
        else:
            last = date.fromisoformat(last_date)
            current = date.fromisoformat(today)
            delta = (current - last).days

            if delta == 1:
                # Consecutive day
                streak["current"] += 1
                streak["last_qualifying_date"] = today
            elif delta > 1:
                # Streak broken
                self._emit_event("streak.broken", {
                    "previous_length": streak["current"],
                    "break_date": today,
                })
                streak["current"] = 1
                streak["last_qualifying_date"] = today
                streak["streak_start_date"] = today
            # delta == 0 handled above; delta < 0 shouldn't happen

        if streak["current"] > streak.get("longest", 0):
            streak["longest"] = streak["current"]

    # ------------------------------------------------------------------
    # Event log
    # ------------------------------------------------------------------

    def _emit_event(self, event_type: str, payload: dict) -> None:
        events = self.state.setdefault("events", [])
        events.append({
            "type": event_type,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "payload": payload,
        })
        # Trim to max events
        if len(events) > MAX_EVENTS:
            self.state["events"] = events[-MAX_EVENTS:]

    # ------------------------------------------------------------------
    # Main scoring pipeline
    # ------------------------------------------------------------------

    def score_receipt(self, receipt: dict) -> dict:
        """
        Full scoring pipeline per spec §13.

        Returns a result dict with: status, score, breakdown, etc.
        Does NOT save state — caller must call .save() after.
        """
        today = date.today().isoformat()

        # 1. Content hash validation
        hash_valid = validate_content_hash(receipt)
        has_hash = bool(receipt.get("meta", {}).get("content_hash"))

        if has_hash and not hash_valid:
            self.state["receipts_rejected"] += 1
            self._emit_event("receipt.rejected", {
                "reason": "content_hash_mismatch",
            })
            return {
                "status": "REJECTED",
                "reason": "content_hash_mismatch",
                "score": 0,
            }

        # 2. Duplicate check
        content_hash = (
            receipt.get("meta", {}).get("content_hash")
            or compute_content_hash(receipt)
        )
        if self.is_duplicate(content_hash):
            self._emit_event("receipt.duplicate", {
                "receipt_hash": content_hash,
            })
            return {
                "status": "DUPLICATE",
                "reason": "already_submitted",
                "score": 0,
            }

        # 3. Base score
        base_score, breakdown = compute_base_score(receipt)

        # If hash is present but invalid, we already returned above.
        # If hash is absent, content_hash points were not awarded (no meta.content_hash).

        # 4. Final score
        current_streak = self.state["streak"]["current"]
        final_score = compute_final_score(
            base_score, current_streak, receipt, hash_valid and has_hash
        )

        # 5. Streak update
        qualifies = qualifies_for_streak(base_score)
        self._update_streak(today, qualifies)

        if qualifies:
            self._emit_event("streak.advanced", {
                "new_length": self.state["streak"]["current"],
                "date": today,
            })

        # 6. Update subject
        subject_name = receipt.get("subject", {}).get("name", "")
        if subject_name:
            self.state["subject"] = subject_name

        # 7. Record in history
        entry = {
            "receipt_hash": content_hash,
            "score": final_score,
            "date": today,
            "dispute_status": "none",
            "confidence": confidence_level(base_score, hash_valid and has_hash),
            "breakdown": {
                "base": base_score,
                "streak_multiplier": streak_multiplier(current_streak),
                "integrity_multiplier": 1.5 if (hash_valid and has_hash and _has_checksum(receipt)) else 1.0,
            },
        }
        self.state["history"].append(entry)
        self.state["receipts_submitted"] += 1
        self.state["total_score"] += final_score

        # 8. Emit event
        self._emit_event("receipt.submitted", {
            "receipt_hash": content_hash,
            "score": final_score,
            "breakdown": entry["breakdown"],
        })

        return {
            "status": "ACCEPTED",
            "score": final_score,
            "base_score": base_score,
            "breakdown": breakdown,
            "multipliers": entry["breakdown"],
            "streak": self.state["streak"]["current"],
            "confidence": entry["confidence"],
            "qualifies_for_streak": qualifies,
        }


def _has_checksum(receipt: dict) -> bool:
    """Check if any artifact has a checksum verify entry."""
    for artifact in receipt.get("artifacts", []):
        for v in artifact.get("verify", []):
            if v.get("kind") == "checksum" and v.get("algo") and v.get("hash"):
                return True
    return False
