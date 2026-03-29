#!/usr/bin/env python
"""
ship-receipts CLI — score, validate, and export ship receipts.

Usage:
    ship-receipts init [options]
    ship-receipts score <receipt.json>
    ship-receipts validate <receipt.json>
    ship-receipts export <receipt.json> [--output <file>]
    ship-receipts streak
    ship-receipts badge <receipt.json>
    ship-receipts party add|remove|list
    ship-receipts goal set "<text>"
    ship-receipts goal status
    ship-receipts goal complete
"""

from __future__ import annotations

import argparse
import json
import os
import re
import subprocess
import sys
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

from .scoring.engine import (
    STREAK_TIERS,
    compute_base_score,
    confidence_level,
    streak_multiplier,
)
from .scoring.hash_validator import compute_content_hash, validate_content_hash
from .scoring.badges import BADGE_COLORS, derive_badge
from .scoring.state import GameState
from .envelope.export import export_proof_envelope
from .party import (
    add_to_party,
    create_snapshot,
    fetch_github_profile,
    remove_from_party,
)


def _find_repo_root() -> Path:
    """Walk up from CWD to find the repo root (has schema/ dir)."""
    p = Path.cwd()
    while p != p.parent:
        if (p / "schema").is_dir():
            return p
        p = p.parent
    return Path.cwd()


def _load_receipt(path: str) -> dict:
    try:
        with open(path) as f:
            return json.load(f)
    except json.JSONDecodeError as e:
        print(f"error: invalid JSON in {path}: {e}", file=sys.stderr)
        sys.exit(1)
    except FileNotFoundError:
        print(f"error: file not found: {path}", file=sys.stderr)
        sys.exit(1)


def _validate_schema(receipt: dict, schema_path: Path) -> list[str]:
    """Validate receipt against JSON schema. Returns list of errors."""
    try:
        from jsonschema import Draft202012Validator
    except ImportError:
        print("warning: jsonschema not installed, skipping schema validation", file=sys.stderr)
        print("  install with: pip install jsonschema", file=sys.stderr)
        return []

    with open(schema_path) as f:
        schema = json.load(f)

    validator = Draft202012Validator(schema)
    return [f"{e.json_path}: {e.message}" for e in validator.iter_errors(receipt)]


def _count_proofs(receipt: dict) -> dict[str, int]:
    """Count proof elements by type."""
    counts: dict[str, int] = {}
    for artifact in receipt.get("artifacts", []):
        for v in artifact.get("verify", []):
            kind = v.get("kind", "other")
            counts[kind] = counts.get(kind, 0) + 1
    return counts


def _next_multiplier_info(current: int) -> tuple[int | None, float | None]:
    """Find the next streak tier above current. Returns (threshold, multiplier) or (None, None)."""
    for threshold, mult in sorted(STREAK_TIERS):
        if current < threshold:
            return threshold, mult
    return None, None


# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

VALID_KINDS = ("repo", "release", "package", "dataset", "paper", "demo", "disclosure", "community_contribution", "wellness", "session_replay", "other")
CLI_VERSION = "1.0"
GENERATOR = f"ship-receipts-cli/{CLI_VERSION}"


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

STATE_DIR = ".ship-receipts"
CONFIG_FILE = ".ship-receipts/config.json"
RECEIPTS_DIR = ".ship-receipts/receipts"


def _load_config() -> dict:
    p = Path(CONFIG_FILE)
    if p.exists():
        with open(p) as f:
            return json.load(f)
    return {}


def _git_user_name() -> str:
    try:
        result = subprocess.run(
            ["git", "config", "user.name"],
            capture_output=True, text=True, timeout=5
        )
        name = result.stdout.strip()
        return name if name else ""
    except Exception:
        return ""


def _slugify(text: str) -> str:
    text = text.lower()
    text = re.sub(r"[^a-z0-9]+", "-", text)
    return text.strip("-")[:40]


# ---------------------------------------------------------------------------
# Commands
# ---------------------------------------------------------------------------


def cmd_init(args: argparse.Namespace) -> int:
    """Create a new receipt interactively or from flags."""
    is_tty = sys.stdin.isatty()

    def prompt(flag_value: str | None, label: str, choices: tuple | None = None) -> str:
        if flag_value is not None:
            return flag_value
        if not is_tty:
            print(
                f"error: --{label.lower().replace(' ', '-')} is required when stdin is not a terminal",
                file=sys.stderr,
            )
            sys.exit(1)
        while True:
            if choices:
                print(f"  Choices: {', '.join(choices)}")
            value = input(f"{label}: ").strip()
            if value:
                return value
            print(f"  error: {label} cannot be empty.")

    name = prompt(args.name, "Artifact name")
    kind = prompt(args.kind, "Kind")
    url = prompt(args.url, "Artifact URL")
    subject = prompt(args.subject, "Builder name (subject)")

    if kind not in VALID_KINDS:
        print(
            f"error: invalid kind '{kind}'. Must be one of: {', '.join(VALID_KINDS)}",
            file=sys.stderr,
        )
        return 1

    now = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    receipt: dict = {
        "version": "1.0",
        "subject": {"name": subject},
        "artifacts": [{"kind": kind, "name": name, "url": url}],
        "meta": {"created_at": now, "generator": GENERATOR},
    }

    content_hash = None
    if args.hash:
        content_hash = compute_content_hash(receipt)
        receipt["meta"]["content_hash"] = content_hash

    output_path = args.output
    if not output_path:
        slug = name.lower().replace(" ", "-")
        output_path = f"{slug}.receipt.json"

    try:
        with open(output_path, "w") as f:
            json.dump(receipt, f, indent=2)
            f.write("\n")
    except OSError as e:
        print(f"error: could not write {output_path}: {e}", file=sys.stderr)
        return 2

    print(f"Created: {output_path}")
    if content_hash:
        print(f"Hash:    {content_hash}")

    return 0


def cmd_goal(args: argparse.Namespace) -> int:
    """Manage the Ithaca goal (odyssey system)."""
    state = GameState(root_dir=".")

    odyssey = state.state.setdefault("odyssey", {})
    subcommand = args.goal_command

    if subcommand == "set":
        if not args.text:
            print("error: provide goal text, e.g.  goal set \"Get one project producing revenue\"", file=sys.stderr)
            return 1
        odyssey["ithaca"] = args.text
        odyssey["set_at"] = datetime.now(timezone.utc).isoformat()
        odyssey["completed"] = False
        state.save()
        print(f"Goal set: \"{args.text}\"")
        print("Your Ithaca is declared. Every receipt will be measured against it.")
        return 0

    if subcommand == "status":
        ithaca = odyssey.get("ithaca")
        if not ithaca:
            print("No goal set. Run: ship-receipts goal set \"<your goal>\"")
            return 0
        completed = odyssey.get("completed", False)
        print(f"Goal:      {ithaca}")
        print(f"Status:    {'COMPLETE ✓' if completed else 'in progress'}")
        print(f"Receipts:  {state.state['receipts_submitted']} submitted")
        print(f"Streak:    {state.state['streak']['current']} days")
        return 0

    if subcommand == "complete":
        if not odyssey.get("ithaca"):
            print("No goal set. Run: ship-receipts goal set \"<your goal>\"", file=sys.stderr)
            return 1
        odyssey["completed"] = True
        odyssey["completed_at"] = datetime.now(timezone.utc).isoformat()
        state.save()
        print("⚓ Ithaca reached.")
        print(f"  \"{odyssey['ithaca']}\"")
        print()
        print("The journey is complete. Start a new one with: goal set")
        return 0

    print(f"Unknown goal subcommand: {subcommand}", file=sys.stderr)
    return 1


def _run_llm_hook(receipt: dict, goal: str | None, hook_cmd: str) -> None:
    """Run the configured LLM hook and print its response."""
    receipt_json = json.dumps(receipt, indent=2)
    cmd = hook_cmd.replace("{goal}", goal or "").replace("{receipt_json}", receipt_json)
    try:
        result = subprocess.run(cmd, shell=True, capture_output=True, text=True, timeout=60)
        response = result.stdout.strip()
        if response:
            print()
            print("  Compass " + "─" * 48)
            for line in response.splitlines():
                print(f"  {line}")
            print("  " + "─" * 56)
    except subprocess.TimeoutExpired:
        print("  (Compass hook timed out)", file=sys.stderr)
    except Exception as e:
        print(f"  (Compass hook error: {e})", file=sys.stderr)


def cmd_validate(args: argparse.Namespace) -> int:
    """Validate a receipt against schema and (optionally) content hash."""
    receipt = _load_receipt(args.receipt)
    use_json = getattr(args, "json", False)
    strict = getattr(args, "strict", False)

    repo_root = _find_repo_root()
    schema_path = repo_root / "schema" / "ship-receipts.v1.schema.json"

    errors: list[dict[str, str]] = []
    hash_status = "skip"

    # Schema validation
    if schema_path.exists():
        schema_errors = _validate_schema(receipt, schema_path)
        for e in schema_errors:
            errors.append({"path": e.split(":")[0] if ":" in e else "", "message": e})
    # else: skip

    # Content hash (only if --strict)
    if strict:
        claimed = receipt.get("meta", {}).get("content_hash", "")
        if claimed:
            if validate_content_hash(receipt):
                hash_status = "pass"
            else:
                hash_status = "fail"
                errors.append({"path": "meta.content_hash", "message": "does not match computed hash"})
        else:
            hash_status = "skip"

    valid = len(errors) == 0
    proof_counts = _count_proofs(receipt)
    total_proofs = sum(proof_counts.values())
    num_artifacts = len(receipt.get("artifacts", []))

    if use_json:
        result = {
            "file": args.receipt,
            "valid": valid,
            "errors": errors,
            "stats": {"artifacts": num_artifacts, "proofs": total_proofs},
        }
        print(json.dumps(result, indent=2))
    else:
        print(f"Receipt: {args.receipt}")
        print()
        if schema_path.exists():
            schema_errors = [e for e in errors if e["path"] != "meta.content_hash"]
            if schema_errors:
                print("Schema:  FAIL")
                for e in schema_errors:
                    print(f"  {e['message']}")
            else:
                print("Schema:  PASS")
        else:
            print("Schema:  SKIP (schema file not found)")

        if strict:
            if hash_status == "pass":
                print("Hash:    PASS")
            elif hash_status == "fail":
                print("Hash:    FAIL -- content_hash does not match computed hash")
            else:
                print("Hash:    SKIP (no meta.content_hash)")
        else:
            print("Hash:    SKIP (use --strict to verify)")

        base, _ = compute_base_score(receipt)
        proof_desc = ", ".join(f"{v} {k}" for k, v in proof_counts.items()) if proof_counts else "none"
        print(f"Artifacts: {num_artifacts}")
        print(f"Proofs:  {total_proofs} ({proof_desc})")
        print()
        if valid:
            print("VALID")
        else:
            print("FAIL")

    return 0 if valid else 1


def _cmd_score_receipt(args: argparse.Namespace) -> int:
    """Score a receipt and update local game state."""
    receipt = _load_receipt(args.receipt)
    use_json = getattr(args, "json", False)
    dry_run = getattr(args, "dry_run", False)

    # Schema validation first
    repo_root = _find_repo_root()
    schema_path = repo_root / "schema" / "ship-receipts.v1.schema.json"
    if schema_path.exists():
        errors = _validate_schema(receipt, schema_path)
        if errors:
            if use_json:
                print(json.dumps({"file": args.receipt, "status": "rejected", "errors": errors}))
            else:
                print(f"Receipt: {args.receipt}")
                print("Status:  REJECTED (schema validation failed)")
                for e in errors:
                    print(f"  {e}")
            return 1

    state = GameState(root_dir=".")
    result = state.score_receipt(receipt)
    if not dry_run:
        state.save()

    subject = receipt.get("subject", {}).get("name", "unknown")

    if use_json:
        streak_info = state.state["streak"]
        current = streak_info["current"]
        next_thresh, _ = _next_multiplier_info(current)
        output = {
            "file": args.receipt,
            "subject": subject,
            "status": result["status"].lower(),
            "score": {
                "base": result.get("base_score", 0),
                "streak_multiplier": result.get("multipliers", {}).get("streak_multiplier", 1.0),
                "integrity_multiplier": result.get("multipliers", {}).get("integrity_multiplier", 1.0),
                "final": result.get("score", 0),
            },
            "breakdown": result.get("breakdown", {}),
            "streak": {"current": current, "next_multiplier_at": next_thresh},
            "total": {
                "score": state.state["total_score"],
                "receipts": state.state["receipts_submitted"],
            },
        }
        print(json.dumps(output, indent=2))
        return 0 if result["status"] == "ACCEPTED" else 1

    print(f"Receipt: {args.receipt}")
    print(f"Subject: {subject}")
    print(f"Status:  {result['status']}")
    if dry_run:
        print("  (dry run -- state not saved)")
    print()

    if result["status"] == "ACCEPTED":
        breakdown = result.get("breakdown", {})
        mults = result.get("multipliers", {})

        print(f"  Base Score:          {result['base_score']}")
        print(f"  Streak Multiplier:   {mults.get('streak_multiplier', 1.0)}x ({state.state['streak']['current']}-day streak)")
        print(f"  Integrity Bonus:     {mults.get('integrity_multiplier', 1.0)}x")
        print(f"  {'-' * 23}")
        print(f"  Final Score:         {result['score']}")
        print()
        print("  Proof Breakdown:")
        for key, pts in sorted(breakdown.items()):
            print(f"    {key:<28s} {pts}")
        base_total = sum(breakdown.values())
        print(f"    {'':28s} --")
        print(f"    {'Base Total':28s} {base_total}")
        print()

        streak = state.state["streak"]
        current = streak["current"]
        next_thresh, next_mult = _next_multiplier_info(current)
        next_tier = ""
        if next_thresh is not None:
            next_tier = f" (next multiplier at {next_thresh} days: {next_mult}x)"

        print(f"  Streak: {current} days{next_tier}")
        print(f"  Confidence: {result['confidence']}")
        print(f"  Total Score: {state.state['total_score']} ({state.state['receipts_submitted']} receipts)")

    elif result["status"] == "REJECTED":
        print(f"  Reason: {result.get('reason', 'unknown')}")

    elif result["status"] == "DUPLICATE":
        print("  This receipt has already been submitted.")

    # LLM hook — runs only on ACCEPTED receipts
    if result["status"] == "ACCEPTED":
        config = _load_config()
        hook_cmd = config.get("odyssey", {}).get("llm_hook", "")
        if hook_cmd:
            goal = state.state.get("odyssey", {}).get("ithaca")
            _run_llm_hook(receipt, goal, hook_cmd)

    return 0 if result["status"] == "ACCEPTED" else 1


def _print_space_ship_snapshot(data: dict, state: dict) -> None:
    score = data["score"]
    print("Space-Ship Receipts Snapshot")
    print(f"  HEAD: {data['head'][:10]}")
    print(f"  Commits: {score['commits']}")
    print(f"  Test-pass signals: {score['test_passes']}")
    print(f"  Shipping score: {score['shipping_score']}")
    print(f"  Manual Y actions: {score['manual_actions']} (small boost)")
    print(f"  Manual score: {score['manual_score']}  <-- intentionally weak")
    print("  Shipping artifacts are the primary score source.")
    print(f"  Delta score: {score['delta']}")
    print(f"  Total score: {state.get('total_score', 0)}")


def cmd_score(args: argparse.Namespace) -> int:
    """Score a receipt, or replay git events since a checkpoint."""
    if args.since:
        since = args.since
        state = load_state(".")
        if since == "last":
            since = state.get("last_checkpoint")
        result = apply_checkpoint(".", since=since)
        print("Space-Ship Receipts Score Replay")
        print(f"  Since: {since or 'start-of-history'}")
        print(f"  New checkpoint: {result['head'][:10]}")
        _print_space_ship_snapshot(
            {"head": result["head"], "score": result["score"]},
            result["state"],
        )
        return 0

    if not args.receipt:
        print("error: receipt path required unless using --since", file=sys.stderr)
        return 1

    return _cmd_score_receipt(args)


def cmd_export(args: argparse.Namespace) -> int:
    """Export a receipt as a proof envelope for proofofship."""
    receipt = _load_receipt(args.receipt)

    repo_root = _find_repo_root()
    schema_path = repo_root / "schema" / "ship-receipts.v1.schema.json"
    if schema_path.exists():
        errors = _validate_schema(receipt, schema_path)
        if errors:
            print("error: receipt fails schema validation:", file=sys.stderr)
            for e in errors:
                print(f"  {e}", file=sys.stderr)
            return 1

    state_path = Path(".ship-receipts/game-state.json")
    game_state = None
    if state_path.exists():
        with open(state_path) as f:
            game_state = json.load(f)

    try:
        envelope = export_proof_envelope(receipt, game_state)
    except ValueError as e:
        print(f"error: {e}", file=sys.stderr)
        return 1

    output_path = args.output
    if not output_path:
        base = Path(args.receipt).stem
        output_path = f"{base}.envelope.json"

    with open(output_path, "w") as f:
        json.dump(envelope, f, indent=2)
        f.write("\n")

    print(f"Exported proof envelope to {output_path}")
    print(f"  Content Hash: {envelope['content_hash'][:40]}...")
    print(f"  Actor: {envelope['actor']['github_username']}")
    print(f"  Envelope ID: {envelope['envelope_id']}")

    if "local_score_snapshot" in envelope:
        snap = envelope["local_score_snapshot"]
        print(f"  Local Score: {snap['final_score']} (informational only)")

    return 0


def _build_weekly_grid(history: list[dict]) -> list[list[str]]:
    """Build a 2-row weekly grid (this week, last week) from history."""
    today = date.today()
    # Monday of this week
    monday = today - timedelta(days=today.weekday())

    # Group scores by date
    daily_scores: dict[str, int] = {}
    for entry in history:
        d = entry.get("date", "")
        if d:
            daily_scores[d] = daily_scores.get(d, 0) + entry.get("score", 0)

    rows = []
    for week_offset in [0, 1]:
        week_start = monday - timedelta(weeks=week_offset)
        row = []
        for day_offset in range(7):
            d = (week_start + timedelta(days=day_offset)).isoformat()
            if d in daily_scores:
                row.append(str(daily_scores[d]))
            else:
                row.append("--")
        rows.append(row)

    return rows


def cmd_streak(args: argparse.Namespace) -> int:
    """Show current streak status."""
    state = GameState(root_dir=".")
    use_json = getattr(args, "json", False)

    streak = state.state["streak"]
    current = streak["current"]
    longest = streak.get("longest", 0)
    last_date = streak.get("last_qualifying_date")
    start_date = streak.get("streak_start_date", "--")

    # Determine active/broken
    today = date.today()
    if last_date:
        last = date.fromisoformat(last_date)
        days_since = (today - last).days
        active = days_since <= 1
    else:
        days_since = None
        active = False

    next_thresh, next_mult = _next_multiplier_info(current)

    if use_json:
        result = {
            "current": current,
            "longest": longest,
            "active": active,
            "multiplier": streak_multiplier(current),
            "next_multiplier_at": next_thresh,
            "total_score": state.state["total_score"],
            "receipts_submitted": state.state["receipts_submitted"],
            "receipts_rejected": state.state["receipts_rejected"],
        }
        print(json.dumps(result, indent=2))
        return 0

    status_label = "active" if active else "broken"
    if not active and days_since is not None:
        status_label = f"broken, {days_since} days ago"

    print("Streak Status")
    print(f"  Streak:  {current} days ({status_label})")
    print(f"  Started: {start_date}")
    print(f"  Last:    {last_date or 'never'}")
    print(f"  Longest: {longest} days")
    print()
    print(f"  Multiplier: {streak_multiplier(current)}x")
    if next_thresh is not None:
        remaining = next_thresh - current
        print(f"  Next:       {next_mult}x at {next_thresh} days ({remaining} more days)")
    print()

    # Weekly grid
    history = state.state.get("history", [])
    if history:
        rows = _build_weekly_grid(history)
        print("  M    T    W    T    F    S    S")
        labels = [" <- this week", " <- last week"]
        for i, row in enumerate(rows):
            cells = "  ".join(f"{c:>2s}" for c in row)
            print(f"  {cells}{labels[i]}")
        print()

    print(f"  Total Score: {state.state['total_score']} ({state.state['receipts_submitted']} receipts)")

    return 0


def cmd_badge(args: argparse.Namespace) -> int:
    """Show the current badge for a receipt."""
    receipt = _load_receipt(args.receipt)
    content_hash = (
        receipt.get("meta", {}).get("content_hash")
        or compute_content_hash(receipt)
    )
    state = GameState(root_dir=".")
    events = state.state.get("events", [])
    badge = derive_badge(events, content_hash)
    color = BADGE_COLORS.get(badge, "white")
    print(f"Badge: {badge} ({color})")
    return 0


def cmd_party(args: argparse.Namespace) -> int:
    """Manage the party roster."""
    party_cmd = getattr(args, "party_command", None)
    if not party_cmd:
        print("error: party requires a subcommand: add, remove, list", file=sys.stderr)
        return 1

    state = GameState(root_dir=".")

    if party_cmd == "add":
        username = args.username
        print(f"Fetching GitHub profile for {username}...")
        profile = fetch_github_profile(username)
        if profile is None:
            print(f"error: GitHub user '{username}' not found", file=sys.stderr)
            return 1
        snapshot = create_snapshot(profile)
        add_to_party(state.state, snapshot)
        state.save()
        print(f"Added {snapshot['display_name']} (@{snapshot['username']}) to party")
        print(f"  Class: {snapshot['class']}")
        print(f"  Repos: {snapshot['public_repos']}")
        print(f"  Since: {snapshot['created_at']}")
        return 0

    if party_cmd == "remove":
        username = args.username
        removed = remove_from_party(state.state, username)
        if removed:
            state.save()
            print(f"Removed @{username} from party")
        else:
            print(f"@{username} not in party")
        return 0

    if party_cmd == "list":
        party = state.state.get("party", [])
        if not party:
            print("Party is empty. Use 'ship-receipts party add <username>' to add members.")
            return 0
        print(f"Party ({len(party)} members):")
        for member in party:
            print(f"  @{member['username']:<20s} {member['class']:<12s} {member['public_repos']} repos")
        return 0

    return 1


def cmd_snapshot(args: argparse.Namespace) -> int:
    state = load_state(".")
    since = args.since
    if since == "last":
        since = state.get("last_checkpoint")
    data = snapshot(".", since=since, state=state)
    _print_space_ship_snapshot(data, state)
    return 0


def cmd_watch(args: argparse.Namespace) -> int:
    print("Watching Space-Ship Receipts. Keys: Y=manual micro-progress, Q=quit")
    print("Manual progress is intentionally weak; shipping artifacts are primary.")
    while True:
        state = load_state(".")
        since = state.get("last_checkpoint")
        data = snapshot(".", since=since, state=state)
        _print_space_ship_snapshot(data, state)

        if select:
            ready, _, _ = select.select([sys.stdin], [], [], 2.0)
            if ready:
                key = sys.stdin.readline().strip().lower()
                if key == "q":
                    return 0
                if key == "y":
                    state["manual_progress"] = int(state.get("manual_progress", 0)) + 1
                    save_state(state, ".")
                    print("Manual Y registered (+1). Keep shipping artifacts; they score more.")
        else:
            time.sleep(2)


def cmd_y(args: argparse.Namespace) -> int:
    state = load_state(".")
    state["manual_progress"] = int(state.get("manual_progress", 0)) + 1
    save_state(state, ".")
    print("Y registered: +1 micro-progress (intentionally weak).")
    print("Shipping artifacts remain the primary score source.")
    return 0


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        prog="ship-receipts",
        description="Score, validate, and export ship receipts.",
    )
    sub = parser.add_subparsers(dest="command", help="Available commands")

    # init
    p_init = sub.add_parser("init", help="Create a new receipt interactively or from flags")
    p_init.add_argument("--name", help="Artifact name")
    p_init.add_argument("--kind", help=f"Artifact kind: {', '.join(VALID_KINDS)}")
    p_init.add_argument("--url", help="Artifact URL")
    p_init.add_argument("--subject", help="Builder name")
    p_init.add_argument("--output", "-o", help="Output file path (default: <name>.receipt.json)")
    p_init.add_argument("--hash", action="store_true", default=True, help="Compute content_hash (default: true)")
    p_init.add_argument("--no-hash", dest="hash", action="store_false", help="Skip content_hash computation")

    # score
    p_score = sub.add_parser("score", help="Score a receipt or replay git events")
    p_score.add_argument("receipt", nargs="?", help="Path to receipt JSON file")
    p_score.add_argument("--since", help="Replay git events since checkpoint/rev (or 'last')")
    p_score.add_argument("--dry-run", dest="dry_run", action="store_true", help="Score without updating state")
    p_score.add_argument("--json", dest="json", action="store_true", help="Output as JSON")

    # snapshot/watch/manual
    p_snapshot = sub.add_parser("snapshot", help="Show one-shot Space-Ship Receipts status")
    p_snapshot.add_argument("--since", default="last", help="Checkpoint/rev (default: last)")
    sub.add_parser("watch", help="Live Space-Ship Receipts view with Y/Q controls")
    sub.add_parser("y", help="Manual micro-progress action (+1, intentionally weak)")

    # validate
    p_validate = sub.add_parser("validate", help="Validate a receipt (no scoring)")
    p_validate.add_argument("receipt", help="Path to receipt JSON file")
    p_validate.add_argument("--strict", action="store_true", help="Also verify content_hash")
    p_validate.add_argument("--json", dest="json", action="store_true", help="Output as JSON")

    # export
    p_export = sub.add_parser("export", help="Export a receipt as a proof envelope")
    p_export.add_argument("receipt", help="Path to receipt JSON file")
    p_export.add_argument("--output", "-o", help="Output file (default: <receipt>.envelope.json)")

    # streak
    p_streak = sub.add_parser("streak", help="Show current streak status")
    p_streak.add_argument("--json", dest="json", action="store_true", help="Output as JSON")

    # badge
    p_badge = sub.add_parser("badge", help="Show badge status for a receipt")
    p_badge.add_argument("receipt", help="Path to receipt JSON file")

    # party
    p_party = sub.add_parser("party", help="Manage party roster")
    party_sub = p_party.add_subparsers(dest="party_command")
    p_party_add = party_sub.add_parser("add", help="Add a GitHub user to the party")
    p_party_add.add_argument("username", help="GitHub username")
    p_party_remove = party_sub.add_parser("remove", help="Remove a user from the party")
    p_party_remove.add_argument("username", help="GitHub username")
    party_sub.add_parser("list", help="List party members")

    # goal
    p_goal = sub.add_parser("goal", help="Manage your Ithaca goal (odyssey system)")
    goal_sub = p_goal.add_subparsers(dest="goal_command", help="Goal subcommand")
    p_goal_set = goal_sub.add_parser("set", help="Set your Ithaca goal")
    p_goal_set.add_argument("text", help="Goal text")
    goal_sub.add_parser("status", help="Show goal and progress")
    goal_sub.add_parser("complete", help="Mark journey complete")

    args = parser.parse_args(argv)

    if not args.command:
        parser.print_help()
        return 1

    if args.command == "party" and not getattr(args, "party_command", None):
        p_party.print_help()
        return 1

    commands = {
        "init": cmd_init,
        "score": cmd_score,
        "validate": cmd_validate,
        "export": cmd_export,
        "streak": cmd_streak,
        "badge": cmd_badge,
        "party": cmd_party,
        "snapshot": cmd_snapshot,
        "watch": cmd_watch,
        "y": cmd_y,
        "goal": cmd_goal,
    }

    # goal requires a subcommand
    if args.command == "goal" and not getattr(args, "goal_command", None):
        p_goal.print_help()
        return 1

    return commands[args.command](args)


if __name__ == "__main__":
    sys.exit(main())
