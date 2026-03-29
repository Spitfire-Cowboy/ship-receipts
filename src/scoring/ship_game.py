"""Minimal offline game loop from local git history for Space-Ship Receipts."""

from __future__ import annotations

import json
import re
import subprocess
from datetime import datetime, timezone
from pathlib import Path

STATE_DIR = ".ship-receipts"
STATE_FILE = "space-ship-state.json"

COMMIT_POINTS = 5
TEST_PASS_POINTS = 2
MANUAL_POINTS = 1  # intentionally weak

TEST_PASS_RE = re.compile(r"\b(test|tests|ci)\b.*\b(pass|passed|green|ok)\b", re.IGNORECASE)


def _git(repo_root: Path, *args: str) -> str:
    cmd = ["git", *args]
    return subprocess.check_output(cmd, cwd=str(repo_root), text=True).strip()


def load_state(root_dir: str | Path = ".") -> dict:
    root = Path(root_dir)
    path = root / STATE_DIR / STATE_FILE
    if path.exists():
        return json.loads(path.read_text())
    return {
        "version": "1",
        "last_checkpoint": None,
        "total_score": 0,
        "manual_progress": 0,
        "events_seen": 0,
        "updated_at": None,
    }


def save_state(state: dict, root_dir: str | Path = ".") -> Path:
    root = Path(root_dir)
    path = root / STATE_DIR / STATE_FILE
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(state, indent=2) + "\n")
    return path


def ingest_git_events(repo_root: str | Path = ".", since: str | None = None) -> tuple[list[dict], str]:
    """Read commit history from local git and emit commit + test_pass events.

    `since` is exclusive git rev. If omitted, scans full history.
    """
    repo = Path(repo_root)
    range_spec = "HEAD"
    if since:
        range_spec = f"{since}..HEAD"

    try:
        lines = _git(
            repo,
            "log",
            "--reverse",
            "--pretty=format:%H|%cI|%s|%b",
            range_spec,
        ).splitlines()
    except subprocess.CalledProcessError:
        try:
            return [], _git(repo, "rev-parse", "HEAD")
        except subprocess.CalledProcessError:
            return [], ""

    events: list[dict] = []
    for line in lines:
        if not line:
            continue
        parts = line.split("|", 3)
        if len(parts) != 4:
            continue
        commit, committed_at, subject, body = parts
        msg = f"{subject}\n{body}".strip()

        events.append(
            {
                "kind": "commit",
                "commit": commit,
                "timestamp": committed_at,
                "message": subject,
            }
        )

        if TEST_PASS_RE.search(msg):
            events.append(
                {
                    "kind": "test_pass",
                    "commit": commit,
                    "timestamp": committed_at,
                    "message": "test pass signal from commit message",
                }
            )

    head = _git(repo, "rev-parse", "HEAD")
    return events, head


def replay_score(events: list[dict], manual_count: int = 0) -> dict:
    commits = sum(1 for e in events if e.get("kind") == "commit")
    test_passes = sum(1 for e in events if e.get("kind") == "test_pass")

    shipping_score = commits * COMMIT_POINTS + test_passes * TEST_PASS_POINTS
    manual_score = max(0, manual_count) * MANUAL_POINTS
    delta = shipping_score + manual_score

    return {
        "commits": commits,
        "test_passes": test_passes,
        "manual_actions": max(0, manual_count),
        "shipping_score": shipping_score,
        "manual_score": manual_score,
        "delta": delta,
    }


def snapshot(repo_root: str | Path = ".", since: str | None = None, state: dict | None = None) -> dict:
    state = state or load_state(repo_root)
    events, head = ingest_git_events(repo_root, since=since)
    score = replay_score(events, manual_count=state.get("manual_progress", 0))
    return {
        "since": since,
        "head": head,
        "events": len(events),
        "score": score,
        "total_score": state.get("total_score", 0),
    }


def apply_checkpoint(repo_root: str | Path = ".", since: str | None = None) -> dict:
    state = load_state(repo_root)
    events, head = ingest_git_events(repo_root, since=since)
    score = replay_score(events, manual_count=state.get("manual_progress", 0))

    state["total_score"] = int(state.get("total_score", 0)) + score["delta"]
    state["events_seen"] = int(state.get("events_seen", 0)) + len(events)
    state["last_checkpoint"] = head
    state["manual_progress"] = 0
    state["updated_at"] = datetime.now(timezone.utc).isoformat()
    save_state(state, repo_root)

    return {
        "state": state,
        "head": head,
        "events": events,
        "score": score,
    }
