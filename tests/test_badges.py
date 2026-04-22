"""
Tests for the badge renderer.

Spec: docs/game-mode/game-mode-foundation-v1.md
"""

from src.scoring.badges import BADGE_COLORS, BADGE_STATES, derive_badge


class TestBadgeStates:
    def test_all_event_types_mapped(self):
        expected = {
            "receipt.created", "receipt.validated", "receipt.scored", "receipt.submitted",
            "envelope.exported", "envelope.submitted", "envelope.accepted",
            "envelope.rejected", "envelope.verified",
        }
        assert set(BADGE_STATES.keys()) == expected

    def test_all_badge_values_have_colors(self):
        for badge in BADGE_STATES.values():
            assert badge in BADGE_COLORS, f"Badge {badge} missing color"


class TestDeriveBadge:
    def test_empty_events_returns_unknown(self):
        assert derive_badge([], "abc123") == "UNKNOWN"

    def test_matching_event_returns_badge(self):
        events = [
            {"type": "receipt.created", "payload": {"content_hash": "hash1"}},
        ]
        assert derive_badge(events, "hash1") == "DRAFT"

    def test_latest_event_wins(self):
        events = [
            {"type": "receipt.created", "payload": {"content_hash": "hash1"}},
            {"type": "receipt.validated", "payload": {"content_hash": "hash1"}},
            {"type": "receipt.scored", "payload": {"content_hash": "hash1"}},
        ]
        assert derive_badge(events, "hash1") == "SCORED"

    def test_non_matching_hash_returns_unknown(self):
        events = [
            {"type": "receipt.scored", "payload": {"content_hash": "other"}},
        ]
        assert derive_badge(events, "target") == "UNKNOWN"

    def test_receipt_hash_key_also_matched(self):
        events = [
            {"type": "envelope.accepted", "payload": {"receipt_hash": "hash1"}},
        ]
        assert derive_badge(events, "hash1") == "ACCEPTED"

    def test_unknown_event_type_skipped(self):
        events = [
            {"type": "some.unknown.event", "payload": {"content_hash": "hash1"}},
        ]
        assert derive_badge(events, "hash1") == "UNKNOWN"

    def test_mixed_hashes_selects_correct(self):
        events = [
            {"type": "receipt.created", "payload": {"content_hash": "hash_a"}},
            {"type": "envelope.verified", "payload": {"content_hash": "hash_b"}},
            {"type": "receipt.validated", "payload": {"content_hash": "hash_a"}},
        ]
        assert derive_badge(events, "hash_a") == "VALID"
        assert derive_badge(events, "hash_b") == "VERIFIED"

    def test_envelope_rejected(self):
        events = [
            {"type": "receipt.scored", "payload": {"content_hash": "h"}},
            {"type": "envelope.rejected", "payload": {"content_hash": "h"}},
        ]
        assert derive_badge(events, "h") == "REJECTED"

    def test_malformed_events_are_skipped(self):
        events = [
            "bad-entry",
            {"type": "receipt.created", "payload": "not-a-dict"},
            {"type": "receipt.validated", "payload": {"content_hash": "h"}},
        ]
        assert derive_badge(events, "h") == "VALID"
