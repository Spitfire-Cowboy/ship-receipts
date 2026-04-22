# Game Mode Status

This folder contains a mix of shipped behavior, partial implementations, and
design backlog.

Read it in that order.

## What is real now

- local scoring via `ship-receipts score`
- local streak state via `ship-receipts streak`
- dry replay via `ship-receipts simulate`
- ceremonial render manifests via `ship-receipts render`
- runway export via `ship-receipts runway build`

These are the parts a normal user can actually run today.

## What is partial

- the "Odyssey" framing exists as naming, goal/state, and render vocabulary
- the ambient CLI loop exists, but not as a full standalone game shell
- runway is now a real viewer, but it is still a receipt viewer first, not a full
  game interface

## What is still design-only

The docs below are design inventory, not shipped product:
- local/global loop UX specs
- party/guild/monk/siege mode concepts
- hardware bridge and cabinet mockups
- strategic analysis and adoption theory
- detailed UI state inventories for screens that do not fully exist in public yet

## Recommended reading order

If you want the current public reality:
1. [`README.md`](../../README.md)
2. [`../concepts.md`](../concepts.md)
3. [`../release-checklist.md`](../release-checklist.md)

If you want the design backlog:
1. [`game-mode-foundation-v1.md`](./game-mode-foundation-v1.md)
2. [`local-loop-ux-spec-v1.md`](./local-loop-ux-spec-v1.md)
3. [`global-loop-ux-spec-v1.md`](./global-loop-ux-spec-v1.md)
4. [`strategic-analysis-v1.md`](./strategic-analysis-v1.md)

## Design docs retained here

- [`game-mode-foundation-v1.md`](./game-mode-foundation-v1.md)
- [`local-loop-ux-spec-v1.md`](./local-loop-ux-spec-v1.md)
- [`global-loop-ux-spec-v1.md`](./global-loop-ux-spec-v1.md)
- [`ui-copy-and-states-v1.md`](./ui-copy-and-states-v1.md)
- [`strategic-analysis-v1.md`](./strategic-analysis-v1.md)
