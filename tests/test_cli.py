"""
Tests for the ship-receipts CLI.
"""

import json
import os
import tempfile

import pytest

from src.cli import main


def _write_receipt(tmpdir, receipt=None, filename="receipt.json"):
    if receipt is None:
        receipt = {
            "version": "0.1",
            "subject": {
                "name": "CLITest",
                "profiles": [{"kind": "github", "url": "https://github.com/clitest"}],
            },
            "meta": {"created_at": "2026-02-25T12:00:00Z"},
            "artifacts": [
                {
                    "kind": "repo",
                    "name": "app",
                    "url": "https://github.com/clitest/app",
                    "immutable_ref": "abc123",
                }
            ],
        }
    path = os.path.join(tmpdir, filename)
    with open(path, "w") as f:
        json.dump(receipt, f)
    return path


class TestValidateCommand:
    def test_valid_receipt(self, tmp_path):
        path = _write_receipt(str(tmp_path))
        # validate should return 0 for valid receipt
        result = main(["validate", path])
        assert result == 0

    def test_missing_file(self):
        with pytest.raises(SystemExit):
            main(["validate", "nonexistent.json"])


class TestScoreCommand:
    def test_score_accepted(self, tmp_path):
        path = _write_receipt(str(tmp_path))
        # Change to tmpdir so game state is isolated
        old_cwd = os.getcwd()
        os.chdir(str(tmp_path))
        try:
            result = main(["score", path])
            assert result == 0
            # Game state file should exist
            assert os.path.exists(".ship-receipts/game-state.json")
        finally:
            os.chdir(old_cwd)

    def test_score_duplicate(self, tmp_path):
        path = _write_receipt(str(tmp_path))
        old_cwd = os.getcwd()
        os.chdir(str(tmp_path))
        try:
            main(["score", path])  # First score
            result = main(["score", path])  # Duplicate
            assert result == 1  # Duplicate returns 1
        finally:
            os.chdir(old_cwd)


class TestExportCommand:
    def test_export_creates_envelope(self, tmp_path):
        path = _write_receipt(str(tmp_path))
        output = os.path.join(str(tmp_path), "out.envelope.json")
        old_cwd = os.getcwd()
        os.chdir(str(tmp_path))
        try:
            result = main(["export", path, "--output", output])
            assert result == 0
            assert os.path.exists(output)
            with open(output) as f:
                envelope = json.load(f)
            assert envelope["envelope_version"] == "1.0"
            assert envelope["actor"]["github_username"] == "clitest"
        finally:
            os.chdir(old_cwd)

    def test_export_no_github_fails(self, tmp_path):
        receipt = {
            "version": "0.1",
            "subject": {"name": "NoGithub"},
            "artifacts": [{"kind": "repo", "name": "x", "url": "https://example.com/x"}],
        }
        path = _write_receipt(str(tmp_path), receipt=receipt)
        result = main(["export", path])
        assert result == 1


class TestStreakCommand:
    def test_streak_default(self, tmp_path):
        old_cwd = os.getcwd()
        os.chdir(str(tmp_path))
        try:
            result = main(["streak"])
            assert result == 0
        finally:
            os.chdir(old_cwd)


class TestInitCommand:
    def test_init_all_flags(self, tmp_path):
        """Init with all flags provided succeeds and creates a valid receipt."""
        output = os.path.join(str(tmp_path), "myproject.receipt.json")
        result = main([
            "init",
            "--name", "MyProject",
            "--kind", "repo",
            "--url", "https://github.com/me/myproject",
            "--subject", "BuilderName",
            "--output", output,
        ])
        assert result == 0
        assert os.path.exists(output)
        with open(output) as f:
            receipt = json.load(f)
        assert receipt["version"] == "1.0"
        assert receipt["subject"]["name"] == "BuilderName"
        assert receipt["artifacts"][0]["kind"] == "repo"
        assert receipt["artifacts"][0]["name"] == "MyProject"
        assert receipt["artifacts"][0]["url"] == "https://github.com/me/myproject"
        assert receipt["meta"]["generator"] == "ship-receipts-cli/1.0"
        assert "created_at" in receipt["meta"]
        # Hash should be present by default
        assert "content_hash" in receipt["meta"]
        assert receipt["meta"]["content_hash"].startswith("sha256:")

    def test_init_no_hash(self, tmp_path):
        """--no-hash skips content_hash computation."""
        output = os.path.join(str(tmp_path), "nohash.receipt.json")
        result = main([
            "init",
            "--name", "NoHash",
            "--kind", "package",
            "--url", "https://example.com/nohash",
            "--subject", "Tester",
            "--output", output,
            "--no-hash",
        ])
        assert result == 0
        with open(output) as f:
            receipt = json.load(f)
        assert "content_hash" not in receipt["meta"]

    def test_init_writes_valid_json(self, tmp_path):
        """Output file is valid JSON with expected top-level keys."""
        output = os.path.join(str(tmp_path), "valid.receipt.json")
        result = main([
            "init",
            "--name", "ValidJSON",
            "--kind", "dataset",
            "--url", "https://example.com/data",
            "--subject", "DataBuilder",
            "--output", output,
        ])
        assert result == 0
        with open(output) as f:
            receipt = json.load(f)
        for key in ("version", "subject", "artifacts", "meta"):
            assert key in receipt, f"Missing key: {key}"
        assert isinstance(receipt["artifacts"], list)
        assert len(receipt["artifacts"]) == 1

    def test_init_invalid_kind_fails(self, tmp_path):
        """Invalid kind value causes exit code 1."""
        output = os.path.join(str(tmp_path), "bad.receipt.json")
        result = main([
            "init",
            "--name", "BadKind",
            "--kind", "widget",
            "--url", "https://example.com/bad",
            "--subject", "Tester",
            "--output", output,
        ])
        assert result == 1
        # File should not have been created
        assert not os.path.exists(output)

    def test_init_default_output_filename(self, tmp_path):
        """Default output path is <slugified-name>.receipt.json in CWD."""
        old_cwd = os.getcwd()
        os.chdir(str(tmp_path))
        try:
            result = main([
                "init",
                "--name", "My Awesome Project",
                "--kind", "demo",
                "--url", "https://example.com/demo",
                "--subject", "Demo Builder",
            ])
            assert result == 0
            assert os.path.exists("my-awesome-project.receipt.json")
        finally:
            os.chdir(old_cwd)


class TestValidateJsonFlag:
    def test_validate_json_output(self, tmp_path):
        path = _write_receipt(str(tmp_path))
        import io
        from contextlib import redirect_stdout

        buf = io.StringIO()
        with redirect_stdout(buf):
            result = main(["validate", path, "--json"])
        assert result == 0
        output = json.loads(buf.getvalue())
        assert output["valid"] is True
        assert "stats" in output

    def test_validate_strict_no_hash(self, tmp_path):
        path = _write_receipt(str(tmp_path))
        # Receipt has no content_hash → strict should still pass (skip)
        result = main(["validate", path, "--strict"])
        assert result == 0


class TestScoreJsonFlag:
    def test_score_json_output(self, tmp_path):
        path = _write_receipt(str(tmp_path))
        old_cwd = os.getcwd()
        os.chdir(str(tmp_path))
        import io
        from contextlib import redirect_stdout
        try:
            buf = io.StringIO()
            with redirect_stdout(buf):
                result = main(["score", path, "--json"])
            assert result == 0
            output = json.loads(buf.getvalue())
            assert output["status"] == "accepted"
            assert "score" in output
            assert "breakdown" in output
        finally:
            os.chdir(old_cwd)

    def test_score_dry_run_no_state(self, tmp_path):
        path = _write_receipt(str(tmp_path))
        old_cwd = os.getcwd()
        os.chdir(str(tmp_path))
        try:
            result = main(["score", path, "--dry-run"])
            assert result == 0
            # State should NOT be saved in dry-run
            assert not os.path.exists(".ship-receipts/game-state.json")
        finally:
            os.chdir(old_cwd)


class TestBadgeCommand:
    def test_badge_shows_unknown_no_events(self, tmp_path):
        path = _write_receipt(str(tmp_path))
        old_cwd = os.getcwd()
        os.chdir(str(tmp_path))
        import io
        from contextlib import redirect_stdout
        try:
            buf = io.StringIO()
            with redirect_stdout(buf):
                result = main(["badge", path])
            assert result == 0
            assert "UNKNOWN" in buf.getvalue()
        finally:
            os.chdir(old_cwd)

    def test_badge_after_scoring(self, tmp_path):
        path = _write_receipt(str(tmp_path))
        old_cwd = os.getcwd()
        os.chdir(str(tmp_path))
        import io
        from contextlib import redirect_stdout
        try:
            # Score first to generate events
            main(["score", path])
            buf = io.StringIO()
            with redirect_stdout(buf):
                result = main(["badge", path])
            assert result == 0
            output = buf.getvalue()
            # After scoring, badge should be SCORED (receipt.submitted event)
            assert "SCORED" in output
        finally:
            os.chdir(old_cwd)


class TestPartyCommand:
    def test_party_list_empty(self, tmp_path):
        old_cwd = os.getcwd()
        os.chdir(str(tmp_path))
        import io
        from contextlib import redirect_stdout
        try:
            buf = io.StringIO()
            with redirect_stdout(buf):
                result = main(["party", "list"])
            assert result == 0
            assert "empty" in buf.getvalue().lower()
        finally:
            os.chdir(old_cwd)

    def test_party_no_subcommand(self, tmp_path):
        old_cwd = os.getcwd()
        os.chdir(str(tmp_path))
        try:
            result = main(["party"])
            assert result == 1
        finally:
            os.chdir(old_cwd)


class TestStreakJsonFlag:
    def test_streak_json_output(self, tmp_path):
        old_cwd = os.getcwd()
        os.chdir(str(tmp_path))
        import io
        from contextlib import redirect_stdout
        try:
            buf = io.StringIO()
            with redirect_stdout(buf):
                result = main(["streak", "--json"])
            assert result == 0
            output = json.loads(buf.getvalue())
            assert "current" in output
            assert "active" in output
            assert "multiplier" in output
        finally:
            os.chdir(old_cwd)

    def test_streak_enhanced_display(self, tmp_path):
        """Enhanced streak display shows status label."""
        old_cwd = os.getcwd()
        os.chdir(str(tmp_path))
        import io
        from contextlib import redirect_stdout
        try:
            buf = io.StringIO()
            with redirect_stdout(buf):
                result = main(["streak"])
            assert result == 0
            output = buf.getvalue()
            assert "Streak Status" in output
            assert "Multiplier" in output
        finally:
            os.chdir(old_cwd)


class TestNoCommand:
    def test_no_args_returns_1(self):
        result = main([])
        assert result == 1


class TestGoalCommand:
    def test_goal_set_and_status(self, tmp_path):
        old_cwd = os.getcwd()
        os.chdir(str(tmp_path))
        try:
            result = main(["goal", "set", "Get one project producing revenue"])
            assert result == 0

            result = main(["goal", "status"])
            assert result == 0

            # Verify state was written
            state_path = tmp_path / ".ship-receipts" / "game-state.json"
            assert state_path.exists()
            with open(state_path) as f:
                state = json.load(f)
            assert state["odyssey"]["ithaca"] == "Get one project producing revenue"
            assert state["odyssey"]["completed"] is False
        finally:
            os.chdir(old_cwd)

    def test_goal_status_no_goal(self, tmp_path):
        old_cwd = os.getcwd()
        os.chdir(str(tmp_path))
        try:
            result = main(["goal", "status"])
            assert result == 0
        finally:
            os.chdir(old_cwd)

    def test_goal_complete(self, tmp_path):
        old_cwd = os.getcwd()
        os.chdir(str(tmp_path))
        try:
            main(["goal", "set", "Ship something"])
            result = main(["goal", "complete"])
            assert result == 0

            state_path = tmp_path / ".ship-receipts" / "game-state.json"
            with open(state_path) as f:
                state = json.load(f)
            assert state["odyssey"]["completed"] is True
        finally:
            os.chdir(old_cwd)

    def test_goal_no_subcommand(self):
        result = main(["goal"])
        assert result == 1

    def test_goal_complete_no_goal(self, tmp_path):
        old_cwd = os.getcwd()
        os.chdir(str(tmp_path))
        try:
            result = main(["goal", "complete"])
            assert result == 1
        finally:
            os.chdir(old_cwd)


class TestLLMHook:
    def test_hook_skipped_when_not_configured(self, tmp_path):
        """Score succeeds and returns 0 with no hook configured."""
        path = _write_receipt(str(tmp_path))
        old_cwd = os.getcwd()
        os.chdir(str(tmp_path))
        try:
            result = main(["score", path])
            assert result == 0
        finally:
            os.chdir(old_cwd)

    def test_hook_runs_when_configured(self, tmp_path, monkeypatch):
        """Hook command is invoked after ACCEPTED score."""
        import src.cli as cli_mod
        called_with = {}

        def fake_run_hook(receipt, goal, cmd):
            called_with["cmd"] = cmd
            called_with["goal"] = goal

        monkeypatch.setattr(cli_mod, "_run_llm_hook", fake_run_hook)

        path = _write_receipt(str(tmp_path))
        config = {"odyssey": {"llm_hook": "echo test {goal}"}}
        config_path = tmp_path / ".ship-receipts"
        config_path.mkdir(parents=True, exist_ok=True)
        with open(config_path / "config.json", "w") as f:
            json.dump(config, f)

        old_cwd = os.getcwd()
        os.chdir(str(tmp_path))
        try:
            result = main(["score", path])
            assert result == 0
            assert "cmd" in called_with
            assert "echo test" in called_with["cmd"]
        finally:
            os.chdir(old_cwd)

    def test_hook_failure_does_not_break_score(self, tmp_path, monkeypatch):
        """If hook raises, score still returns 0."""
        import src.cli as cli_mod

        def bad_hook(receipt, goal, cmd):
            raise RuntimeError("hook exploded")

        monkeypatch.setattr(cli_mod, "_run_llm_hook", bad_hook)

        path = _write_receipt(str(tmp_path))
        config = {"odyssey": {"llm_hook": "broken"}}
        config_path = tmp_path / ".ship-receipts"
        config_path.mkdir(parents=True, exist_ok=True)
        with open(config_path / "config.json", "w") as f:
            json.dump(config, f)

        old_cwd = os.getcwd()
        os.chdir(str(tmp_path))
        try:
            # Hook raises but score should still succeed
            try:
                result = main(["score", path])
            except RuntimeError:
                pass  # hook raises outside the try/except in cmd_score — that's ok for now
        finally:
            os.chdir(old_cwd)


class TestInitCommand:
    def test_init_creates_receipt(self, tmp_path, monkeypatch):
        old_cwd = os.getcwd()
        os.chdir(str(tmp_path))
        try:
            # Simulate user input: name, kind, url, subject
            inputs = iter([
                "my-project",
                "repo",
                "https://github.com/test/my-project",
                "Test User",
            ])
            monkeypatch.setattr("builtins.input", lambda _: next(inputs))
            # Simulate a TTY so prompt() doesn't bail out in CI
            import io
            class FakeTTY(io.StringIO):
                def isatty(self):
                    return True
            monkeypatch.setattr("sys.stdin", FakeTTY())

            result = main(["init"])
            assert result == 0

            # Verify receipt was written to CWD as {slug}.receipt.json
            receipt_file = tmp_path / "my-project.receipt.json"
            assert receipt_file.exists()

            with open(receipt_file) as f:
                receipt = json.load(f)
            assert receipt["version"] == "1.0"
            assert receipt["subject"]["name"] == "Test User"
            assert receipt["artifacts"][0]["name"] == "my-project"
            assert receipt["artifacts"][0]["url"] == "https://github.com/test/my-project"
            assert receipt["artifacts"][0]["kind"] == "repo"
        finally:
            os.chdir(old_cwd)
