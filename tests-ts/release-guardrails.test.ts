import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("release guardrails", () => {
  it("keeps public export checks in package scripts and prepublish", async () => {
    const pkg = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));

    expect(pkg.scripts["check:public-export"]).toBe("bash scripts/check-public-export-safety.sh");
    expect(pkg.scripts["check:examples"]).toBe("bash scripts/check-example-anonymization.sh");
    expect(pkg.scripts["pack:dry-run"]).toBe("npm pack --dry-run");
    expect(pkg.scripts["runway:build"]).toBe("node dist/cli.js runway build --from-git --days 3650 --output-dir .runway");
    expect(pkg.scripts["runway:examples"]).toBe("node dist/cli.js runway build --receipts-dir examples --output-dir .runway-examples");
    expect(pkg.scripts["runway:examples:preview"]).toBe("node dist/cli.js runway preview --receipts-dir examples --output-dir .runway-examples-preview");
    expect(pkg.scripts["runway:preview"]).toBe("node dist/cli.js runway preview --from-git --days 3650 --output-dir .runway-preview");

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

  it("keeps GitHub Actions deploying runway from the generated site bundle", async () => {
    const workflow = await readFile(new URL("../.github/workflows/runway-pages.yml", import.meta.url), "utf8");
    const ci = await readFile(new URL("../.github/workflows/ci.yml", import.meta.url), "utf8");

    expect(workflow).toContain("branches:");
    expect(workflow).toContain("- main");
    expect(workflow).toContain("actions/configure-pages@v5");
    expect(workflow).toContain("npm run runway:build");
    expect(workflow).toContain("actions/upload-pages-artifact@v3");
    expect(workflow).toContain("path: ./.runway");
    expect(workflow).toContain("actions/deploy-pages@v4");

    expect(ci).toContain("Runway build smoke");
    expect(ci).toContain("npm run runway:build");
  });
});
