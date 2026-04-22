# Game Mode Guide

There is an optional game-flavored layer on top of the core receipt flow:
- local scoring
- streaks
- simulation
- ceremonial render hooks

This is real enough to experiment with, but it is not yet a full game product.

For current status, read [docs/game-mode/README.md](./game-mode/README.md).

## Replay historical receipts

Run a dry simulation over receipts you already have:

```bash
ship-receipts simulate --receipts-dir .ship-receipts/receipts --json
```

This replays receipt timestamps through the game-state engine without mutating
live state. It is the easiest way to demo long-arc progression from real work.

## Attach a ceremonial render

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

## Keep the game mode ambient

The intended shape is:
- ship real work
- let receipts advance the world
- let the CLI show slow narrative progress over time
- trigger ceremonial bumpers when something real ships

That keeps the loop legible without turning it into manipulative busywork.
