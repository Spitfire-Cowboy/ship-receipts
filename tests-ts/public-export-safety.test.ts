import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { scanTreeForLeakPatterns } from "../scripts/public-export-safety.mjs";

describe("public export safety scan", () => {
  it("accepts a clean export tree", async () => {
    const root = await mkdtemp(join(tmpdir(), "sr-export-safe-"));
    await mkdir(join(root, "examples"), { recursive: true });
    await writeFile(
      join(root, "README.md"),
      "See https://github.com/Spitfire-Cowboy/ship-receipts for the public repo.\n",
      "utf8",
    );
    await writeFile(
      join(root, "examples", "receipt.json"),
      JSON.stringify({ version: "1.0", meta: { created_at: "2026-04-06T00:00:00Z" } }, null, 2),
      "utf8",
    );

    await expect(scanTreeForLeakPatterns(root)).resolves.toEqual([]);
  });

  it("flags legacy private and repo-specific leak patterns", async () => {
    const root = await mkdtemp(join(tmpdir(), "sr-export-leak-"));
    await mkdir(join(root, "docs"), { recursive: true });
    await writeFile(
      join(root, "docs", "notes.md"),
      [
        "Clone git@github.com:Pro777/ship-receipts.git for the old repo.",
        "Verifier notes still mention https://github.com/Pro777/proofofship.",
        "Do not export ship-receipts-private references.",
      ].join("\n"),
      "utf8",
    );

    const findings = await scanTreeForLeakPatterns(root);
    expect(findings).toHaveLength(1);
    expect(findings[0]?.path).toBe("docs/notes.md");
    expect(findings[0]?.matches).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label: "legacy ship-receipts SSH URL" }),
        expect.objectContaining({ label: "legacy proofofship repo URL" }),
        expect.objectContaining({ label: "private repo name" }),
      ]),
    );
  });
});
