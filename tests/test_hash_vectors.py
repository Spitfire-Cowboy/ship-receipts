"""
Pinned hash test vectors for ship-receipts content hashing.

These tests encode known-good receipts alongside their expected SHA-256
content hashes. If compute_content_hash or canonical_json ever change
behaviour, these tests will catch the regression.

Spec: docs/specs/ship-receipts-scoring-model-v1.md §3
"""

import sys
import os

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from src.scoring.hash_validator import compute_content_hash, validate_content_hash


# ---------------------------------------------------------------------------
# Test vector 1: Minimal receipt (only required fields)
# ---------------------------------------------------------------------------

MINIMAL_RECEIPT = {
    "version": "1.0",
    "subject": {"name": "Ada"},
    "artifacts": [
        {
            "kind": "repo",
            "name": "pocketdb",
            "url": "https://github.com/ada-dev/pocketdb",
        }
    ],
}

MINIMAL_RECEIPT_HASH = (
    "sha256:03dd2959b72606a60157dbaf1303ea159daecb9875b4fef9fc55a5ea09bfe959"
)


# ---------------------------------------------------------------------------
# Test vector 2: Receipt with a meta block (hash excludes content_hash itself)
# ---------------------------------------------------------------------------

META_RECEIPT = {
    "version": "1.0",
    "subject": {"name": "Ada"},
    "artifacts": [
        {
            "kind": "repo",
            "name": "pocketdb",
            "url": "https://github.com/ada-dev/pocketdb",
            "immutable_ref": "c0ffee1234567890abcdef1234567890abcdef12",
        }
    ],
    "meta": {
        "created_at": "2026-02-26T10:00:00Z",
        "generator": "ship-receipts-cli/1.0.0",
    },
}

META_RECEIPT_HASH = (
    "sha256:d1abe5beae0c49ec26c2bd2db3f991d439bdb8c2f2e7ef857da6cc1a2ccd7968"
)

# Same receipt with the correct hash embedded — validate_content_hash must accept it.
META_RECEIPT_WITH_HASH = {
    **META_RECEIPT,
    "meta": {
        **META_RECEIPT["meta"],
        "content_hash": META_RECEIPT_HASH,
    },
}


# ---------------------------------------------------------------------------
# Test vector 3: Multiple artifacts with signals
# ---------------------------------------------------------------------------

MULTI_ARTIFACT_RECEIPT = {
    "version": "1.0",
    "subject": {
        "name": "Vesper",
        "profiles": [{"kind": "github", "url": "https://github.com/vesper-labs"}],
    },
    "artifacts": [
        {
            "kind": "repo",
            "name": "nullroute",
            "url": "https://github.com/vesper-labs/nullroute",
            "version": "0.4.1",
            "immutable_ref": "3f8a21c7b94d6e0512f9a4cc8071e3bdaf562190",
            "ci_url": "https://github.com/vesper-labs/nullroute/actions/runs/88001234",
            "verify": [
                {
                    "kind": "checksum",
                    "algo": "sha256",
                    "hash": "b94d27b9934d3e08a52e52d7da7dabfac484efe04294e576b0bec7ad26a2f4b1",
                    "source": "release-artifact",
                    "observed_at": "2026-02-26T09:00:00Z",
                },
                {
                    "kind": "link",
                    "url": "https://github.com/vesper-labs/nullroute/actions/runs/88001234",
                    "source": "github-actions",
                    "observed_at": "2026-02-26T09:00:00Z",
                },
            ],
            "signals": {
                "dependents": 12,
                "downloads_30d": 3100,
                "stars": 88,
                "as_of": "2026-02-26T09:00:00Z",
            },
        },
        {
            "kind": "demo",
            "name": "nullroute-playground",
            "url": "https://github.com/vesper-labs/nullroute-playground",
            "version": "0.1.0",
            "immutable_ref": "7cc90d1a23e5f84b619d8fcd3042a8e5b7190df2",
            "signals": {
                "stars": 14,
                "as_of": "2026-02-26T09:10:00Z",
            },
        },
    ],
}

MULTI_ARTIFACT_RECEIPT_HASH = (
    "sha256:6236739dd0428106ac62f064814681f272a2720b8f1e965b7257fdea0c3f9f61"
)

MULTI_ARTIFACT_RECEIPT_WITH_HASH = {
    **MULTI_ARTIFACT_RECEIPT,
    "meta": {"content_hash": MULTI_ARTIFACT_RECEIPT_HASH},
}


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------


class TestHashVectors:
    def test_minimal_receipt_hash(self):
        """Vector 1: minimal receipt produces the pinned SHA-256 digest."""
        assert compute_content_hash(MINIMAL_RECEIPT) == MINIMAL_RECEIPT_HASH

    def test_meta_receipt_hash(self):
        """Vector 2: receipt with meta block (no content_hash) matches pinned digest."""
        assert compute_content_hash(META_RECEIPT) == META_RECEIPT_HASH

    def test_multi_artifact_receipt_hash(self):
        """Vector 3: multi-artifact receipt with signals matches pinned digest."""
        assert compute_content_hash(MULTI_ARTIFACT_RECEIPT) == MULTI_ARTIFACT_RECEIPT_HASH

    def test_validate_minimal_receipt_with_embedded_hash(self):
        """Vector 1: validate_content_hash returns True when correct hash is embedded."""
        receipt = {
            **MINIMAL_RECEIPT,
            "meta": {"content_hash": MINIMAL_RECEIPT_HASH},
        }
        assert validate_content_hash(receipt) is True

    def test_validate_meta_receipt_with_embedded_hash(self):
        """Vector 2: validate_content_hash returns True when correct hash is embedded."""
        assert validate_content_hash(META_RECEIPT_WITH_HASH) is True

    def test_validate_multi_artifact_receipt_with_embedded_hash(self):
        """Vector 3: validate_content_hash returns True when correct hash is embedded."""
        assert validate_content_hash(MULTI_ARTIFACT_RECEIPT_WITH_HASH) is True

    def test_embedding_hash_does_not_change_digest(self):
        """Embedding content_hash in meta must not alter the computed digest."""
        h_before = compute_content_hash(META_RECEIPT)
        h_after = compute_content_hash(META_RECEIPT_WITH_HASH)
        assert h_before == h_after

    def test_wrong_hash_fails_validation(self):
        """A tampered content_hash must not validate."""
        receipt = {
            **MINIMAL_RECEIPT,
            "meta": {
                "content_hash": "sha256:" + "0" * 64,
            },
        }
        assert validate_content_hash(receipt) is False

    def test_meta_only_content_hash_treated_as_no_meta(self):
        """
        A meta block containing only content_hash should hash identically to
        a receipt with no meta block at all (spec: hash_validator removes
        the entire meta key when it becomes empty after popping content_hash).
        """
        without_meta = {
            "version": "1.0",
            "subject": {"name": "Ada"},
            "artifacts": [
                {
                    "kind": "repo",
                    "name": "pocketdb",
                    "url": "https://github.com/ada-dev/pocketdb",
                }
            ],
        }
        with_only_hash_meta = {
            **without_meta,
            "meta": {"content_hash": "sha256:" + "a" * 64},
        }
        assert compute_content_hash(without_meta) == compute_content_hash(
            with_only_hash_meta
        )
