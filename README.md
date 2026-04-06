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

`ship-receipts` is the local runtime. It lives in the repo where work is happening.

It does three useful jobs:
- create and validate receipts
- score and replay local receipt history
- attach ceremonial media hooks to real receipts

That last part matters: the game layer is not a separate click-farm. It is driven by
actual shipped receipts and stays ambient in the CLI.

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

## MVP demo flow

The current thin-slice demo is:
- use a real receipt
- replay receipts over time
- attach a ceremonial asset to a shipped event

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

## Other useful commands

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

## OpenTimestamps

Anchor a receipt digest with OpenTimestamps:

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

It does **not** independently verify those claims globally. That boundary belongs to
the separate `proofofship` verifier, which re-checks receipts against the public
record.

The one scoped exception is OpenTimestamps anchoring:
- `anchor ots` and `verify ots` call the external `ots` CLI
- that verifies timestamp proof linkage for a digest
- it does not replace global receipt verification

## Repo layout

- schemas: [`schema/`](schema/) and [`schemas/`](schemas/)
- examples: [`examples/`](examples/)
- TypeScript CLI source: [`src-ts/`](src-ts/)
- test suite: [`tests-ts/`](tests-ts/)
- docs index: [`docs/`](docs/)

## License

Apache 2.0. See [`LICENSE`](LICENSE).
