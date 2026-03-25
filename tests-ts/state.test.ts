import { describe, expect, it } from "vitest";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { GameState } from "../src-ts/scoring/state.js";
import { computeContentHash } from "../src-ts/scoring/hash-validator.js";

function richReceipt(): Record<string, any> {
  return {
    version: "0.1",
    subject: {
      name: "Alice",
      profiles: [{ kind: "github", url: "https://github.com/alice" }],
    },
    meta: { created_at: "2026-02-25T10:00:00Z" },
    artifacts: [
      {
        kind: "repo",
        name: "myapp",
        url: "https://github.com/alice/myapp",
        immutable_ref: "abc123",
        verify: [{ kind: "checksum", algo: "sha256", hash: "deadbeef" }],
      },
    ],
  };
}

describe("state", () => {
  it("accepts and persists a valid receipt", async () => {
    const root = await mkdtemp(join(tmpdir(), "sr-ts-state-"));
    const state = await GameState.create(root);
    const result = state.scoreReceipt(richReceipt());
    expect(result.status).toBe("ACCEPTED");
    await state.save();

    const raw = await readFile(join(root, ".ship-receipts", "game-state.json"), "utf8");
    const loaded = JSON.parse(raw);
    expect(loaded.receipts_submitted).toBe(1);
    expect(loaded.total_score).toBeGreaterThan(0);
  });

  it("rejects tampered content hash", async () => {
    const root = await mkdtemp(join(tmpdir(), "sr-ts-state-"));
    const receipt = richReceipt();
    receipt.meta.content_hash = computeContentHash(receipt);
    receipt.artifacts[0].name = "tampered";

    const state = await GameState.create(root);
    const result = state.scoreReceipt(receipt);
    expect(result.status).toBe("REJECTED");
  });

  it("marks duplicate submissions", async () => {
    const root = await mkdtemp(join(tmpdir(), "sr-ts-state-"));
    const state = await GameState.create(root);
    const first = state.scoreReceipt(richReceipt());
    const second = state.scoreReceipt(richReceipt());
    expect(first.status).toBe("ACCEPTED");
    expect(second.status).toBe("DUPLICATE");
    expect(second.score).toBe(0);
  });

  it("does not advance streak for low-score receipts", async () => {
    const root = await mkdtemp(join(tmpdir(), "sr-ts-state-"));
    const state = await GameState.create(root);
    const result = state.scoreReceipt({
      version: "0.1",
      subject: { name: "Bob" },
      artifacts: [{ kind: "repo", name: "x", url: "https://github.com/bob/x" }],
    });
    expect(result.qualifies_for_streak).toBe(false);
    expect(state.state.streak.current).toBe(0);
  });

  it("does not increment streak twice on the same day", async () => {
    const root = await mkdtemp(join(tmpdir(), "sr-ts-state-"));
    const state = await GameState.create(root);

    const r1 = richReceipt();
    const r2 = richReceipt();
    r2.artifacts[0].immutable_ref = "def456";

    const first = state.scoreReceipt(r1);
    const second = state.scoreReceipt(r2);

    expect(first.status).toBe("ACCEPTED");
    expect(second.status).toBe("ACCEPTED");
    expect(state.state.streak.current).toBe(1);
  });
});
