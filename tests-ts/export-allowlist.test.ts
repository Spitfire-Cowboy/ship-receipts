import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

function parseYamlList(content: string, key: string): string[] {
  const lines = content.split("\n");
  const values: string[] = [];
  let inSection = false;

  for (const line of lines) {
    if (line.startsWith(`${key}:`)) {
      inSection = true;
      continue;
    }
    if (inSection && /^[A-Za-z0-9_-]+:/.test(line)) {
      break;
    }
    const match = line.match(/^\s*-\s+(.+)$/);
    if (inSection && match) {
      values.push(match[1].trim());
    }
  }

  return values;
}

describe("public export allowlist", () => {
  it("covers every file group shipped in the npm package", async () => {
    const pkg = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
    const allowlist = await readFile(new URL("../export/public-allowlist.yml", import.meta.url), "utf8");
    const include = parseYamlList(allowlist, "include");

    const shipped = new Set<string>(pkg.files ?? []);
    shipped.add("README.md");
    shipped.add("LICENSE");
    shipped.add("package.json");

    for (const entry of shipped) {
      expect(
        include.includes(entry) || include.includes(`${entry}/**`),
      ).toBe(true);
    }
  });

  it("keeps source and build config paths exportable for public rebuilds", async () => {
    const allowlist = await readFile(new URL("../export/public-allowlist.yml", import.meta.url), "utf8");
    const include = parseYamlList(allowlist, "include");
    const required = parseYamlList(allowlist, "required");

    expect(include).toEqual(
      expect.arrayContaining([
        "src-ts/**",
        "tsconfig.json",
        "vitest.config.ts",
      ]),
    );

    expect(required).toEqual(
      expect.arrayContaining([
        "README.md",
        "LICENSE",
        "package.json",
        "src-ts/cli.ts",
      ]),
    );
  });
});
