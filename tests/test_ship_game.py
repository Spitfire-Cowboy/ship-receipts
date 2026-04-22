import os
import subprocess

from src.scoring.ship_game import (
    apply_checkpoint,
    ingest_git_events,
    load_state,
    replay_score,
)


def _git(tmp_path, *args):
    return subprocess.check_output(["git", *args], cwd=str(tmp_path), text=True).strip()


def _init_repo(tmp_path):
    _git(tmp_path, "init")
    _git(tmp_path, "config", "user.email", "test@example.com")
    _git(tmp_path, "config", "user.name", "Test User")


def _commit(tmp_path, filename, content, msg):
    p = tmp_path / filename
    p.write_text(content)
    _git(tmp_path, "add", filename)
    _git(tmp_path, "commit", "-m", msg)
    return _git(tmp_path, "rev-parse", "HEAD")


def test_replay_score_manual_is_weak():
    events = [{"kind": "commit"}, {"kind": "commit"}, {"kind": "test_pass"}]
    out = replay_score(events, manual_count=3)
    assert out["shipping_score"] == 12
    assert out["manual_score"] == 3
    assert out["manual_score"] < out["shipping_score"]


def test_checkpoint_replay_from_commit(tmp_path):
    _init_repo(tmp_path)
    first = _commit(tmp_path, "a.txt", "a", "first")
    _commit(tmp_path, "b.txt", "b", "tests passed in ci")

    events, _ = ingest_git_events(tmp_path, since=first)
    kinds = [e["kind"] for e in events]
    assert "commit" in kinds
    assert "test_pass" in kinds

    result = apply_checkpoint(tmp_path, since=first)
    state = load_state(tmp_path)

    assert result["score"]["commits"] == 1
    assert result["score"]["test_passes"] == 1
    assert state["last_checkpoint"] == result["head"]
    assert state["total_score"] == result["score"]["delta"]
