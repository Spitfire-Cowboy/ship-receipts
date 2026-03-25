import { describe, expect, it } from "vitest";
import { exportProofEnvelope } from "../src-ts/envelope/export.js";

function receipt(): Record<string, any> {
  return {
    version: "0.1",
    subject: {
      name: "Alice",
      profiles: [{ kind: "github", url: "https://github.com/alice" }],
    },
    artifacts: [{ kind: "repo", name: "myapp", url: "https://github.com/alice/myapp" }],
  };
}

describe("envelope export", () => {
  it("exports a valid envelope shape", () => {
    const out = exportProofEnvelope(receipt());
    expect(out.envelope_version).toBe("1.0");
    expect(out.content_hash.startsWith("sha256:")).toBe(true);
    expect(out.actor.github_username).toBe("alice");
    expect(out.receipt.subject.name).toBe("Alice");
  });

  it("includes local score snapshot when history has a matching hash", () => {
    const r = receipt();
    const out = exportProofEnvelope(r, {
      streak: { current: 5 },
      history: [
        {
          receipt_hash: outHash(r),
          score: 18,
          breakdown: {
            base: 12,
            streak_multiplier: 1.5,
            integrity_multiplier: 1.0,
          },
        },
      ],
    });
    expect(out.local_score_snapshot).toBeTruthy();
    expect(out.local_score_snapshot.base_score).toBe(12);
    expect(out.local_score_snapshot.final_score).toBe(18);
  });

  it("throws when no GitHub profile is present", () => {
    const bad = {
      version: "0.1",
      subject: { name: "NoGithub" },
      artifacts: [{ kind: "repo", name: "x", url: "https://example.com/x" }],
    };
    expect(() => exportProofEnvelope(bad)).toThrowError(/No GitHub profile/);
  });
});

function outHash(r: Record<string, any>): string {
  return exportProofEnvelope(r).content_hash;
}
