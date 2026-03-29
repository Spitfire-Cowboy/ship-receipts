# Ship Receipts

Ship Receipts is a TypeScript CLI and schema for producing machine-readable records of shipped work.

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

## Quick start

Create a receipt:

```bash
ship-receipts create \
  --name "ship-receipts" \
  --kind repo \
  --url "https://github.com/Spitfire-Cowboy/ship-receipts" \
  --subject "John Malone" \
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

`ship-receipts` creates proof envelopes. It does not verify them.
Verification lives in separate tooling (`proofofship`).

## Repo layout

- schemas: [`schema/`](schema/) and [`schemas/`](schemas/)
- examples: [`examples/`](examples/)
- TypeScript CLI source: [`src-ts/`](src-ts/)

## License

Apache-2.0. See [`LICENSE`](LICENSE).
