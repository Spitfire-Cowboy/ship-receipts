"""
Tests for party mode.

Spec: docs/game-mode/build-order-for-campion-v1.md (Slice 8)
"""

import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from src.party import (
    add_to_party,
    create_snapshot,
    derive_class,
    remove_from_party,
)


class TestDeriveClass:
    def test_rookie(self):
        assert derive_class(0, 0) == "ROOKIE"

    def test_builder_by_repos(self):
        assert derive_class(5, 0) == "BUILDER"

    def test_builder_by_stars(self):
        assert derive_class(0, 50) == "BUILDER"

    def test_architect_by_repos(self):
        assert derive_class(20, 0) == "ARCHITECT"

    def test_architect_by_stars(self):
        assert derive_class(0, 500) == "ARCHITECT"

    def test_veteran_by_repos(self):
        assert derive_class(50, 0) == "VETERAN"

    def test_veteran_by_stars(self):
        assert derive_class(0, 5_000) == "VETERAN"

    def test_legendary_by_repos(self):
        assert derive_class(100, 0) == "LEGENDARY"

    def test_legendary_by_stars(self):
        assert derive_class(0, 50_000) == "LEGENDARY"

    def test_boundary_below_builder(self):
        assert derive_class(4, 49) == "ROOKIE"

    def test_highest_tier_wins(self):
        assert derive_class(100, 50_000) == "LEGENDARY"


class TestCreateSnapshot:
    def _fake_profile(self, **overrides):
        profile = {
            "login": "testuser",
            "name": "Test User",
            "avatar_url": "https://avatars.githubusercontent.com/u/1",
            "public_repos": 25,
            "followers": 100,
            "created_at": "2020-01-15T00:00:00Z",
        }
        profile.update(overrides)
        return profile

    def test_basic_snapshot(self):
        snap = create_snapshot(self._fake_profile())
        assert snap["username"] == "testuser"
        assert snap["display_name"] == "Test User"
        assert snap["public_repos"] == 25
        assert snap["stars"] == 100  # followers as proxy
        assert snap["class"] == "ARCHITECT"  # 25 repos >= 20
        assert snap["created_at"] == "2020-01-15"
        assert snap["score"] == 0
        assert snap["receipts"] == 0
        assert snap["streak"] == 0

    def test_missing_name_falls_back_to_login(self):
        snap = create_snapshot(self._fake_profile(name=None))
        assert snap["display_name"] == "testuser"

    def test_snapshot_date_is_today(self):
        from datetime import date
        snap = create_snapshot(self._fake_profile())
        assert snap["snapshot_date"] == date.today().isoformat()


class TestAddToParty:
    def test_add_to_empty_party(self):
        state = {}
        snap = {"username": "alice", "class": "BUILDER"}
        add_to_party(state, snap)
        assert len(state["party"]) == 1
        assert state["party"][0]["username"] == "alice"

    def test_add_replaces_existing(self):
        state = {"party": [{"username": "alice", "class": "ROOKIE"}]}
        snap = {"username": "alice", "class": "BUILDER"}
        add_to_party(state, snap)
        assert len(state["party"]) == 1
        assert state["party"][0]["class"] == "BUILDER"

    def test_add_multiple_users(self):
        state = {}
        add_to_party(state, {"username": "alice", "class": "BUILDER"})
        add_to_party(state, {"username": "bob", "class": "ROOKIE"})
        assert len(state["party"]) == 2


class TestRemoveFromParty:
    def test_remove_existing(self):
        state = {"party": [{"username": "alice"}, {"username": "bob"}]}
        assert remove_from_party(state, "alice") is True
        assert len(state["party"]) == 1
        assert state["party"][0]["username"] == "bob"

    def test_remove_nonexistent(self):
        state = {"party": [{"username": "alice"}]}
        assert remove_from_party(state, "nobody") is False
        assert len(state["party"]) == 1

    def test_remove_from_empty(self):
        state = {"party": []}
        assert remove_from_party(state, "alice") is False
