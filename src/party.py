"""
Party mode for ship-receipts.

Add GitHub users to a "party" roster with character snapshots.
Spec: docs/game-mode/game-mode-foundation-v1.md

Note: Uses `followers` as a proxy for stars since GitHub's user API
doesn't return total stars. Getting true star totals requires
paginating all repos — a future enhancement.
"""

from __future__ import annotations

import json
import urllib.request
import urllib.error
from datetime import date
from urllib.parse import quote


def fetch_github_profile(username: str) -> dict | None:
    """
    Fetch a public GitHub profile. Returns dict on success, None on 404.
    Raises urllib.error.URLError on network errors.
    """
    url = f"https://api.github.com/users/{quote(username, safe='')}"
    req = urllib.request.Request(url, headers={"User-Agent": "ship-receipts-cli/1.0"})
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            return json.loads(resp.read().decode())
    except urllib.error.HTTPError as e:
        if e.code == 404:
            return None
        raise


def derive_class(public_repos: int, stars: int) -> str:
    """
    Derive character class from GitHub profile stats.
    Evaluated highest-to-lowest.
    """
    if public_repos >= 100 or stars >= 50_000:
        return "LEGENDARY"
    if public_repos >= 50 or stars >= 5_000:
        return "VETERAN"
    if public_repos >= 20 or stars >= 500:
        return "ARCHITECT"
    if public_repos >= 5 or stars >= 50:
        return "BUILDER"
    return "ROOKIE"


def create_snapshot(profile: dict) -> dict:
    """Transform a GitHub API user response into a character snapshot."""
    repos = profile.get("public_repos", 0)
    followers = profile.get("followers", 0)  # proxy for stars
    return {
        "username": profile.get("login", ""),
        "display_name": profile.get("name") or profile.get("login", ""),
        "avatar_url": profile.get("avatar_url", ""),
        "public_repos": repos,
        "stars": followers,  # followers as proxy
        "created_at": (profile.get("created_at") or "")[:10],
        "class": derive_class(repos, followers),
        "snapshot_date": date.today().isoformat(),
        "score": 0,
        "receipts": 0,
        "streak": 0,
    }


def add_to_party(state: dict, snapshot: dict) -> None:
    """Add or replace a user in the party roster."""
    party = state.setdefault("party", [])
    # Remove existing entry if re-adding
    state["party"] = [m for m in party if m.get("username") != snapshot["username"]]
    state["party"].append(snapshot)


def remove_from_party(state: dict, username: str) -> bool:
    """Remove a user from the party. Returns True if found and removed."""
    party = state.get("party", [])
    new_party = [m for m in party if m.get("username") != username]
    if len(new_party) == len(party):
        return False
    state["party"] = new_party
    return True
