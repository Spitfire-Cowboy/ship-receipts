# Getting Started

## Install

Quick check from npm:

```bash
npx ship-receipts --help
```

Local development in this repo:

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

## Core workflow

The simplest workflow is:
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
