# Runway Guide

Runway is the human-facing viewer for receipt timelines.

Longer feeds are paginated client-side so the initial view stays readable. Cards
also summarize long artifact lists instead of dumping every artifact chip inline.

## Build from a feed

Generate a static runway site from a `ship-receipt/v1` feed:

```bash
ship-receipts runway build \
  --feed ./receipts.json \
  --output-dir ./runway
```

## Build from git history

Build the feed directly from recent git history in the current repo:

```bash
ship-receipts runway build \
  --from-git \
  --days 90 \
  --output-dir ./runway
```

## Preview locally

Preview the same runway locally in a browser without depending on GitHub Pages:

```bash
ship-receipts runway preview \
  --from-git \
  --days 90
```

Package shortcuts after building this repo locally:

```bash
npm run build
npm run runway:preview
```

Preview a stable demo built from the checked-in public examples:

```bash
npm run build
npm run runway:examples:preview
```

## Static export only

If you only want the static files for the checked-in sample corpus:

```bash
npm run build
npm run runway:examples
```

This writes:
- `runway/index.html`
- `runway/receipts.json`

You can then serve that directory statically from Caddy, GitHub Pages, S3, or any
other static host. `runway preview` does the same export into `.runway-preview/`
and serves it at a local `http://127.0.0.1:4173/`-style URL until you stop it.
