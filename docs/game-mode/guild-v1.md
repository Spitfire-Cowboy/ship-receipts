# Game Mode: Guild

**Status:** SPEC
**Closes:** #51

---

## Summary

Guild is a multiplayer mode built on shared accountability rather than competition. A group of 2–8 people declares a shared milestone. Social proof comes from co-commitment, not comparison.

---

## Philosophy

The conventional multiplayer mechanic is a leaderboard. Leaderboards produce social anxiety, comparison spirals, and strategic sandbagging. Guild mode uses a different mechanism: the group commits to a shared milestone, and each person's receipts are visible to the group as evidence that the commitment is real.

There is no ranking. There is only: did the group reach the milestone together?

---

## Mechanics

### Creating a guild
```
ship-receipts guild create --name "Q1 launch crew" --milestone "Ship the beta" --deadline "2026-04-01"
```

- Guild has a name, a shared milestone text, and a deadline
- Invite by sharing a guild code or GitHub usernames
- Target group size: 2–8 (enforced maximum: accountability degrades above 8)

### Joining
```
ship-receipts guild join --code <code>
```

### Submitting in a guild context
- Normal `ship-receipts score` command continues to work
- If a guild is active, the scored receipt is also submitted to the shared guild ledger
- No special guild receipt format required — existing receipts work

### Visibility
- Guild ledger is the list of receipts each member has submitted toward the milestone
- Hosted on proofofship when the member opts in to public export
- Private by default (guild members only)
- No individual scores shown — only whether each member has shipped

### Milestone close
- At deadline: guild ledger is snapshotted
- Each member who shipped at least one receipt during the guild period receives the milestone completion mark on their proofofship profile
- Group result: the milestone is marked complete if a quorum of members (>50%) shipped
- No penalty for individuals who did not ship — the group result is separate from individual scoring

---

## Storage

Guild state stored in `.ship-receipts/guild.json`:
```json
{
  "active": true,
  "name": "Q1 launch crew",
  "milestone": "Ship the beta",
  "deadline": "2026-04-01T00:00:00Z",
  "members": ["alice", "bob", "carol"],
  "receipts": [
    {"member": "alice", "receipt_hash": "abc123", "submitted_at": "2026-03-21T10:00:00Z"}
  ]
}
```

---

## Integration

- Guild ledger exports to proofofship as a group signal
- Each member's individual score remains on their own account
- The guild milestone appears as a group badge on the proofofship public profile

---

## Constraints

- Maximum 8 members
- One active guild at a time per user
- Guild deadline is immutable after creation
