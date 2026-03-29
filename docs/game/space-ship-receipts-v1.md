# Space-Ship Receipts v1 (Design Spec)

Status: Draft for implementation  
Owner: Game Mode / CLI  
Scope: v1 progression + scoring loop

## 1) Core Thesis

**Real software artifacts are the game.**

Progress is earned from actual repo activity (commits, PR lifecycle, tests, merges), and continues to accrue even when the game CLI is closed. The CLI is a viewer/controller on top of an event log, not the source of truth.

> Product message: **Build > Click**

---

## 2) Loop Summary

- Player connects a repo.
- Background collector ingests software events into an append-only event log.
- Scoring engine replays events into a deterministic progression state.
- CLI (`watch`, `snapshot`, `score`) renders current state and deltas.
- Optional manual `Y` key gives tiny fallback progress but is intentionally weak.

---

## 3) Event-Sourced Progression Model

## 3.1 Canonical event types (v1)

- `commit.recorded`
- `pr.opened`
- `pr.reviewed` (approved / changes_requested / commented)
- `pr.updated` (new commits pushed to PR)
- `ci.completed` (pass/fail)
- `pr.merged`

## 3.2 Event envelope

```json
{
  "event_id": "evt_01J...", 
  "event_type": "pr.merged",
  "repo_id": "org/repo",
  "actor_id": "user_123",
  "artifact_id": "pr#482",
  "occurred_at": "2026-02-26T11:01:22Z",
  "ingested_at": "2026-02-26T11:01:30Z",
  "payload": {"branch": "feature/x", "base": "main"},
  "source": "github",
  "source_event_id": "GH_DELIVERY_GUID"
}
```

## 3.3 Replay rule

- Sort by `(occurred_at, event_id)`; `event_id` is tie-breaker.
- Apply pure reducer `state_{n+1} = reduce(state_n, event_n)`.
- Idempotency: duplicate `source+source_event_id` ignored.
- Determinism: same log => same score/progression.

---

## 4) Scoring & Balancing

## 4.1 Score units

Use a single numeric currency: **Stellar Credits (SC)**.

## 4.2 Base rewards table (explicit balance)

| Action | Event | Base SC | Notes |
|---|---|---:|---|
| Manual tap (`Y`) | `manual.tap` | 0.05 | Available anytime; hard-capped per minute |
| Commit (eligible) | `commit.recorded` | 2.0 | Scales by quality multipliers |
| PR opened | `pr.opened` | 6.0 | One-time per PR |
| PR reviewed (approved) | `pr.reviewed` | 3.0 | Reviewer credit |
| CI pass | `ci.completed(pass)` | 4.0 | Per workflow run, anti-spam gated |
| CI fail | `ci.completed(fail)` | 0.5 | Minimal learning credit |
| PR merged | `pr.merged` | 18.0 | Largest v1 payout |

### Balance target

- **1 meaningful commit ≈ 40 manual taps** (2.0 vs 40×0.05).
- **1 merge ≈ 360 manual taps**.
- Manual input keeps idle users engaged, but cannot compete with shipping code.

## 4.3 Multipliers (real events only)

Apply to eligible `commit.recorded` and/or `pr.merged`:

- `files_changed` multiplier: +0% to +50% (capped).
- `lines_changed` multiplier: +0% to +40% (soft cap, sigmoid/step).
- `test_passed_on_pr` bonus: +20% on merge reward.
- `consecutive_ship_streak` bonus: +5% each day, max +25%.

Manual `Y` taps never receive multipliers.

---

## 5) Anti-Cheat / Anti-Spam Guardrails

## 5.1 Commit quality gate

A commit is **eligible** only if all are true:

- touches >= 2 files **or** >= 20 changed lines,
- message length >= 8 chars and not in denylist (`"wip"`, `"tmp"`, etc.),
- not a pure rename-only commit,
- not reverted within 30 minutes (or reward clawed back).

Non-eligible commits earn 0.2 SC max (token credit), no multipliers.

## 5.2 Diminishing returns window

Per-author rolling 15-minute window for `commit.recorded`:

- first 3 eligible commits: 100% reward,
- commits 4-6: 40%,
- 7+: 10%.

## 5.3 PR spam controls

- `pr.opened` only pays once if PR survives > 10 minutes.
- Close-without-merge in < 10 minutes => reward revoked.
- `pr.updated` has no direct SC reward (used only for telemetry/progression flavor).

## 5.4 CI spam controls

- Max 2 rewarded CI completions per PR per hour.
- Identical reruns with same SHA + same result within 20 minutes => no reward.

## 5.5 Manual keypress throttle (`Y`)

- Max 30 rewarded taps/minute.
- Beyond cap: accepted input, 0 SC (display “tap efficiency exhausted”).
- Daily cap: 600 rewarded taps/day (max 30 SC/day).

---

## 6) CLI UX (v1)

## 6.1 Commands

- `ship-receipts watch`
  - Live feed of ingested events + SC deltas.
  - Shows “CLI can close safely; progression continues in background.”

- `ship-receipts snapshot`
  - One-shot current state: total SC, level, streak, last processed event, pending ingestion lag.

- `ship-receipts score`
  - Score breakdown by source:
    - Manual SC (today / lifetime)
    - Artifact SC (commits/PR/CI/merges)
    - Multipliers and anti-spam deductions

## 6.2 Interaction copy

- On startup banner: **“Build > Click: real repo activity is your engine.”**
- On `Y` tap feedback: `+0.05 SC (manual boost; ship code for big gains)`
- On caps hit: `Manual boost capped. Push real artifacts to progress faster.`

---

## 7) State Model & Checkpointing

## 7.1 Reducer state (v1)

```json
{
  "version": 1,
  "repo_id": "org/repo",
  "total_sc": 1324.75,
  "level": 7,
  "streak_days": 3,
  "manual": {
    "today_taps_rewarded": 188,
    "today_sc": 9.4,
    "lifetime_taps_rewarded": 8420
  },
  "artifact_counters": {
    "eligible_commits": 142,
    "merged_prs": 28,
    "ci_passes_rewarded": 77
  },
  "anti_spam": {
    "commit_window": {"count": 2, "window_start": "2026-02-26T11:00:00Z"},
    "ci_reward_buckets": {"pr#482": {"hour": "2026-02-26T11", "count": 1}}
  },
  "last_event": {
    "occurred_at": "2026-02-26T11:01:22Z",
    "event_id": "evt_01J..."
  }
}
```

## 7.2 Checkpoint format

- Persist checkpoint every N events (default 100) or every 30s.
- File/row shape:

```json
{
  "checkpoint_id": "chk_01J...",
  "repo_id": "org/repo",
  "state_version": 1,
  "last_event_id": "evt_01J...",
  "last_occurred_at": "2026-02-26T11:01:22Z",
  "state_blob": {"...reducer_state...": true},
  "created_at": "2026-02-26T11:01:30Z"
}
```

## 7.3 Replay logic

1. Load latest checkpoint for repo.
2. Read events where `(occurred_at,event_id)` > checkpoint cursor.
3. Reduce sequentially.
4. Persist new checkpoint + derived score projection.
5. `snapshot/score` read from latest materialized state.

Recovery: if materialized state corrupt/missing, full replay from genesis log is valid.

---

## 8) Implementation Notes (v1-ready)

- Keep scoring rules config-driven (`scoring.yml`) so balance changes are data-only.
- Store all reward decisions with reason codes (`eligible`, `spam_penalty`, `cap_reached`) for explainability.
- Treat manual taps as local events (`manual.tap`) written into same event log for replay consistency.
- Start with per-repo single-writer reducer to avoid concurrency complexity in v1.

---

## 9) Acceptance Criteria

- Closing CLI does not stop progression from incoming repo events.
- Replaying same event stream reproduces identical `total_sc`.
- Manual-only play is possible but >10x slower than normal artifact flow.
- Spam scenarios (tiny commits, CI reruns, PR churn) yield sharply reduced SC.
- `watch/snapshot/score` clearly communicate **Build > Click**.
