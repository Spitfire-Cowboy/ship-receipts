import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("release guardrails", () => {
  it("keeps public export checks in package scripts and prepublish", async () => {
    const pkg = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));

    expect(pkg.scripts["check:public-export"]).toBe("bash scripts/check-public-export-safety.sh");
    expect(pkg.scripts["check:examples"]).toBe("bash scripts/check-example-anonymization.sh");
    expect(pkg.scripts["pack:dry-run"]).toBe("npm pack --dry-run");

    const prepublishOnly = String(pkg.scripts.prepublishOnly ?? "");
    expect(prepublishOnly).toContain("npm run check:public-export");
    expect(prepublishOnly).toContain("npm run check:examples");
    expect(prepublishOnly).toContain("npm run pack:dry-run");
  });

  it("keeps public package metadata pointed at the canonical repo", async () => {
    const pkg = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));

    expect(pkg.homepage).toBe("https://github.com/Spitfire-Cowboy/ship-receipts#readme");
    expect(pkg.repository).toEqual({
      type: "git",
      url: "git+https://github.com/Spitfire-Cowboy/ship-receipts.git",
    });
    expect(pkg.bugs).toEqual({
      url: "https://github.com/Spitfire-Cowboy/ship-receipts/issues",
    });
    expect(pkg.keywords).toEqual(
      expect.arrayContaining(["cli", "json-schema", "provenance", "receipts", "verification"]),
    );
  });
});
