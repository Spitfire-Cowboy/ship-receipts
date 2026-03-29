#!/usr/bin/env python3
"""
export_proof_envelope.py — Stub tool for exporting a ship-receipt as a proof envelope.

Reads a local receipt JSON, validates it, wraps it in a proof envelope,
and writes the envelope to stdout or a file.

Usage:
    python3 scripts/export_proof_envelope.py <receipt.json> [--output <file>]

Dependencies:
    pip install jsonschema

Note: This is a stub/MVP tool. No network calls, no authentication.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import sys
import time


def generate_ulid() -> str:
    """Generate a ULID-like string. Stub implementation using timestamp + random."""
    import random

    # Crockford Base32 alphabet
    alphabet = "0123456789ABCDEFGHJKMNPQRSTVWXYZ"
    # Timestamp component (48 bits = 10 chars)
    ts_ms = int(time.time() * 1000)
    ts_chars = []
    for _ in range(10):
        ts_chars.append(alphabet[ts_ms & 0x1F])
        ts_ms >>= 5
    ts_chars.reverse()
    # Random component (80 bits = 16 chars)
    rand_chars = [random.choice(alphabet) for _ in range(16)]
    return "".join(ts_chars) + "".join(rand_chars)


def canonical_json(obj: dict) -> str:
    """Produce canonical JSON for hashing: sorted keys, compact, UTF-8."""
    return json.dumps(obj, sort_keys=True, separators=(",", ":"), ensure_ascii=False)


def compute_content_hash(receipt: dict) -> str:
    """Compute SHA-256 content hash of a receipt in canonical form."""
    # Remove meta.content_hash before hashing (if present)
    receipt_copy = json.loads(json.dumps(receipt))
    if "meta" in receipt_copy and "content_hash" in receipt_copy["meta"]:
        del receipt_copy["meta"]["content_hash"]
        # Remove meta entirely if empty
        if not receipt_copy["meta"]:
            del receipt_copy["meta"]
    canonical = canonical_json(receipt_copy)
    digest = hashlib.sha256(canonical.encode("utf-8")).hexdigest()
    return f"sha256:{digest}"


def extract_github_username(receipt: dict) -> str | None:
    """Extract GitHub username from receipt subject profiles."""
    profiles = receipt.get("subject", {}).get("profiles", [])
    for profile in profiles:
        if profile.get("kind") == "github":
            url = profile.get("url", "")
            # Extract username from GitHub URL
            match = re.match(r"https?://github\.com/([a-zA-Z0-9](?:[a-zA-Z0-9]|-(?=[a-zA-Z0-9])){0,38})", url)
            if match:
                return match.group(1)
    return None


def validate_receipt(receipt: dict, schema_path: str) -> list[str]:
    """Validate receipt against schema. Returns list of error messages."""
    try:
        from jsonschema import Draft202012Validator
    except ImportError:
        print("WARNING: jsonschema not installed. Skipping schema validation.", file=sys.stderr)
        print("  Install with: pip install jsonschema", file=sys.stderr)
        return []

    with open(schema_path) as f:
        schema = json.load(f)

    validator = Draft202012Validator(schema)
    errors = []
    for error in validator.iter_errors(receipt):
        errors.append(f"{error.json_path}: {error.message}")
    return errors


def build_envelope(receipt: dict, github_username: str, content_hash: str) -> dict:
    """Build a proof envelope wrapping the receipt."""
    from datetime import datetime, timezone

    display_name = receipt.get("subject", {}).get("name", github_username)
    profile_urls = [
        p["url"]
        for p in receipt.get("subject", {}).get("profiles", [])
        if "url" in p
    ]

    return {
        "envelope_version": "1.0",
        "envelope_id": generate_ulid(),
        "content_hash": content_hash,
        "submitted_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "actor": {
            "github_username": github_username,
            "display_name": display_name,
            "profile_urls": profile_urls,
        },
        "receipt": receipt,
        "export_metadata": {
            "generator": "export_proof_envelope.py",
            "generator_version": "0.1.0",
            "ship_receipts_schema_version": receipt.get("version", "0.1"),
        },
    }


def main():
    parser = argparse.ArgumentParser(
        description="Export a ship-receipt as a proof envelope for proofofship."
    )
    parser.add_argument("receipt", help="Path to receipt JSON file")
    parser.add_argument("--output", "-o", help="Output file (default: stdout)")
    parser.add_argument(
        "--schema-dir",
        default=None,
        help="Directory containing schema files (default: auto-detect from script location)",
    )
    args = parser.parse_args()

    # Find schema directory
    if args.schema_dir:
        schema_dir = args.schema_dir
    else:
        # Auto-detect: script is in scripts/, schemas are in schema/ and schemas/
        repo_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        schema_dir = repo_root

    receipt_schema_path = os.path.join(schema_dir, "schema", "ship-receipts.v0.1.schema.json")
    envelope_schema_path = os.path.join(schema_dir, "schemas", "proof-envelope.v1.json")

    # 1. Read receipt
    try:
        with open(args.receipt) as f:
            receipt = json.load(f)
    except json.JSONDecodeError as e:
        print(f"error: E_PARSE — Invalid JSON: {e}", file=sys.stderr)
        sys.exit(1)
    except FileNotFoundError:
        print(f"error: File not found: {args.receipt}", file=sys.stderr)
        sys.exit(2)

    # 2. Validate receipt against schema
    if os.path.exists(receipt_schema_path):
        errors = validate_receipt(receipt, receipt_schema_path)
        if errors:
            print("error: E_SCHEMA — Receipt failed schema validation:", file=sys.stderr)
            for err in errors:
                print(f"  {err}", file=sys.stderr)
            sys.exit(1)
        print("PASS: Receipt validates against schema", file=sys.stderr)
    else:
        print(f"WARNING: Schema not found at {receipt_schema_path}, skipping validation", file=sys.stderr)

    # 3. Extract GitHub username
    github_username = extract_github_username(receipt)
    if not github_username:
        print("error: E_NO_GITHUB — No GitHub profile found in subject.profiles", file=sys.stderr)
        print("  hint: Add a profile with kind='github' and a GitHub URL", file=sys.stderr)
        sys.exit(1)
    print(f"PASS: GitHub username extracted: {github_username}", file=sys.stderr)

    # 4. Check subject.name
    subject_name = receipt.get("subject", {}).get("name", "")
    if not subject_name:
        print("error: E_SUBJECT — subject.name is empty", file=sys.stderr)
        sys.exit(1)

    # 5. Check artifacts
    artifacts = receipt.get("artifacts", [])
    if not artifacts or not any(a.get("url") for a in artifacts):
        print("error: E_NO_ARTIFACT — No artifacts with URLs found", file=sys.stderr)
        sys.exit(1)

    # 6. Compute content hash
    content_hash = compute_content_hash(receipt)
    print(f"PASS: Content hash computed: {content_hash[:30]}...", file=sys.stderr)

    # 7. Build envelope
    envelope = build_envelope(receipt, github_username, content_hash)

    # 8. Validate envelope against schema
    if os.path.exists(envelope_schema_path):
        errors = validate_receipt(envelope, envelope_schema_path)
        if errors:
            print("error: Envelope failed schema validation (bug in export tool):", file=sys.stderr)
            for err in errors:
                print(f"  {err}", file=sys.stderr)
            sys.exit(1)
        print("PASS: Envelope validates against proof-envelope.v1.json", file=sys.stderr)

    # 9. Output
    output_json = json.dumps(envelope, indent=2, ensure_ascii=False)
    if args.output:
        with open(args.output, "w") as f:
            f.write(output_json)
            f.write("\n")
        print(f"Envelope written to {args.output}", file=sys.stderr)
    else:
        print(output_json)

    print("EXPORT COMPLETE", file=sys.stderr)


if __name__ == "__main__":
    main()
