# Ship Receipts

Ship Receipts is a CLI and schema for producing machine-readable records of shipped work.

Each receipt answers four things:
- what was shipped
- where it lives
- how to verify it
- who is claiming it

Homepage: [shipreceipts.com](https://shipreceipts.com)
Repository: [Spitfire-Cowboy/ship-receipts](https://github.com/Spitfire-Cowboy/ship-receipts)
Issues: [github.com/Spitfire-Cowboy/ship-receipts/issues](https://github.com/Spitfire-Cowboy/ship-receipts/issues)

## What it is for

`ship-receipts` is the local toolchain.

Today, it does four concrete things:
- create receipts
- validate receipts
- score and replay local receipt history
- export a static runway viewer from `ship-receipt/v1` feeds or recent git history

If you only want the practical part, stop there. The game-mode layer is optional and
still only partially implemented.

## 🛠 Install

```bash
npx ship-receipts --help
```

For local development in this repo:

```bash
npm install
npm run build
npm test
```

## ⚡ Quick start

Create a receipt:

```bash
ship-receipts create \
  --name "ship-receipts" \
  --kind repo \
  --url "https://github.com/Spitfire-Cowboy/ship-receipts" \
  --subject "Example Builder" \
  --output receipt.json
```

Verify the receipt:

```bash
ship-receipts verify receipt.json
```

Typical output:

```text
Receipt: /path/to/receipt.json

Schema:  PASS
Hash:    SKIP (no meta.content_hash)
Base:    6 points

VALID
```

`create` is an alias of `init`, and `verify` is an alias of `validate`.

## 🧾 Core workflow

The simplest human workflow is:
- create a receipt for something you shipped
- validate it
- score it into local state

```bash
ship-receipts create \
  --name "ship-receipts" \
  --kind repo \
  --url "https://github.com/Spitfire-Cowboy/ship-receipts" \
  --subject "Example Builder" \
  --output receipt.json

ship-receipts validate receipt.json
ship-receipts score receipt.json
```

That gives you a local, machine-readable record plus deterministic scoring.

## ✈️ Runway

Runway is the current human-facing viewer for receipt timelines.

Generate a static runway site from `ship-receipt/v1` JSON:

```bash
ship-receipts runway build \
  --feed ./receipts.json \
  --output-dir ./runway
```

Or build the feed directly from recent git history in the current repo:

```bash
ship-receipts runway build \
  --from-git \
  --days 90 \
  --output-dir ./runway
```

Preview the same runway locally in a browser without depending on GitHub Pages:

```bash
ship-receipts runway preview \
  --from-git \
  --days 90
```

Or use the package shortcut after building this repo locally:

```bash
npm run build
npm run runway:preview
```

This writes:
- `runway/index.html`
- `runway/receipts.json`

You can then serve that directory statically from Caddy, GitHub Pages, S3, or any
other static host. `runway preview` does the same export into `.runway-preview/` and
serves it at a local `http://127.0.0.1:4173/`-style URL until you stop it.

This repo also includes a GitHub Pages deploy path that publishes the generated
runway bundle from `main`.

Preview:

<table><tr>
<td><a href="docs/assets/runway-desktop-view.png"><img src="docs/assets/runway-desktop-view.png" alt="Ship Receipts runway desktop view" width="420"></a></td>
<td><a href="docs/assets/runway-mobile-view.png"><img src="docs/assets/runway-mobile-view.png" alt="Ship Receipts runway mobile view" width="240"></a></td>
</tr></table>

## 🎮 Optional game layer

There is an optional game-flavored layer on top of the core receipt flow:
- local scoring
- streaks
- simulation
- ceremonial render hooks

This is real enough to experiment with, but it is not yet a full game product.

For current status, read [docs/game-mode/README.md](./docs/game-mode/README.md).

### 1. Replay historical receipts

Run a dry simulation over receipts you already have:

```bash
ship-receipts simulate --receipts-dir .ship-receipts/receipts --json
```

This replays receipt timestamps through the game-state engine without mutating your
live state. It is the easiest way to demo long-arc progression from real work.

### 2. Attach a ceremonial render

Generate an asset elsewhere, then attach it to a receipt:

```bash
ship-receipts render receipt.json \
  --preset proof-card \
  --asset ./out/odyssey-proof-card.png \
  --output ./out/odyssey-proof-card.render.json \
  --attach ./out/receipt.with-media.json
```

What this does:
- writes a render manifest
- hashes the asset
- appends a `media[]` entry to a receipt copy
- recomputes the receipt content hash

Supported presets:
- `proof-card`
- `streak-bumper`
- `ritual-clip`

Supported formats:
- `png`
- `gif`
- `mp4`
- `ascii-gif`
- `ascii-mp4`

### 3. Keep the game mode ambient

The intended shape is not "open a dashboard and grind."

The intended shape is:
- ship real work
- let receipts advance the world
- let the CLI show slow narrative progress over time
- trigger famous scenes or ceremonial bumpers when something real ships

That keeps the loop legible and fun without turning it into manipulative busywork.

## Useful commands

Score a receipt into local game state:

```bash
ship-receipts score receipt.json
```

Show streak status:

```bash
ship-receipts streak
```

Show the daily ambient dashboard:

```bash
ship-receipts daily
ship-receipts daily --watch
```

Set or inspect the long-horizon goal:

```bash
ship-receipts goal set "Return to Ithaca"
ship-receipts goal status
```

## ⏱️ OpenTimestamps

Anchor a receipt digest with OpenTimestamps:

```bash
ship-receipts anchor ots receipt.json
ship-receipts verify ots receipt.json
```

`anchor ots` and `verify ots` require the `ots` CLI:

```bash
pip3 install opentimestamps-client
```

## 🔒 Trust boundary

`ship-receipts` records and packages claims locally.

It does **not** independently verify those claims globally. That boundary belongs to
the separate `proofofship` verifier, which re-checks receipts against the public
record.

The one scoped exception is OpenTimestamps anchoring:
- `anchor ots` and `verify ots` call the external `ots` CLI
- that verifies timestamp proof linkage for a digest
- it does not replace global receipt verification

## 📌 Public scope vs private design carryover

Not every draft from the private repo is part of the public product surface.

In this public repo:
- the CLI, schemas, examples, and runway flow are current
- some game-mode docs are retained as design drafts
- draft docs should not be read as promises that a full playable game already exists

## Repo layout

- schemas: [`schema/`](schema/) and [`schemas/`](schemas/)
- examples: [`examples/`](examples/)
- TypeScript CLI source: [`src-ts/`](src-ts/)
- test suite: [`tests-ts/`](tests-ts/)
- docs index: [`docs/`](docs/)
- game-mode status: [`docs/game-mode/README.md`](./docs/game-mode/README.md)

## License

Apache 2.0. See [`LICENSE`](LICENSE).
