# AGENTS.md

This repo is designed to be worked on with AI assistance.

## What this repo is
A schema + examples for "ship receipts": provenance for what shipped and why.

---

## Agent Model

| Agent | Scope | Merges? |
|-------|-------|---------|
| Rowan (Claude, Mac Mini) | Orchestrator — reviews PRs, merges to main, coordinates work across agents | Yes — merges all PRs by default |
| Codex (OpenAI) | Picks up labeled GitHub issues, works in permanent worktrees, pushes to origin | No — opens PRs only |
| BLD (Claude, Windows/GPU) | GPU-accelerated work, research queries, bulk processing | No — opens PRs only |

---

## Branch Discipline

- `main` — stable, Rowan merges only
- `develop` — integration target for PRs
- Agent branches: `codex/<issue>-<slug>`, `rowan/<slug>`, `bld/<slug>`
- All work must be pushed to origin. No local-only branches.

**Before writing any code**, confirm your branch:

```bash
git status   # must show your assigned branch, NOT develop or main
```

If you are on `develop` or `main`, stop and recover first:

```bash
git stash
git checkout <your-assigned-branch>
git stash pop
```

---

## Codex Rules

1. Work in a permanent worktree — never the main checkout.
2. Do NOT install software, download models, or add dependencies without explicit approval.
3. Push everything to origin.
4. Target `develop` for PRs, not `main`.
5. Never close PRs — Rowan reviews and merges.
6. Only work on the assigned issue. Do not freelance.
7. Read this file and CLAUDE.md before starting any work.

---

## Merge Policy

- Rowan merges by default.
- Codex never merges.
- Never force-push to `develop` or `main`.
- Every PR needs `Closes #N` linking it to the issue.

---

## Ground Rules

- Keep schema changes backwards-aware; prefer additive changes.
- Keep examples clean-room and runnable.
- If you reference a repo file in markdown, link it.
- Reference upstream files rather than duplicating content.
- Run tests before pushing (`npm test` after TS port).

---

## Verification

- If you change the schema, update:
  - the schema file(s)
  - any examples
  - README references

---

## PR Completion Signal

When your PR is ready for Rowan to review and merge, add the `ready-for-review` label:

```bash
gh pr edit <PR_NUMBER> --add-label "ready-for-review"
```

This is how Rowan knows your work is done. Do NOT merge — Rowan merges.

---

## Queue Scope

When working inside this repo's mounted worktree, "the queue" means only:
- the issue implied by the current branch, if the branch is named `codex/<issue>-<slug>`
- this repo's open GitHub issues labeled `Codex`

Do not inspect or act on Rowan/global queue items or on other repositories unless the user explicitly instructs you to switch repos.

If no repo-local Codex issue exists, report that the repo-local queue is empty and stop.

## Queue Resolution Order

Before starting new work, resolve scope in this order:
1. Current branch assignment
2. Open PR already associated with the current branch or issue
3. Open issues in this repo labeled `Codex`
4. Otherwise: stop and report no repo-local Codex work

## Duplicate Work Guard

Before creating a branch, commit, or PR:
- check for open PRs in this repo
- check for open issues in this repo labeled `Codex`
- check whether the current branch already corresponds to the active issue

If an open PR already exists for the issue, do not create another PR unless the user explicitly asks.
If another Codex branch or PR already exists for the same issue, stop and report the overlap.

## Worktree Boundary

A mounted permanent worktree is a hard project boundary.
Do not leave this repo to work in another repo because another queue appears non-empty.
Do not reinterpret "the queue" as org-wide or global when a repo worktree is mounted.
A permanent worktree implies one repo, one branch, one issue unless the user explicitly says otherwise.

## Incremental Checkpointing (CRITICAL — rate limits are real)

Codex sessions will be cut off by rate limits mid-task. Treat every session as potentially
interrupted at any moment. Checkpoint early and often so a fresh session can continue cleanly.

**Disk checkpoint — after every logical step:**
- `git add -A && git commit -m "wip: <what was just completed>"` on the working branch
- Push: `git push origin <branch>`
- Never accumulate more than one logical step of uncommitted work

**GitHub checkpoint — after every significant milestone:**
Post a progress comment on the issue:
```
gh issue comment <N> --repo Pro777/<repo> --body "## Progress checkpoint
**Done:** <what was completed>
**Next:** <what remains>
**Branch:** <branch-name> @ <short-sha>"
```

**Resumption rule (for the next session):**
When starting work on an issue, check for a prior progress comment before doing anything else.
If one exists, read it, check out the branch, and continue from where it left off.
Do not restart from scratch.

## Communication

If the user asks for "the queue" and scope is ambiguous, prefer the repo-local interpretation and state that assumption briefly.
If the repo-local queue is empty, say so explicitly.
If continuing would require changing repos or leaving the current branch assignment, ask first.

# --- BEGIN ROWAN BOILERPLATE (auto-stamped, do not edit) ---
# Managed by rowan/bin/sync-agents. Edit the source at docs/llm/templates/agents-md-template.md.

## License Policy

- Never introduce MIT, ISC, BSD, or GPL licenses. Private repos use Proprietary; public repos use Apache 2.0.

## Queue Scope

When working inside this repo's mounted worktree, "the queue" means only:
- the issue implied by the current branch, if the branch is named `codex/<issue>-<slug>`
- this repo's open GitHub issues labeled `Codex`

Do not inspect or act on Rowan/global queue items or on other repositories unless the user explicitly instructs you to switch repos.

If no repo-local Codex issue exists, report that the repo-local queue is empty and stop.

## Queue Resolution Order

Before starting new work, resolve scope in this order:
1. Current branch assignment
2. Open PR already associated with the current branch or issue
3. Open issues in this repo labeled `Codex`
4. Otherwise: stop and report no repo-local Codex work

## Duplicate Work Guard

Before creating a branch, commit, or PR:
- check for open PRs in this repo
- check for open issues in this repo labeled `Codex`
- check whether the current branch already corresponds to the active issue

If an open PR already exists for the issue, do not create another PR unless the user explicitly asks.
If another Codex branch or PR already exists for the same issue, stop and report the overlap.

## Worktree Boundary

A mounted permanent worktree is a hard project boundary.
Do not leave this repo to work in another repo because another queue appears non-empty.
Do not reinterpret "the queue" as org-wide or global when a repo worktree is mounted.
A permanent worktree implies one repo, one branch, one issue unless the user explicitly says otherwise.

## PR Discipline

- **PRs must merge or die.** A PR that sits open is waste — it diverges, conflicts, and the work rots. If you open a PR, drive it to merge in the same session. If it can't merge (blocked, needs review), say so explicitly. Never open a PR and move on.

## Label Lifecycle

- Add `in-progress` label when you pick up an issue.
- Remove `in-progress` label when you add `ready-for-review`. Do not wait for Rowan to do this — leaving it on blocks the watchdog from dispatching the next issue.
- Close the issue after the PR is merged.

## Communication

If the user asks for "the queue" and scope is ambiguous, prefer the repo-local interpretation and state that assumption briefly.
If the repo-local queue is empty, say so explicitly.
If continuing would require changing repos or leaving the current branch assignment, ask first.

# --- END ROWAN BOILERPLATE ---
