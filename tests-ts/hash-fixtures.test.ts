import { describe, expect, it } from "vitest";
import { computeContentHash } from "../src-ts/scoring/hash-validator.js";

describe("cross-language hash fixtures", () => {
  it("matches python hash fixture #1", () => {
    const receipt = {
      version: "0.1",
      subject: {
        name: "Case1",
        profiles: [{ kind: "github", url: "https://github.com/case1" }],
      },
      meta: { created_at: "2026-03-01T00:00:00Z" },
      artifacts: [
        {
          kind: "repo",
          name: "app1",
          url: "https://github.com/case1/app1",
          immutable_ref: "abc123",
        },
      ],
    };
    expect(computeContentHash(receipt)).toBe(
      "sha256:374c8a4756c5c7e0ccee7a4ee4ebfd43d90325ba11eb27ea6269edd9ee14cf18",
    );
  });

  it("matches python hash fixture #2", () => {
    const receipt = {
      version: "0.1",
      subject: { name: "Case2" },
      artifacts: [
        {
          kind: "dataset",
          name: "data",
          url: "https://example.com/data",
          verify: [{ kind: "checksum", algo: "sha256", hash: "deadbeef" }],
        },
      ],
    };
    expect(computeContentHash(receipt)).toBe(
      "sha256:6090f73fb14872f93667ffbae4286a688d9afb7f1a7cc76b7e3a022d5a687156",
    );
  });

  it("matches python hash fixture #3", () => {
    const receipt = {
      version: "0.1",
      subject: { name: "Case3" },
      meta: {
        created_at: "2026-03-01T00:00:00Z",
        generator: "ship-receipts-cli/0.1.0",
      },
      artifacts: [
        {
          kind: "paper",
          name: "paper",
          url: "https://arxiv.org/abs/1234.5678",
          signals: { stars: 10, downloads_30d: 100 },
        },
      ],
    };
    expect(computeContentHash(receipt)).toBe(
      "sha256:3f07f08dc48f4d5c700e6c9e3e33f214e9214b1308e39c2c3362ef87cbbd5051",
    );
  });
});
