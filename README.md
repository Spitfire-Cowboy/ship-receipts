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

## What it does

`ship-receipts` is the local toolchain.

Today it can:
- create receipts
- validate receipts
- score and replay local receipt history
- export a static runway viewer from receipt feeds or recent git history
- attach ceremonial render manifests to receipts

The game-flavored layer is optional. The core product is still the CLI, schemas,
examples, and runway flow.

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

## Repo layout

- schemas: [`schema/`](schema/) and [`schemas/`](schemas/)
- examples: [`examples/`](examples/)
- TypeScript CLI source: [`src-ts/`](src-ts/)
- test suite: [`tests-ts/`](tests-ts/)
- docs index: [`docs/`](docs/)
- getting started: [`docs/getting-started.md`](./docs/getting-started.md)
- runway guide: [`docs/runway.md`](./docs/runway.md)
- game-mode guide: [`docs/game-mode.md`](./docs/game-mode.md)
- game-mode status: [`docs/game-mode/README.md`](./docs/game-mode/README.md)

## License

Apache 2.0. See [`LICENSE`](LICENSE).
