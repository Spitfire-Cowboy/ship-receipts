# Public Release Checklist

Use this checklist when cutting a public release from the current `main` branch.

## Preconditions

- Work from a clean checkout of `main`
- Ensure the intended version and changelog entries are already committed
- Confirm npm publish credentials and repository secrets are in place

## Local Verification

Run the full local release gate before tagging:

```bash
npm test
python3 -m pytest tests -v --tb=short
npm run check:public-export
npm run check:examples
npm run pack:dry-run
```

Expected outcomes:
- TypeScript tests pass
- Python tests pass
- export leak scan passes
- example anonymization gate passes
- `npm pack --dry-run` shows the intended public tarball contents

## Release Prep

1. Review [`CHANGELOG.md`](../CHANGELOG.md) for the release notes that should ship
2. Confirm [`package.json`](../package.json) version is correct
3. Confirm [`README.md`](../README.md) reflects the current public CLI surface
4. Confirm the package tarball still contains:
   - `dist/**`
   - `schema/**`
   - `schemas/**`
   - `examples/**`
   - `README.md`
   - `CHANGELOG.md`
   - `LICENSE`

## Publish Flow

The repository publishes on tags matching `v*` via
[`npm-publish.yml`](../.github/workflows/npm-publish.yml).

The repository also deploys the runway viewer on pushes to `main` via
[`runway-pages.yml`](../.github/workflows/runway-pages.yml).

Typical flow:

```bash
git checkout main
git pull --ff-only origin main
git tag v0.1.0
git push origin v0.1.0
```

After pushing the tag:
- watch the `npm-publish` workflow
- confirm `npm test`, export safety, anonymization, and pack dry-run all pass in CI
- confirm `npm publish --provenance --access public` succeeds

After merging to `main`:
- watch the `runway-pages` workflow
- confirm the generated `.runway/` artifact uploads successfully
- confirm GitHub Pages serves the latest git-derived runway feed

## Post-Release Checks

1. Confirm the tagged GitHub release or tag exists
2. Confirm the published npm package matches the expected version
3. Smoke-check the CLI from the published package:

```bash
npx ship-receipts --help
```

4. If release notes changed materially, verify the README and docs links still match the published package surface

## If Something Fails

- If `npm test` or `pytest` fails, stop and fix the branch before tagging
- If export safety or anonymization fails, treat it as a release blocker
- If `npm pack --dry-run` shows unexpected files, fix `package.json` or the export allowlist before retrying
- If the tag-triggered workflow fails after publish starts, capture the workflow URL and failure mode in a GitHub issue before retrying
