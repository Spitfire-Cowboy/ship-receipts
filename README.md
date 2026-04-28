# Ship Receipts

Ship Receipts is a CLI and JSON schema for recording work you actually shipped.

Each receipt is a small, machine-readable claim:
- what was shipped
- where it lives
- who is claiming it
- how someone else could check it

## What it does

`ship-receipts` runs locally. It creates receipts, validates them, scores them
into local state, and can export a static "runway" page from receipts or recent
git history.

It is not a social network, a badge farm, or a global reputation service. It is
the local evidence layer. The separate `proofofship` verifier is the global
layer.

## Install

```bash
npx ship-receipts --help
```

For local development in this repo:

```bash
npm install
npm run build
npm test
```

## Quick start

Create a receipt:

```bash
ship-receipts create \
  --name "ship-receipts" \
  --kind repo \
  --url "https://github.com/Spitfire-Cowboy/ship-receipts" \
  --subject "Example Builder" \
  --output receipt.json \
  --hash
```

Validate it:

```bash
ship-receipts validate receipt.json
```

Score it into local state:

```bash
ship-receipts score receipt.json
ship-receipts streak
```

Build a static runway from recent git history:

```bash
ship-receipts runway build --from-git --days 30 --output-dir .runway
```

## Docs

- [Getting started](./docs/getting-started.md)
- [Runway guide](./docs/runway.md)
- [Game mode guide](./docs/game-mode.md)
- [Concepts](./docs/concepts.md)
- [Release checklist](./docs/release-checklist.md)
- [Docs index](./docs/README.md)

Preview:

<table><tr>
<td><a href="docs/assets/runway-desktop-view.png"><img src="docs/assets/runway-desktop-view.png" alt="Ship Receipts runway desktop view" width="420"></a></td>
<td><a href="docs/assets/runway-mobile-view.png"><img src="docs/assets/runway-mobile-view.png" alt="Ship Receipts runway mobile view" width="240"></a></td>
</tr></table>

## OpenTimestamps

Receipts can be anchored with OpenTimestamps. This proves a digest existed at a
point in time. It does not prove the receipt claim is true.

```bash
ship-receipts anchor ots receipt.json
ship-receipts verify ots receipt.json
```

`anchor ots` and `verify ots` require the `ots` CLI:

```bash
pip3 install opentimestamps-client
```

## Trust boundary

`ship-receipts` records and packages claims locally.

It does **not** independently verify those claims globally. That boundary belongs
to the separate `proofofship` verifier, which re-checks receipts against the
public record.

OpenTimestamps is the scoped exception:
- `anchor ots` and `verify ots` call the external `ots` CLI.
- That verifies timestamp proof linkage for a digest.
- It does not replace global receipt verification.

## Game layer

The game-flavored layer is optional. It includes local scoring, streaks, goals,
simulation, and ceremonial render manifests. The game should reward better proof,
not more busywork.

## Repo layout

- CLI source: [`src-ts/`](src-ts/)
- schemas: [`schema/`](schema/) and [`schemas/`](schemas/)
- examples: [`examples/`](examples/)
- TypeScript tests: [`tests-ts/`](tests-ts/)
- Python reference tests: [`tests/`](tests/)
- docs: [`docs/`](docs/)

## License

Apache 2.0. See [`LICENSE`](LICENSE).
