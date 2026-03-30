# Ship Receipts

Ship Receipts is a CLI and schema for producing machine-readable records of shipped work.

Each receipt answers four things:
- what was shipped
- where it lives
- how to verify it
- who is claiming it

Homepage: [shipreceipts.com](https://shipreceipts.com)

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

Typical output:

```text
Created: /path/to/receipt.json
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

Anchor a receipt digest with OpenTimestamps:

```bash
ship-receipts anchor ots receipt.json
ship-receipts verify ots receipt.json
```

`anchor ots` and `verify ots` require the `ots` CLI (`pip3 install opentimestamps-client`).

## Trust boundary

`ship-receipts` creates proof envelopes for use with `proofofship` and does not
verify those envelope claims directly.

`anchor ots` and `verify ots` are the one scoped exception: they call the
external `ots` CLI to anchor and verify OpenTimestamps proofs for receipt
digests.

Schema `$id` URLs are stable identifiers and do not require a live verifier API.

## Repo layout

- schemas: [`schema/`](schema/) and [`schemas/`](schemas/)
- examples: [`examples/`](examples/)
- TypeScript CLI source: [`src-ts/`](src-ts/)
- test suite: [`tests-ts/`](tests-ts/)
- docs index: [`docs/`](docs/)

## License

Apache 2.0. See [`LICENSE`](LICENSE).
