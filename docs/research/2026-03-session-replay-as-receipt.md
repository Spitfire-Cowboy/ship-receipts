# Session Replay as Receipt Evidence

**Source:** [es617/claude-replay](https://github.com/es617/claude-replay)
**Issue:** #62

---

## What claude-replay does

Converts Claude Code JSONL transcripts into self-contained, interactive HTML replays. Zero runtime dependencies. Built-in secret scrubbing.

---

## Fit with ship-receipts

Ship-receipts proves work happened. claude-replay shows *how* it happened. A proof envelope that links to (or embeds) a session replay is a stronger receipt than a hash alone.

### New artifact kind: `session_replay`

Added to v0.1 and v1 schemas. Use it for interactive HTML session replays attached to a receipt:

```json
{
  "kind": "session_replay",
  "name": "claude-code-session-2026-03-09",
  "url": "https://example.com/replays/session-abc.html",
  "verify": [
    {
      "kind": "checksum",
      "algo": "sha256",
      "hash": "<sha256 of the HTML file>"
    }
  ]
}
```

### Verification depth

Session replay presence could boost verification score (similar to how DR attestation boosts Stage 5). The hash of the replay HTML is the verification anchor — the replay cannot be retroactively altered without changing the hash.

### Redaction

claude-replay's secret scrubbing aligns with the trust boundary: receipts are shareable, but sessions contain sensitive context. The scrubbing must be verified before the replay URL is included in a public receipt.

---

## Next steps

- [ ] Prototype: generate a replay from a ship-receipts session, embed SHA-256 in envelope
- [ ] Evaluate whether replay artifacts should trigger a verification bonus in the scoring engine
- [ ] Add claude-replay to the AGENTS.md workflow as an optional evidence capture step
