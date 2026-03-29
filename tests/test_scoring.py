"""
Tests for the ship-receipts local scoring engine.

Spec: docs/specs/ship-receipts-scoring-model-v1.md
"""

import json
import math
import pathlib
import pytest

from src.scoring.engine import (
    compute_base_score,
    compute_final_score,
    confidence_level,
    integrity_multiplier,
    qualifies_for_streak,
    streak_multiplier,
)
from src.scoring.hash_validator import compute_content_hash, validate_content_hash


# ---------------------------------------------------------------------------
# Fixtures: receipt builders
# ---------------------------------------------------------------------------


def _minimal_receipt(**overrides) -> dict:
    """Minimal schema-valid receipt."""
    r = {
        "version": "0.1",
        "subject": {"name": "Alice"},
        "artifacts": [
            {
                "kind": "repo",
                "name": "myapp",
                "url": "https://github.com/alice/myapp",
            }
        ],
    }
    r.update(overrides)
    return r


def _rich_receipt() -> dict:
    """Receipt with many proof elements."""
    return {
        "version": "0.1",
        "subject": {
            "name": "Alice",
            "profiles": [
                {"kind": "github", "url": "https://github.com/alice"},
            ],
        },
        "meta": {"created_at": "2026-02-25T10:00:00Z"},
        "artifacts": [
            {
                "kind": "repo",
                "name": "myapp",
                "url": "https://github.com/alice/myapp",
                "immutable_ref": "abc123",
                "ci_url": "https://ci.example.com/123",
                "verify": [
                    {
                        "kind": "checksum",
                        "algo": "sha256",
                        "hash": "deadbeef" * 8,
                    },
                    {
                        "kind": "link",
                        "url": "https://example.com/proof",
                    },
                    {
                        "kind": "command",
                        "command": "npm test",
                    },
                ],
                "signals": {
                    "stars": 42,
                    "downloads_30d": 1000,
                },
            }
        ],
    }


def _receipt_with_valid_hash() -> dict:
    """Receipt with a correctly computed content_hash."""
    receipt = _rich_receipt()
    # Compute and set content hash
    content_hash = compute_content_hash(receipt)
    receipt.setdefault("meta", {})["content_hash"] = content_hash
    return receipt


# ---------------------------------------------------------------------------
# Test: base score computation
# ---------------------------------------------------------------------------


class TestBaseScore:
    def test_empty_proof_scores_name_only(self):
        receipt = _minimal_receipt()
        score, breakdown = compute_base_score(receipt)
        assert score == 1
        assert breakdown == {"subject.name": 1}

    def test_profiles_add_points(self):
        receipt = _minimal_receipt(
            subject={
                "name": "Alice",
                "profiles": [{"kind": "github", "url": "https://github.com/alice"}],
            }
        )
        score, breakdown = compute_base_score(receipt)
        assert breakdown.get("subject.profiles") == 2
        assert score >= 3  # name(1) + profiles(2)

    def test_rich_receipt_scores_high(self):
        receipt = _rich_receipt()
        score, breakdown = compute_base_score(receipt)
        # name(1) + profiles(2) + created_at(1) + immutable_ref(2) + ci_url(1)
        # + checksum(3) + link(1) + command(2) + stars(1) + downloads(1) = 15
        assert score == 15

    def test_no_name_scores_zero_for_name(self):
        receipt = _minimal_receipt(subject={"name": ""})
        score, breakdown = compute_base_score(receipt)
        assert "subject.name" not in breakdown

    def test_multiple_artifacts_additive(self):
        receipt = _minimal_receipt(
            artifacts=[
                {
                    "kind": "repo",
                    "name": "app1",
                    "url": "https://github.com/alice/app1",
                    "immutable_ref": "sha1",
                },
                {
                    "kind": "repo",
                    "name": "app2",
                    "url": "https://github.com/alice/app2",
                    "immutable_ref": "sha2",
                },
            ]
        )
        score, breakdown = compute_base_score(receipt)
        assert breakdown.get("artifact[0].immutable_ref") == 2
        assert breakdown.get("artifact[1].immutable_ref") == 2

    def test_attestation_verify_entry(self):
        receipt = _minimal_receipt(
            artifacts=[
                {
                    "kind": "repo",
                    "name": "app",
                    "url": "https://github.com/alice/app",
                    "verify": [
                        {"kind": "attestation", "attestation": {"signer": "bob"}},
                    ],
                }
            ]
        )
        score, breakdown = compute_base_score(receipt)
        assert breakdown.get("artifact[0].verify[0].attestation") == 2


# ---------------------------------------------------------------------------
# Test: content hash validation
# ---------------------------------------------------------------------------


class TestContentHash:
    def test_valid_hash_passes(self):
        receipt = _receipt_with_valid_hash()
        assert validate_content_hash(receipt) is True

    def test_invalid_hash_fails(self):
        receipt = _receipt_with_valid_hash()
        receipt["meta"]["content_hash"] = "sha256:0000000000000000000000000000000000000000000000000000000000000000"
        assert validate_content_hash(receipt) is False

    def test_missing_hash_passes(self):
        """No hash = nothing to validate = passes."""
        receipt = _minimal_receipt()
        assert validate_content_hash(receipt) is True

    def test_malformed_meta_fails_gracefully(self):
        receipt = _minimal_receipt(meta=[])
        assert validate_content_hash(receipt) is False

    def test_non_string_content_hash_fails_gracefully(self):
        receipt = _minimal_receipt(meta={"content_hash": 123})
        assert validate_content_hash(receipt) is False

    def test_non_sha256_prefix_fails(self):
        receipt = _minimal_receipt(meta={"content_hash": "md5:abc123"})
        assert validate_content_hash(receipt) is False

    def test_compute_is_deterministic(self):
        receipt = _rich_receipt()
        h1 = compute_content_hash(receipt)
        h2 = compute_content_hash(receipt)
        assert h1 == h2
        assert h1.startswith("sha256:")

    def test_content_hash_excluded_from_computation(self):
        """Adding content_hash to meta should not change the computed hash."""
        receipt = _rich_receipt()
        h1 = compute_content_hash(receipt)
        receipt.setdefault("meta", {})["content_hash"] = h1
        h2 = compute_content_hash(receipt)
        assert h1 == h2


# ---------------------------------------------------------------------------
# Test: streak multiplier
# ---------------------------------------------------------------------------


class TestStreakMultiplier:
    def test_no_streak(self):
        assert streak_multiplier(0) == 1.0

    def test_one_day(self):
        assert streak_multiplier(1) == 1.0

    def test_two_days(self):
        assert streak_multiplier(2) == 1.1

    def test_three_days(self):
        assert streak_multiplier(3) == 1.25

    def test_four_days(self):
        assert streak_multiplier(4) == 1.25

    def test_five_days(self):
        assert streak_multiplier(5) == 1.5

    def test_seven_days(self):
        assert streak_multiplier(7) == 1.5  # capped at 5-day max

    def test_thirty_days(self):
        assert streak_multiplier(30) == 1.5  # capped at 5-day max

    def test_hundred_days(self):
        assert streak_multiplier(100) == 1.5  # capped at 5-day max


# ---------------------------------------------------------------------------
# Test: integrity multiplier
# ---------------------------------------------------------------------------


class TestIntegrityMultiplier:
    def test_no_hash_no_bonus(self):
        receipt = _minimal_receipt()
        assert integrity_multiplier(receipt, hash_valid=False) == 1.0

    def test_valid_hash_no_checksum_no_bonus(self):
        receipt = _minimal_receipt()
        assert integrity_multiplier(receipt, hash_valid=True) == 1.0

    def test_valid_hash_with_checksum_gets_bonus(self):
        receipt = _rich_receipt()  # Has checksum verify entry
        assert integrity_multiplier(receipt, hash_valid=True) == 1.5


# ---------------------------------------------------------------------------
# Test: anti-slop gate
# ---------------------------------------------------------------------------


class TestAntiSlop:
    def test_below_threshold(self):
        assert qualifies_for_streak(5) is False

    def test_at_threshold(self):
        assert qualifies_for_streak(6) is True

    def test_above_threshold(self):
        assert qualifies_for_streak(20) is True

    def test_zero(self):
        assert qualifies_for_streak(0) is False


# ---------------------------------------------------------------------------
# Test: final score computation
# ---------------------------------------------------------------------------


class TestFinalScore:
    def test_basic_no_multipliers(self):
        receipt = _minimal_receipt()
        score = compute_final_score(10, streak_days=0, receipt=receipt, hash_valid=False)
        assert score == 10  # 10 * 1.0 * 1.0

    def test_with_streak(self):
        receipt = _minimal_receipt()
        score = compute_final_score(10, streak_days=7, receipt=receipt, hash_valid=False)
        assert score == 15  # 10 * 1.5 * 1.0

    def test_with_integrity_bonus(self):
        receipt = _rich_receipt()
        score = compute_final_score(15, streak_days=0, receipt=receipt, hash_valid=True)
        assert score == 22  # floor(15 * 1.0 * 1.5) = 22

    def test_stacked_multipliers(self):
        receipt = _rich_receipt()
        score = compute_final_score(15, streak_days=7, receipt=receipt, hash_valid=True)
        # floor(15 * 1.5 * 1.5) = floor(33.75) = 33
        assert score == 33

    def test_floor_rounding(self):
        receipt = _rich_receipt()
        score = compute_final_score(13, streak_days=7, receipt=receipt, hash_valid=True)
        # floor(13 * 1.5 * 1.5) = floor(29.25) = 29
        assert score == 29

    def test_zero_base_zero_final(self):
        receipt = _minimal_receipt()
        score = compute_final_score(0, streak_days=30, receipt=receipt, hash_valid=False)
        assert score == 0


# ---------------------------------------------------------------------------
# Test: confidence levels
# ---------------------------------------------------------------------------


class TestConfidence:
    def test_none(self):
        assert confidence_level(0, hash_valid=False) == "none"

    def test_minimal(self):
        assert confidence_level(3, hash_valid=True) == "minimal"

    def test_moderate(self):
        assert confidence_level(8, hash_valid=True) == "moderate"

    def test_strong(self):
        assert confidence_level(15, hash_valid=True) == "strong"

    def test_verified(self):
        assert confidence_level(25, hash_valid=True) == "verified"


# ---------------------------------------------------------------------------
# Test: tamper detection (valid proof → points; invalid proof → zero)
# ---------------------------------------------------------------------------


class TestTamperDetection:
    def test_valid_proof_grants_points(self):
        """Spec test vector 1: valid receipt scores > 0."""
        receipt = _rich_receipt()
        score, _ = compute_base_score(receipt)
        assert score > 0

    def test_invalid_hash_grants_zero(self):
        """Receipt with tampered content_hash should be caught by validator."""
        receipt = _receipt_with_valid_hash()
        # Tamper with the receipt AFTER hash was set
        receipt["artifacts"][0]["name"] = "TAMPERED"
        assert validate_content_hash(receipt) is False

    def test_schema_valid_no_proof_low_score(self):
        """Spec: receipt with no proof primitives beyond required fields."""
        receipt = _minimal_receipt()
        score, _ = compute_base_score(receipt)
        assert score == 1  # Only subject.name
        assert not qualifies_for_streak(score)


# ---------------------------------------------------------------------------
# Test: v1 schema backwards compatibility
# ---------------------------------------------------------------------------


class TestV1SchemaBackwardsCompat:
    """Validate that v0.1 receipts are accepted by the v1 schema."""

    def _schema_path(self) -> pathlib.Path:
        repo_root = pathlib.Path(__file__).parent.parent
        return repo_root / "schema" / "ship-receipts.v1.schema.json"

    def _load_v1_schema(self) -> dict:
        with open(self._schema_path()) as f:
            return json.load(f)

    def _validate(self, receipt: dict) -> list[str]:
        try:
            from jsonschema import Draft202012Validator
        except ImportError:
            pytest.skip("jsonschema not installed")
        schema = self._load_v1_schema()
        validator = Draft202012Validator(schema)
        return [f"{e.json_path}: {e.message}" for e in validator.iter_errors(receipt)]

    def test_v1_schema_file_exists(self):
        assert self._schema_path().exists(), "schema/ship-receipts.v1.schema.json not found"

    def test_example_json_valid_against_v1_schema(self):
        """The canonical v0.1 example must validate against the v1 schema."""
        example_path = pathlib.Path(__file__).parent.parent / "examples" / "ship-receipts.example.json"
        assert example_path.exists(), "examples/ship-receipts.example.json not found"
        with open(example_path) as f:
            receipt = json.load(f)
        errors = self._validate(receipt)
        assert errors == [], "v0.1 example failed v1 schema validation:\n" + "\n".join(errors)

    def test_minimal_v01_receipt_valid_against_v1_schema(self):
        """Minimal v0.1 receipt (version: '0.1') must pass v1 schema."""
        receipt = _minimal_receipt()
        errors = self._validate(receipt)
        assert errors == [], "Minimal v0.1 receipt failed v1 schema:\n" + "\n".join(errors)

    def test_v1_version_field_accepted(self):
        """version: '1.0' must be accepted by the v1 schema."""
        receipt = _minimal_receipt(version="1.0")
        errors = self._validate(receipt)
        assert errors == [], "version='1.0' rejected by v1 schema:\n" + "\n".join(errors)

    def test_unknown_version_rejected(self):
        """version: '2.0' must be rejected (not in enum)."""
        receipt = _minimal_receipt(version="2.0")
        errors = self._validate(receipt)
        assert errors, "Expected schema error for unknown version '2.0'"

    def test_meta_object_optional(self):
        """Receipt without meta passes; with valid meta also passes."""
        receipt_no_meta = _minimal_receipt()
        assert self._validate(receipt_no_meta) == []

        receipt_with_meta = _minimal_receipt(
            meta={
                "created_at": "2026-02-26T00:00:00Z",
                "schema_version": "1.0",
                "generator": "ship-receipts-cli",
            }
        )
        assert self._validate(receipt_with_meta) == []

    def test_meta_content_hash_pattern_valid(self):
        """meta.content_hash must match ^sha256:[a-f0-9]{64}$."""
        valid_hash = "sha256:" + "a" * 64
        receipt = _minimal_receipt(meta={"content_hash": valid_hash})
        assert self._validate(receipt) == []

    def test_meta_content_hash_pattern_invalid(self):
        """meta.content_hash with wrong prefix must fail."""
        receipt = _minimal_receipt(meta={"content_hash": "md5:abc123"})
        errors = self._validate(receipt)
        assert errors, "Expected schema error for invalid content_hash pattern"
