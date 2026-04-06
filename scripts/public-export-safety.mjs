#!/usr/bin/env node
import { readdir, readFile } from "node:fs/promises";
import { resolve, relative } from "node:path";

export const DEFAULT_PATTERNS = [
  { pattern: /file:\/\//g, label: "file URI" },
  { pattern: /\/Users\//g, label: "macOS home path" },
  { pattern: /\/home\//g, label: "Linux home path" },
  { pattern: /~\//g, label: "tilde home path" },
  { pattern: /ship-receipts-private/g, label: "private repo name" },
  { pattern: /proofofship-private/g, label: "private verifier repo name" },
  { pattern: /https:\/\/github\.com\/Pro777\/ship-receipts\b/g, label: "legacy ship-receipts repo URL" },
  { pattern: /git@github\.com:Pro777\/ship-receipts(?:\.git)?\b/g, label: "legacy ship-receipts SSH URL" },
  { pattern: /https:\/\/github\.com\/Pro777\/proofofship\b/g, label: "legacy proofofship repo URL" },
  { pattern: /git@github\.com:Pro777\/proofofship(?:\.git)?\b/g, label: "legacy proofofship SSH URL" },
];

async function collectFiles(rootDir) {
  const files = [];
  const entries = await readdir(rootDir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = resolve(rootDir, entry.name);
    if (entry.isDirectory()) {
      files.push(...await collectFiles(fullPath));
      continue;
    }
    if (entry.isFile()) {
      files.push(fullPath);
    }
  }
  return files;
}

function findPatternMatches(content) {
  const findings = [];
  for (const { pattern, label } of DEFAULT_PATTERNS) {
    const matches = content.match(pattern);
    if (!matches) {
      continue;
    }
    findings.push({ label, count: matches.length });
  }
  return findings;
}

export async function scanTreeForLeakPatterns(rootDir) {
  const resolvedRoot = resolve(rootDir);
  const files = await collectFiles(resolvedRoot);
  const findings = [];

  for (const filePath of files) {
    const content = await readFile(filePath, "utf8");
    const matches = findPatternMatches(content);
    if (matches.length === 0) {
      continue;
    }
    findings.push({
      path: relative(resolvedRoot, filePath) || ".",
      matches,
    });
  }

  return findings;
}

async function main(argv) {
  const rootDir = argv[0];
  if (!rootDir) {
    console.error("usage: node scripts/public-export-safety.mjs <dir>");
    return 2;
  }

  const findings = await scanTreeForLeakPatterns(rootDir);
  if (findings.length === 0) {
    console.log("public export safety check passed");
    return 0;
  }

  for (const finding of findings) {
    for (const match of finding.matches) {
      console.error(`${finding.path}: ${match.label} (${match.count})`);
    }
  }
  console.error("error: public export leak pattern(s) detected");
  return 1;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const code = await main(process.argv.slice(2));
  process.exit(code);
}
