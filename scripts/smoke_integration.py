#!/usr/bin/env python
"""
End-to-end smoke test: ship-receipts local scoring → envelope export.

Usage:
    python scripts/smoke_integration.py

Exit code 0 = all checks pass.
"""

from __future__ import annotations

import json
import os
import sys
import tempfile

# Add repo root to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from src.scoring.state import GameState
from src.scoring.hash_validator import compute_content_hash
from src.envelope.export import export_proof_envelope


def main() -> int:
    passed = 0
    failed = 0

    def check(name: str, condition: bool, detail: str = ""):
        nonlocal passed, failed
        if condition:
            print(f"  PASS: {name}")
            passed += 1
        else:
            print(f"  FAIL: {name} — {detail}")
            failed += 1

    print("=" * 60)
    print("Ship-Receipts Integration Smoke Test")
    print("=" * 60)

    # --- Step 1: Build receipt ---
    print("\n[Step 1] Build receipt")
    receipt = {
        "version": "0.1",
        "subject": {
            "name": "SmokeTest Builder",
            "profiles": [{"kind": "github", "url": "https://github.com/smoketest"}],
        },
        "meta": {"created_at": "2026-02-25T12:00:00Z"},
        "artifacts": [
            {
                "kind": "repo",
                "name": "smoke-app",
                "url": "https://github.com/smoketest/smoke-app",
                "immutable_ref": "abc123def456",
                "ci_url": "https://github.com/smoketest/smoke-app/actions/runs/1",
                "verify": [
                    {"kind": "checksum", "algo": "sha256", "hash": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"},
                    {"kind": "command", "command": "npm test"},
                ],
                "signals": {"stars": 10, "downloads_30d": 500},
            }
        ],
    }
    receipt["meta"]["content_hash"] = compute_content_hash(receipt)
    check("Receipt built", True)

    # --- Step 2: Score locally ---
    print("\n[Step 2] Score locally")
    tmpdir = tempfile.mkdtemp()
    state = GameState(root_dir=tmpdir)
    result = state.score_receipt(receipt)
    state.save()

    check("Status is ACCEPTED", result["status"] == "ACCEPTED", f"got {result['status']}")
    # name(1)+profiles(2)+created_at(1)+content_hash(3)+immutable(2)+ci_url(1)+checksum(3)+command(2)+stars(1)+downloads(1) = 17
    check("Base score is 17", result["base_score"] == 17, f"got {result['base_score']}")
    check("Final score is 25 (17 × 1.0 × 1.5)", result["score"] == 25, f"got {result['score']}")
    check("Qualifies for streak", result["qualifies_for_streak"] is True)
    check("Confidence is strong", result["confidence"] == "strong", f"got {result['confidence']}")

    # --- Step 3: Duplicate rejected ---
    print("\n[Step 3] Duplicate detection")
    dup_result = state.score_receipt(receipt)
    check("Duplicate status", dup_result["status"] == "DUPLICATE", f"got {dup_result['status']}")
    check("Duplicate score is 0", dup_result["score"] == 0)

    # --- Step 4: Tamper detection ---
    print("\n[Step 4] Tamper detection")
    tampered = json.loads(json.dumps(receipt))
    tampered["artifacts"][0]["name"] = "TAMPERED"
    # Need fresh state to avoid duplicate detection of original
    state2 = GameState(root_dir=tempfile.mkdtemp())
    tamper_result = state2.score_receipt(tampered)
    check("Tampered receipt REJECTED", tamper_result["status"] == "REJECTED", f"got {tamper_result['status']}")

    # --- Step 5: Export envelope ---
    print("\n[Step 5] Export proof envelope")
    envelope = export_proof_envelope(receipt, state.state)
    check("Envelope version is 1.0", envelope["envelope_version"] == "1.0")
    check("Content hash starts with sha256:", envelope["content_hash"].startswith("sha256:"))
    check("Actor is smoketest", envelope["actor"]["github_username"] == "smoketest")
    check("Receipt embedded", envelope["receipt"] == receipt)
    check("Local snapshot present", "local_score_snapshot" in envelope)

    if "local_score_snapshot" in envelope:
        snap = envelope["local_score_snapshot"]
        check("Snapshot base_score is 17", snap["base_score"] == 17, f"got {snap['base_score']}")
        check("Snapshot final_score is 25", snap["final_score"] == 25, f"got {snap['final_score']}")

    # --- Summary ---
    print("\n" + "=" * 60)
    total = passed + failed
    print(f"Results: {passed}/{total} passed, {failed} failed")
    print("=" * 60)

    return 0 if failed == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
