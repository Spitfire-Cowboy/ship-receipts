import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  confidenceLevel,
  computeBaseScore,
  computeFinalScore,
  integrityMultiplier,
  qualifiesForStreak,
  streakMultiplier,
} from "../src-ts/scoring/engine.js";

function minimalReceipt(overrides: Record<string, any> = {}): Record<string, any> {
  return {
    version: "0.1",
    subject: { name: "Alice" },
    artifacts: [
      {
        kind: "repo",
        name: "myapp",
        url: "https://github.com/alice/myapp",
      },
    ],
    ...overrides,
  };
}

describe("engine", () => {
  it("scores minimal receipt", () => {
    const [score, breakdown] = computeBaseScore(minimalReceipt());
    expect(score).toBe(1);
    expect(breakdown["subject.name"]).toBe(1);
  });

  it("scores rich proof elements additively", () => {
    const [score] = computeBaseScore({
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
          ci_url: "https://ci.example.com/123",
          verify: [
            { kind: "checksum", algo: "sha256", hash: "deadbeef" },
            { kind: "link", url: "https://example.com/proof" },
            { kind: "command", command: "npm test" },
          ],
          signals: { stars: 42, downloads_30d: 1000 },
        },
      ],
    });
    expect(score).toBe(15);
  });

  it("applies streak tiers", () => {
    expect(streakMultiplier(0)).toBe(1.0);
    expect(streakMultiplier(1)).toBe(1.0);
    expect(streakMultiplier(2)).toBe(1.1);
    expect(streakMultiplier(3)).toBe(1.25);
    expect(streakMultiplier(4)).toBe(1.25);
    expect(streakMultiplier(5)).toBe(1.5);
    expect(streakMultiplier(30)).toBe(1.5); // capped at 5-day max
  });

  it("uses anti-slop threshold", () => {
    expect(qualifiesForStreak(5)).toBe(false);
    expect(qualifiesForStreak(6)).toBe(true);
  });

  it("computes final score with multipliers", () => {
    const receipt = minimalReceipt({
      artifacts: [
        {
          kind: "repo",
          name: "myapp",
          url: "https://github.com/alice/myapp",
          verify: [{ kind: "checksum", algo: "sha256", hash: "deadbeef" }],
        },
      ],
    });
    const score = computeFinalScore(15, 7, receipt, true);
    expect(score).toBe(33); // floor(15 * 1.5 * 1.5)
  });

  it("integrity bonus requires hash valid + checksum", () => {
    const receipt = minimalReceipt({
      artifacts: [{ kind: "repo", name: "x", url: "https://github.com/alice/x" }],
    });
    expect(integrityMultiplier(receipt, true)).toBe(1.0);
    receipt.artifacts[0].verify = [{ kind: "checksum", algo: "sha256", hash: "deadbeef" }];
    expect(integrityMultiplier(receipt, true)).toBe(1.5);
    expect(integrityMultiplier(receipt, false)).toBe(1.0);
  });

  it("maps confidence tiers", () => {
    expect(confidenceLevel(0, false)).toBe("none");
    expect(confidenceLevel(3, true)).toBe("minimal");
    expect(confidenceLevel(8, true)).toBe("moderate");
    expect(confidenceLevel(15, true)).toBe("strong");
    expect(confidenceLevel(25, true)).toBe("verified");
  });

  it("scores fixture receipt as expected", () => {
    const here = dirname(fileURLToPath(import.meta.url));
    const fixture = JSON.parse(
      readFileSync(join(here, "fixtures", "parity-receipt.json"), "utf8"),
    );
    const [baseScore] = computeBaseScore(fixture);
    expect(baseScore).toBe(15);
    expect(computeFinalScore(baseScore, 7, fixture, true)).toBe(33);
  });
});
