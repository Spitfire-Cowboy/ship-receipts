# Ship Receipts + Proof of Ship

## The short version

Ship-receipts is a game about proving you did the work. Not performing productivity — actually shipping things and collecting the receipts. It runs locally, scores your proof depth, and tracks your streaks. It's a single-player game and it's supposed to be fun.

Proofofship is the optional multiplayer layer. When you want your receipts to count publicly, you export them to proofofship, which independently verifies everything against the GitHub API and publishes a reputation score. Proofofship is the auditor. Ship-receipts is the game.

## Why this exists

AI slop is flooding GitHub. Volume is noise. "I built this" means nothing without evidence.

But here's the part nobody's saying: AI can also make your real life better. An AI that reminds you to go for a walk with your kids, or notices you haven't touched your declared goal in four days and nudges you — that's not replacing human effort. That's encouraging human presence. We want to flip the script on what AI-assisted productivity looks like.

Ship-receipts is a game for humans. AI doesn't play it for you. Video games are made for humans to have fun. This one rewards you for doing real work in the real world.

## The two pieces

**Ship-receipts** is free, open-source, local-only. JSON schema + CLI. You create a receipt for something you shipped — a repo, a release, a walk, a talk — and attach proof: a commit SHA, a checksum, a CI link, a command someone could run to verify it. The CLI validates and scores it. Streaks reward consistency. All state is a JSON file on your machine. No server, no accounts, no telemetry.

You can cheat in single player. We don't care. There are legitimate reasons to cheat in single-player games — maybe you don't want to click a button a trillion times to see where the game goes. The game is yours. Have fun with it.

**Proofofship** is the global layer. It takes proof envelopes from ship-receipts, re-verifies everything independently, and publishes a reputation score. This is where anti-gaming matters — you can't cheat the auditor. Proofofship checks that commits exist, repos are public, and you have push access. Signed commits score higher. Independent attestation scores highest. All data is public. Anyone can recompute any score.

Ship-receipts is the cash register. Proofofship is the credit bureau.

## The game: your Odyssey

The framing is the Odyssey, but not as decoration. The game loop IS the hero's journey.

You declare your own Ithaca — a single, concrete, self-selected goal. Not something assigned to you. Something you chose. "Get one project producing revenue." "Ship a public repo." "Give a conference talk." "Lose 50 pounds." The goal is only meaningful because you chose it. That's what makes it a hero's journey and not a chore list.

Daily receipts are waypoints on the journey. The streak system makes it habitual. The scoring makes it honest. Small milestones mark your progress: your first receipt (you left the shore), your first week-long streak (you found your rhythm), your first attestation from someone else (you're not sailing alone).

An optional LLM hook lets you wire up Claude, Codex, or a local model as a compass — not a player. The LLM sees your Ithaca and your daily receipt and tells you whether you're still sailing toward your goal or drifting. It might say "you haven't touched the repo in four days — maybe take a walk and think about why." It might say "this commit is cleanup, not progress — are you avoiding the hard part?" It might say "writing specs doesn't produce revenue — deploying the API does." It doesn't score for you. It doesn't play for you. It's the wise friend on the journey.

We're eating our own hardtack. The first player is the person building these tools. His Ithaca is getting one project to revenue — could be any of them. The receipts come from whichever project he touched today. The compass doesn't care which repo. It asks: "Did this bring you closer to someone paying for something you built?"

## How scoring works

**Local:** Each receipt earns base points from proof elements present.

| Proof element | Points |
|---|---|
| Subject name | 1 |
| Linked profiles | 2 |
| Timestamp | 1 |
| Valid content hash (SHA-256) | 3 |
| Immutable ref per artifact | 2 |
| Checksum per verify entry | 3 |
| CI link | 1 |
| Verification command | 2 |
| Attestation | 2 |

A solid receipt with real proof lands 13-19 base points. Multipliers stack for consistency: 3+ day streak = 1.25x, 7+ = 1.5x, 14+ = 1.75x, 30+ = 2.0x. Integrity bonus (valid hash + checksum): 1.5x.

`final_score = floor(base * streak_multiplier * integrity_multiplier)`

**Global:** Each verified receipt contributes `time_weight * verification_depth`. Verification depth ranges from 0.0 (failed) to 1.0 (independently attested). Time weight decays with a 90-day half-life — stop shipping and your score trends toward zero.

## What exists today

**Built and working:**
- Receipt schema (v0.1) and example files
- CLI: validate, score, export, streak
- Scoring engine with base points, multipliers, hash validation
- Streak tracking and game state management
- Proof envelope export (bridge to proofofship)
- Proofofship: envelope validator, append-only ledger, reputation aggregator
- 36 unit tests + 18 smoke checks passing on proofofship

**Spec'd but not built:**
- `init` command (interactive receipt creation)
- Party mode (add GitHub users as local benchmarks)
- Proofofship HTTP API and GitHub OAuth
- Live GitHub verification (currently stubbed)
- Public profile pages
- The Odyssey layer (Ithaca goal declaration, LLM hook, waypoints)

## Critical path to prototype

The fastest path to a playable game:

1. **`init` command** — so a human can create a receipt in under 2 minutes without editing JSON by hand
2. **Ithaca goal declaration** — `ship-receipts goal set "Ship ship-receipts v1.0"` stores your declared goal in game state
3. **LLM hook** — on each `score`, optionally pipe the receipt + goal to a user-configured command/endpoint, display the reflection in CLI output. This is what makes it a game with a narrative, not just a score counter.
4. **Deploy proofofship API** — FastAPI, GitHub OAuth, live verification. Makes the global layer real.
5. **Wire end-to-end** — `export` feeds `submit`, receipt gets verified, score appears at a public URL.
6. **Public profiles** — `/u/<handle>` pages.

Steps 1-3 make a playable single-player game. Steps 4-6 make the MMO layer real.

## Anti-gaming

In single player, there are no rules. It's your game.

In proofofship (the global layer), verification is strict:

1. **No proof, no reputation.** Receipts without verifiable artifacts contribute zero to global score.
2. **Invalid hash = untrusted.** If the content hash doesn't match, the entire receipt is rejected.
3. **Duplicates are idempotent.** Same hash = same entry. No double-counting.
4. **Private repos don't count.** If proofofship can't reach it via public API, verification depth is 0.0.
5. **Time decay is mandatory.** 90-day half-life. You can't coast on old work.
6. **Independent re-verification.** Proofofship never trusts local scores. Everything is checked again from scratch.
7. **Public auditability.** All inputs are public. Anyone can recompute any score. Gaming attempts are visible.
