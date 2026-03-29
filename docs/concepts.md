# Concepts

## What is a Ship Receipt?

A small, verifiable record of shipped work. Not a blog post. Closer to a business card with proofs attached:

- **Artifact** — a repo, release, package, deployed URL, walk you took, talk you gave
- **Verification hooks** — commands, CI links, checksums that let someone confirm it's real
- **Provenance** — who is claiming it, and when

## Why "receipts over vibes"

At scale, posting volume is noise. Receipts answer three questions: What did you ship? Where is it? How do I verify it?

## The game

Ship-receipts is a single-player game. You declare your own goal (your Ithaca), create daily receipts for your work, and track your progress. Streaks reward consistency. Scoring rewards proof depth. An optional LLM hook acts as a compass — reflecting on whether your daily work advances your declared goal.

The game is for humans to have fun. You can cheat in single player. We don't care.

## Proof of Ship

Proofofship is the optional global layer — the auditor. It independently re-verifies your receipts against public APIs and publishes a canonical reputation score. This is where anti-gaming rules are enforced. You can't cheat the auditor.

Format and local tooling live here. Global verification lives at [proofofship](https://github.com/Pro777/proofofship).

## The full picture

See [docs/pitch.md](pitch.md) for the complete pitch.
