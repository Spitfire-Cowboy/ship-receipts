import { describe, expect, it } from "vitest";
import { computeContentHash, validateContentHash } from "../src-ts/scoring/hash-validator.js";

describe("hash validator", () => {
  it("computes deterministic sha256 hash", () => {
    const receipt = {
      version: "0.1",
      subject: { name: "Alice" },
      artifacts: [{ kind: "repo", name: "x", url: "https://github.com/alice/x" }],
      meta: { created_at: "2026-01-01T00:00:00Z" },
    };

    const h1 = computeContentHash(receipt);
    const h2 = computeContentHash(receipt);
    expect(h1).toBe(h2);
    expect(h1.startsWith("sha256:")).toBe(true);
  });

  it("validates claimed hash", () => {
    const receipt: Record<string, any> = {
      version: "0.1",
      subject: { name: "Alice" },
      artifacts: [{ kind: "repo", name: "x", url: "https://github.com/alice/x" }],
    };
    receipt.meta = { content_hash: computeContentHash(receipt) };
    expect(validateContentHash(receipt)).toBe(true);
  });

  it("matches known Python hash fixture", () => {
    const receipt = {
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
        },
      ],
    };
    expect(computeContentHash(receipt)).toBe(
      "sha256:43350d72ed2b0a9d9f0f86aff972eed48e4f198f0005fc4f8d7d9f58f06727db",
    );
  });

  it("is stable across object key ordering", () => {
    const a = {
      version: "0.1",
      subject: { name: "Alice" },
      artifacts: [{ kind: "repo", name: "x", url: "https://github.com/alice/x" }],
      meta: { created_at: "2026-01-01T00:00:00Z" },
    };
    const b = {
      meta: { created_at: "2026-01-01T00:00:00Z" },
      artifacts: [{ url: "https://github.com/alice/x", name: "x", kind: "repo" }],
      subject: { name: "Alice" },
      version: "0.1",
    };
    expect(computeContentHash(a)).toBe(computeContentHash(b));
  });

  it("returns true when no content hash is present", () => {
    const receipt = {
      version: "0.1",
      subject: { name: "Alice" },
      artifacts: [{ kind: "repo", name: "x", url: "https://github.com/alice/x" }],
    };
    expect(validateContentHash(receipt)).toBe(true);
  });

  it("rejects non-sha256 prefix", () => {
    const receipt = {
      version: "0.1",
      subject: { name: "Alice" },
      artifacts: [{ kind: "repo", name: "x", url: "https://github.com/alice/x" }],
      meta: { content_hash: "md5:abc123" },
    };
    expect(validateContentHash(receipt)).toBe(false);
  });
});
