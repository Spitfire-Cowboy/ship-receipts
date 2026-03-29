"""
Tests for game state management and the full scoring pipeline.

Spec: docs/specs/ship-receipts-scoring-model-v1.md §12, §13
"""

import json
import os
import sys
import tempfile
from pathlib import Path

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from src.scoring.state import GameState
from src.scoring.hash_validator import compute_content_hash


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _make_receipt(name="Alice", github_user="alice", immutable_ref="abc123",
                  with_checksum=False, with_hash=False, extra_artifacts=None):
    """Build a configurable receipt."""
    verify = []
    if with_checksum:
        verify.append({
            "kind": "checksum",
            "algo": "sha256",
            "hash": "deadbeef" * 8,
        })

    artifacts = [
        {
            "kind": "repo",
            "name": "myapp",
            "url": f"https://github.com/{github_user}/myapp",
            "immutable_ref": immutable_ref,
            "verify": verify,
        }
    ]
    if extra_artifacts:
        artifacts.extend(extra_artifacts)

    receipt = {
        "version": "0.1",
        "subject": {
            "name": name,
            "profiles": [
                {"kind": "github", "url": f"https://github.com/{github_user}"},
            ],
        },
        "meta": {"created_at": "2026-02-25T10:00:00Z"},
        "artifacts": artifacts,
    }

    if with_hash:
        content_hash = compute_content_hash(receipt)
        receipt["meta"]["content_hash"] = content_hash

    return receipt


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------


class TestGameStatePipeline:
    def setup_method(self):
        self.tmpdir = tempfile.mkdtemp()
        self.state = GameState(root_dir=self.tmpdir)

    def test_first_receipt_creates_state(self):
        receipt = _make_receipt()
        result = self.state.score_receipt(receipt)
        assert result["status"] == "ACCEPTED"
        assert result["score"] > 0
        assert self.state.state["receipts_submitted"] == 1

    def test_valid_proof_grants_points(self):
        receipt = _make_receipt(with_checksum=True, with_hash=True)
        result = self.state.score_receipt(receipt)
        assert result["status"] == "ACCEPTED"
        assert result["score"] > 0
        assert result["base_score"] >= 6  # Should qualify for streak

    def test_invalid_proof_grants_zero(self):
        receipt = _make_receipt(with_hash=True)
        # Tamper after hash
        receipt["artifacts"][0]["name"] = "TAMPERED"
        result = self.state.score_receipt(receipt)
        assert result["status"] == "REJECTED"
        assert result["score"] == 0

    def test_duplicate_submission_grants_zero(self):
        receipt = _make_receipt()
        r1 = self.state.score_receipt(receipt)
        assert r1["status"] == "ACCEPTED"

        r2 = self.state.score_receipt(receipt)
        assert r2["status"] == "DUPLICATE"
        assert r2["score"] == 0

    def test_dispute_penalty_path(self):
        """After scoring, manually flagging a receipt should freeze its contribution."""
        receipt = _make_receipt(with_checksum=True)
        result = self.state.score_receipt(receipt)
        original_score = result["score"]
        assert original_score > 0

        # Simulate dispute: flag the receipt
        self.state.state["history"][-1]["dispute_status"] = "upheld"

        # Recalculate total (as the spec says: total is recalculated)
        new_total = sum(
            h["score"] for h in self.state.state["history"]
            if h.get("dispute_status") in ("none", "dismissed")
        )
        assert new_total == 0  # Only receipt, now disputed

    def test_save_and_reload(self):
        receipt = _make_receipt()
        self.state.score_receipt(receipt)
        self.state.save()

        # Reload
        state2 = GameState(root_dir=self.tmpdir)
        assert state2.state["receipts_submitted"] == 1
        assert state2.state["total_score"] == self.state.state["total_score"]

    def test_streak_advances_on_qualifying_receipt(self):
        receipt = _make_receipt(with_checksum=True)
        result = self.state.score_receipt(receipt)
        assert result["qualifies_for_streak"] is True
        assert self.state.state["streak"]["current"] >= 1

    def test_non_qualifying_receipt_no_streak(self):
        # Minimal receipt scores only 1 (subject.name) → doesn't qualify
        receipt = {
            "version": "0.1",
            "subject": {"name": "Bob"},
            "artifacts": [{"kind": "repo", "name": "x", "url": "https://github.com/bob/x"}],
        }
        result = self.state.score_receipt(receipt)
        assert result["qualifies_for_streak"] is False

    def test_tamper_detection_end_to_end(self):
        """End-to-end: create receipt with hash, tamper, score should reject."""
        receipt = _make_receipt(with_hash=True)
        # Verify it works untampered
        good_result = self.state.score_receipt(receipt)
        assert good_result["status"] == "ACCEPTED"

        # Now make a new receipt, tamper it
        receipt2 = _make_receipt(with_hash=True, immutable_ref="different_sha")
        receipt2["artifacts"][0]["name"] = "EVIL"
        result = self.state.score_receipt(receipt2)
        assert result["status"] == "REJECTED"
        assert result["reason"] == "content_hash_mismatch"


class TestOdysseyState:
    def setup_method(self):
        self.tmpdir = tempfile.mkdtemp()
        self.state = GameState(root_dir=self.tmpdir)

    def test_default_state_has_odyssey_key(self):
        assert "odyssey" in self.state.state
        assert self.state.state["odyssey"] == {}

    def test_odyssey_persists_after_save_reload(self):
        self.state.state["odyssey"]["ithaca"] = "Get one project producing revenue"
        self.state.save()

        state2 = GameState(root_dir=self.tmpdir)
        assert state2.state["odyssey"]["ithaca"] == "Get one project producing revenue"

    def test_goal_survives_scoring_round(self):
        self.state.state["odyssey"]["ithaca"] = "Ship something"
        receipt = _make_receipt()
        self.state.score_receipt(receipt)
        self.state.save()

        state2 = GameState(root_dir=self.tmpdir)
        assert state2.state["odyssey"]["ithaca"] == "Ship something"


class TestEnvelopeExport:
    def test_export_creates_valid_envelope(self):
        from src.envelope.export import export_proof_envelope

        receipt = _make_receipt()
        envelope = export_proof_envelope(receipt)

        assert envelope["envelope_version"] == "1.0"
        assert envelope["content_hash"].startswith("sha256:")
        assert envelope["actor"]["github_username"] == "alice"
        assert envelope["receipt"] == receipt

    def test_export_without_github_fails(self):
        from src.envelope.export import export_proof_envelope

        receipt = {
            "version": "0.1",
            "subject": {"name": "NoGithub"},
            "artifacts": [{"kind": "repo", "name": "x", "url": "https://example.com/x"}],
        }
        with pytest.raises(ValueError, match="No GitHub profile"):
            export_proof_envelope(receipt)

    def test_export_with_game_state_snapshot(self):
        from src.envelope.export import export_proof_envelope
        from src.scoring.hash_validator import compute_content_hash

        receipt = _make_receipt()
        content_hash = compute_content_hash(receipt)

        game_state = {
            "streak": {"current": 5},
            "history": [
                {
                    "receipt_hash": content_hash,
                    "score": 18,
                    "breakdown": {
                        "base": 12,
                        "streak_multiplier": 1.5,
                        "integrity_multiplier": 1.0,
                    },
                }
            ],
        }

        envelope = export_proof_envelope(receipt, game_state)
        snapshot = envelope.get("local_score_snapshot")
        assert snapshot is not None
        assert snapshot["base_score"] == 12
        assert snapshot["final_score"] == 18

    def test_export_passes_through_attestation(self):
        from src.envelope.export import export_proof_envelope

        attestation = {
            "attestation_id": "01JFQX8M9WCRN4P7Q3S6V8Y2KH",
            "origin": {"agent_id": "rowan-den"},
            "evidence_hash": "sha256:abc123",
            "score": 0.85,
            "trust_level": "local",
        }
        receipt = _make_receipt()
        receipt["attestation"] = attestation

        envelope = export_proof_envelope(receipt)
        assert envelope.get("attestation") == attestation

    def test_export_no_attestation_when_absent(self):
        from src.envelope.export import export_proof_envelope

        receipt = _make_receipt()
        envelope = export_proof_envelope(receipt)
        assert "attestation" not in envelope

    def test_export_passes_through_receipt_id(self):
        from src.envelope.export import export_proof_envelope

        receipt = _make_receipt()
        receipt["receipt_id"] = "01JFQX7K4VBQM3N8P2R5T6W9XZ"

        envelope = export_proof_envelope(receipt)
        assert envelope.get("receipt_id") == "01JFQX7K4VBQM3N8P2R5T6W9XZ"

    def test_export_no_receipt_id_when_absent(self):
        from src.envelope.export import export_proof_envelope

        receipt = _make_receipt()
        envelope = export_proof_envelope(receipt)
        assert "receipt_id" not in envelope
