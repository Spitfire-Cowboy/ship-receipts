# Ship-Receipts Private/Public Repo Split Plan

**Date:** 2026-02-26  
**Author:** OpenClaw Subagent  
**Status:** READY FOR EXECUTION

## 1) Objective

Split current `ship-receipts` into:

- **Private source-of-truth repo:** `ship-receipts-private` (full working docs, internal plans, experimental assets, unpublished integration details)
- **Public-facing repo output:** `ship-receipts` (clean export containing only intentionally public artifacts)

This plan prioritizes repeatability, low-risk migration, and simple governance.

---

## 2) Target Operating Model

### Private repo (`ship-receipts-private`)

Owns all authoring and decision-making.

Includes:
- Full docs tree (including private/internal strategy)
- Research notes and internal planning artifacts
- Tooling/scripts for export
- CI for private checks and public-export generation

### Public repo (`ship-receipts`)

Receives generated export only.

Includes:
- Public schemas
- Public examples
- Public README/docs
- Public changelog/release notes

Excludes:
- Internal strategy docs
- Private integration notes
- Any sensitive partner or operational details

---

## 3) Migration Plan (Phased)

### Phase A — Prepare and freeze

1. Announce migration window and temporary merge freeze.
2. Ensure current `develop` is green and tagged for rollback (`pre-split-YYYYMMDD`).
3. Create branch in current repo: `chore/repo-split-private-public`.

### Phase B — Rename current repo to private

1. Rename GitHub repository from `ship-receipts` → `ship-receipts-private`.
2. Keep visibility private.
3. Update local remote URLs to new private slug.
4. Confirm CI/webhooks/secrets still bound correctly.

### Phase C — Create new public repo shell

1. Create new repository named `ship-receipts` (public).
2. Add branch protections and required checks.
3. Add SECURITY/CODEOWNERS and minimal governance files.

### Phase D — Define export contract

1. Add `export/public-allowlist.yml` in private repo describing exactly what can ship.
2. Add `scripts/export-public.sh` (or Python equivalent) to produce deterministic public tree.
3. Add validation step that fails if:
   - Unknown files appear in export
   - Blocked patterns are detected (tokens, internal domains, private notes)
   - Required public metadata is missing

### Phase E — First export + publish

1. Generate export from private repo.
2. Review diff manually (2-person check recommended).
3. Push export into public `ship-receipts` `develop`.
4. Tag first split baseline:
   - private: `private-split-baseline-1`
   - public: `public-split-baseline-1`

### Phase F — Ongoing workflow

1. All work lands in private repo.
2. Public releases are generated (manual trigger initially).
3. Public repo rejects direct edits except emergency patch process.

---

## 4) Risk Controls

### Data leakage prevention

- **Allowlist export model** (never denylist-only).
- Secret scanning on both private and export output.
- Pattern checks for private indicators (`internal`, `draft`, partner names, private URLs).
- Mandatory reviewer approval before export push.

### Integrity and traceability

- Export manifest with checksums (`SHA256SUMS`) committed in public repo.
- Record source private commit SHA in export metadata file (`PUBLIC_EXPORT_META.json`).
- Signed tags for baseline and releases.

### Operational resilience

- Rollback tags retained on both repos.
- If export pipeline fails, no publish occurs.
- Emergency stop switch: disable publish workflow in CI.

### Governance safety

- CODEOWNERS enforces maintainer approval for:
  - `scripts/export-*`
  - `export/public-allowlist.yml`
  - `.github/workflows/public-export.yml`

---

## 5) First Execution Slice (smallest valuable slice)

Goal: deliver a single safe public export from private repo with auditable provenance.

### Slice scope

From private repo, export only:
- `README.md`
- `LICENSE`
- `CODE_OF_CONDUCT.md`
- `CONTRIBUTING.md`
- `CHANGELOG.md`
- `schemas/**`
- `examples/**`
- `src/**` (only if currently public-safe)
- `tests/**` (optional for public confidence)

Explicitly exclude for first slice:
- `docs/plans/**`
- `docs/research/**`
- private integration docs and operational notes

### Slice tasks

1. Add allowlist config.
2. Add deterministic export script.
3. Add CI job: `public-export-dry-run` on PR.
4. Run local dry run, inspect output, and fix leaks.
5. Publish initial public repo contents.
6. Document release procedure in `docs/public-export.md` (private repo).

### Slice success criteria

- Public repo can be regenerated from private with one command.
- Export output is identical when rerun at same commit.
- No private-only files in published tree.
- Public README explains contribution/public release path.

---

## 6) Concrete Implementation Checklist

- [ ] Rename repo on GitHub to `ship-receipts-private`
- [ ] Create new public `ship-receipts` repo
- [ ] Update local remotes and deploy keys
- [ ] Add `export/public-allowlist.yml`
- [ ] Add `scripts/export-public.sh`
- [ ] Add CI workflow `.github/workflows/public-export.yml`
- [ ] Add leakage scan step
- [ ] Generate first export and review diff
- [ ] Push first public baseline
- [ ] Tag both repos and document rollback

---

## 7) Suggested Command Skeleton (for operator runbook)

```bash
# In local clone after private rename
git remote set-url origin git@github.com:Pro777/ship-receipts-private.git

# Add public remote
git remote add public git@github.com:Pro777/ship-receipts.git

# Dry run export
./scripts/export-public.sh --out /tmp/ship-receipts-public

# Optional: inspect tree
cd /tmp/ship-receipts-public && find . -maxdepth 3 | sort

# Publish to public remote (example flow)
cd /tmp/ship-receipts-public
git init
git checkout -b develop
git remote add origin git@github.com:Pro777/ship-receipts.git
git add .
git commit -m "chore: initial public export from ship-receipts-private"
git push -u origin develop
```

---

## 8) Decision Log

- Use **private-first + generated public export** instead of dual-maintained repos.
- Use **allowlist-based export** as primary leak control.
- Start with **manual publish gate**, then automate after 1–2 successful cycles.
- Preserve public repo continuity under original `ship-receipts` name.
