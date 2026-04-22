# Research Note: Three.js + WebGPU — The Missing Discovery Layer

**Issue:** #63
**Source:** [@pierskicks](https://x.com/pierskicks/status/2031401808086839343)

---

## The observation

> Three.js + WebGPU = a modern Flash games boom. Ships to 5B+ users, near-native GPU performance. No platform rake, app store, or custom runtime. Devs own their distribution + monetisation. AI can now vibe code the games for you. The only missing piece is the discovery layer.

---

## Why this matters for ship-receipts

If AI-vibe-coded Three.js/WebGPU games become a boom:
- Games need discovery (finding good games)
- Game devs need credibility (proof that a human shipped this, not a slop farm)
- Receipts are the credibility layer

Ship-receipts + proofofship is the infrastructure for "I made this and it's real" — exactly what a discovery layer needs as a trust signal.

---

## Integration points

### Game as a receipt
A Three.js game shipped to the web is a `demo` or `release` receipt. The URL, commit SHA, and content hash make it verifiable.

### Game dev credibility profile
A game developer with a history of receipts (repos, demos, community contributions) has a higher proofofship score — surfaceable by a discovery layer as a trust signal.

### ship-receipts × Cyan (game studio integration)
Already explored in #58: game clients can read the wellness signal from ship-receipts locally. A Three.js game in the browser could also read it via a local API.

---

## Relevance to the platform thesis

The Three.js/WebGPU boom creates a new class of potential ship-receipts users: indie game developers who:
- Ship frequently (AI-assisted rapid iteration)
- Need credibility differentiation (quality vs. slop)
- Have no team or external accountability structure (→ Dead Reckoning game mode is a fit)

---

## Next steps

- No action required on ship-receipts schema — `demo` and `release` artifact kinds already cover this
- Watch the Three.js + WebGPU ecosystem for discovery layer products that could partner with proofofship
