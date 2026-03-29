import { describe, expect, it } from "vitest";
import { chmod, mkdir, mkdtemp, readFile, writeFile, copyFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { main } from "../src-ts/cli.js";
import { computeContentHash } from "../src-ts/scoring/hash-validator.js";

function sampleReceipt(): Record<string, any> {
  return {
    version: "0.1",
    subject: {
      name: "CLITest",
      profiles: [{ kind: "github", url: "https://github.com/clitest" }],
    },
    meta: { created_at: "2026-02-25T12:00:00Z" },
    artifacts: [
      {
        kind: "repo",
        name: "app",
        url: "https://github.com/clitest/app",
        immutable_ref: "abc123",
      },
    ],
  };
}

async function installFakeOts(binDir: string): Promise<void> {
  await mkdir(binDir, { recursive: true });
  const scriptPath = join(binDir, "ots");
  const script = `#!/usr/bin/env bash
set -euo pipefail
cmd="\${1:-}"
if [[ "\${cmd}" == "stamp" ]]; then
  target="\${2:-}"
  if [[ -z "\${target}" ]]; then
    exit 2
  fi
  printf '%s' "fake-ots-proof" > "\${target}.ots"
  exit 0
fi
if [[ "\${cmd}" == "verify" ]]; then
  proof="\${2:-}"
  flag="\${3:-}"
  target="\${4:-}"
  if [[ "\${flag}" != "-f" ]]; then
    exit 2
  fi
  if [[ ! -s "\${proof}" ]]; then
    exit 2
  fi
  if [[ ! -s "\${target}" ]]; then
    exit 2
  fi
  exit 0
fi
exit 2
`;
  await writeFile(scriptPath, script, "utf8");
  await chmod(scriptPath, 0o755);
}

describe("ts cli", () => {
  it("returns 1 with no command", async () => {
    const code = await main([]);
    expect(code).toBe(1);
  });

  it("validate passes for valid receipt", async () => {
    const root = await mkdtemp(join(tmpdir(), "sr-ts-cli-"));
    const file = join(root, "receipt.json");
    await writeFile(file, JSON.stringify(sampleReceipt(), null, 2), "utf8");
    const code = await main(["validate", file]);
    expect(code).toBe(0);
  });

  it("verify alias passes for valid receipt", async () => {
    const root = await mkdtemp(join(tmpdir(), "sr-ts-cli-"));
    const file = join(root, "receipt.json");
    await writeFile(file, JSON.stringify(sampleReceipt(), null, 2), "utf8");
    const code = await main(["verify", file]);
    expect(code).toBe(0);
  });

  it("validate fails when receipt path is missing", async () => {
    const code = await main(["validate"]);
    expect(code).toBe(1);
  });

  it("validate fails on invalid artifact kind", async () => {
    const root = await mkdtemp(join(tmpdir(), "sr-ts-cli-"));
    const bad = sampleReceipt();
    bad.artifacts[0].kind = "invalid";
    const file = join(root, "bad.json");
    await writeFile(file, JSON.stringify(bad, null, 2), "utf8");
    const code = await main(["validate", file]);
    expect(code).toBe(1);
  });

  it("validate fails on invalid verify kind", async () => {
    const root = await mkdtemp(join(tmpdir(), "sr-ts-cli-"));
    const bad = sampleReceipt();
    bad.artifacts[0].verify = [{ kind: "bad-kind" }];
    const file = join(root, "bad-verify.json");
    await writeFile(file, JSON.stringify(bad, null, 2), "utf8");
    const code = await main(["validate", file]);
    expect(code).toBe(1);
  });

  it("validate fails on malformed subject profiles", async () => {
    const root = await mkdtemp(join(tmpdir(), "sr-ts-cli-"));
    const bad = sampleReceipt();
    bad.subject.profiles = [{ kind: "github" }];
    const file = join(root, "bad-profiles.json");
    await writeFile(file, JSON.stringify(bad, null, 2), "utf8");
    const code = await main(["validate", file]);
    expect(code).toBe(1);
  });

  it("validate passes with a well-formed opentimestamps anchor", async () => {
    const root = await mkdtemp(join(tmpdir(), "sr-ts-cli-"));
    const receipt = sampleReceipt();
    receipt.version = "1.2";
    receipt.anchors = [
      {
        kind: "opentimestamps",
        digest_alg: "sha256",
        digest_hex: "a".repeat(64),
        ots_proof: Buffer.from("fake-ots-proof").toString("base64"),
        network: "bitcoin-mainnet",
      },
    ];
    const file = join(root, "anchored.json");
    await writeFile(file, JSON.stringify(receipt, null, 2), "utf8");
    const code = await main(["validate", file]);
    expect(code).toBe(0);
  });

  it("validate fails on malformed opentimestamps anchor", async () => {
    const root = await mkdtemp(join(tmpdir(), "sr-ts-cli-"));
    const receipt = sampleReceipt();
    receipt.version = "1.2";
    receipt.anchors = [
      {
        kind: "opentimestamps",
        digest_alg: "sha256",
        digest_hex: "not-a-digest",
        ots_proof: "%%%not-base64%%%",
      },
    ];
    const file = join(root, "anchored-bad.json");
    await writeFile(file, JSON.stringify(receipt, null, 2), "utf8");
    const code = await main(["validate", file]);
    expect(code).toBe(1);
  });

  it("anchor ots then verify ots succeeds with the ots client", async () => {
    const root = await mkdtemp(join(tmpdir(), "sr-ts-ots-"));
    const fakeBin = join(root, "bin");
    await installFakeOts(fakeBin);

    const receiptFile = join(root, "receipt.json");
    const outFile = join(root, "receipt.anchored.json");
    await writeFile(receiptFile, JSON.stringify(sampleReceipt(), null, 2), "utf8");

    const previousPath = process.env.PATH;
    process.env.PATH = `${fakeBin}:${previousPath ?? ""}`;
    try {
      const anchorCode = await main(["anchor", "ots", receiptFile, "--output", outFile]);
      expect(anchorCode).toBe(0);

      const anchored = JSON.parse(await readFile(outFile, "utf8"));
      expect(anchored.version).toBe("1.2");
      expect(Array.isArray(anchored.anchors)).toBe(true);
      expect(anchored.anchors[0].kind).toBe("opentimestamps");
      expect(anchored.anchors[0].digest_alg).toBe("sha256");
      expect(typeof anchored.anchors[0].digest_hex).toBe("string");
      expect(anchored.anchors[0].digest_hex.length).toBe(64);
      expect(typeof anchored.anchors[0].ots_proof).toBe("string");

      const verifyCode = await main(["verify", "ots", outFile]);
      expect(verifyCode).toBe(0);
    } finally {
      if (previousPath === undefined) {
        delete process.env.PATH;
      } else {
        process.env.PATH = previousPath;
      }
    }
  });

  it("anchor ots fails cleanly when ots client is unavailable", async () => {
    const root = await mkdtemp(join(tmpdir(), "sr-ts-ots-"));
    const receiptFile = join(root, "receipt.json");
    await writeFile(receiptFile, JSON.stringify(sampleReceipt(), null, 2), "utf8");

    const previousPath = process.env.PATH;
    process.env.PATH = root;
    try {
      const code = await main(["anchor", "ots", receiptFile]);
      expect(code).toBe(1);
    } finally {
      if (previousPath === undefined) {
        delete process.env.PATH;
      } else {
        process.env.PATH = previousPath;
      }
    }
  });

  it("score creates local state", async () => {
    const root = await mkdtemp(join(tmpdir(), "sr-ts-cli-"));
    const old = process.cwd();
    try {
      process.chdir(root);
      const file = join(root, "receipt.json");
      await writeFile(file, JSON.stringify(sampleReceipt(), null, 2), "utf8");
      const code = await main(["score", file]);
      expect(code).toBe(0);
      const raw = await readFile(join(root, ".ship-receipts", "game-state.json"), "utf8");
      const state = JSON.parse(raw);
      expect(state.receipts_submitted).toBe(1);
    } finally {
      process.chdir(old);
    }
  });

  it("score fails when receipt path is missing", async () => {
    const code = await main(["score"]);
    expect(code).toBe(1);
  });

  it("score rejects invalid schema shape", async () => {
    const root = await mkdtemp(join(tmpdir(), "sr-ts-cli-"));
    const old = process.cwd();
    try {
      process.chdir(root);
      const bad = {
        version: "0.1",
        subject: { name: "Alice" },
        artifacts: [{ kind: "invalid", name: "x", url: "https://example.com/x" }],
      };
      const file = join(root, "bad-score.json");
      await writeFile(file, JSON.stringify(bad, null, 2), "utf8");
      const code = await main(["score", file]);
      expect(code).toBe(1);
    } finally {
      process.chdir(old);
    }
  });

  it("export writes envelope json", async () => {
    const root = await mkdtemp(join(tmpdir(), "sr-ts-cli-"));
    const old = process.cwd();
    try {
      process.chdir(root);
      const file = join(root, "receipt.json");
      const out = join(root, "out.envelope.json");
      await writeFile(file, JSON.stringify(sampleReceipt(), null, 2), "utf8");
      const code = await main(["export", file, "--output", out]);
      expect(code).toBe(0);
      const raw = await readFile(out, "utf8");
      const envelope = JSON.parse(raw);
      expect(envelope.envelope_version).toBe("1.0");
      expect(envelope.actor.github_username).toBe("clitest");
    } finally {
      process.chdir(old);
    }
  });

  it("export fails when github profile is missing", async () => {
    const root = await mkdtemp(join(tmpdir(), "sr-ts-cli-"));
    const old = process.cwd();
    try {
      process.chdir(root);
      const bad = {
        version: "0.1",
        subject: { name: "NoGithub" },
        artifacts: [{ kind: "repo", name: "x", url: "https://example.com/x" }],
      };
      const file = join(root, "bad-export.json");
      await writeFile(file, JSON.stringify(bad, null, 2), "utf8");
      const code = await main(["export", file]);
      expect(code).toBe(1);
    } finally {
      process.chdir(old);
    }
  });

  it("validate fails on bad hash", async () => {
    const root = await mkdtemp(join(tmpdir(), "sr-ts-cli-"));
    const receipt = sampleReceipt();
    receipt.meta.content_hash = computeContentHash(receipt);
    receipt.artifacts[0].name = "tampered";
    const file = join(root, "tampered.json");
    await writeFile(file, JSON.stringify(receipt, null, 2), "utf8");

    const code = await main(["validate", file]);
    expect(code).toBe(1);
  });

  it("returns 1 for unknown command", async () => {
    const code = await main(["unknown-cmd"]);
    expect(code).toBe(1);
  });

  it("score returns duplicate on second submission", async () => {
    const root = await mkdtemp(join(tmpdir(), "sr-ts-cli-"));
    const old = process.cwd();
    try {
      process.chdir(root);
      const file = join(root, "receipt.json");
      await writeFile(file, JSON.stringify(sampleReceipt(), null, 2), "utf8");
      const first = await main(["score", file]);
      const second = await main(["score", file]);
      expect(first).toBe(0);
      expect(second).toBe(1);
    } finally {
      process.chdir(old);
    }
  });

  it("validate passes on shared parity fixture", async () => {
    const root = await mkdtemp(join(tmpdir(), "sr-ts-cli-"));
    const fixture = join(root, "parity.json");
    await copyFile(join(process.cwd(), "tests-ts", "fixtures", "parity-receipt.json"), fixture);
    const code = await main(["validate", fixture]);
    expect(code).toBe(0);
  });

  it("init creates a valid receipt from flags", async () => {
    const root = await mkdtemp(join(tmpdir(), "sr-ts-init-"));
    const old = process.cwd();
    try {
      process.chdir(root);
      const code = await main([
        "init",
        "--name", "my-repo",
        "--kind", "repo",
        "--url", "https://github.com/test/my-repo",
        "--subject", "Test User",
        "--output", join(root, "out.receipt.json"),
      ]);
      expect(code).toBe(0);
      const data = JSON.parse(await readFile(join(root, "out.receipt.json"), "utf8"));
      expect(data.version).toBe("1.0");
      expect(data.subject.name).toBe("Test User");
      expect(data.artifacts[0].kind).toBe("repo");
      expect(data.artifacts[0].name).toBe("my-repo");
      expect(data.artifacts[0].url).toBe("https://github.com/test/my-repo");
    } finally {
      process.chdir(old);
    }
  });

  it("create alias creates a valid receipt from flags", async () => {
    const root = await mkdtemp(join(tmpdir(), "sr-ts-init-"));
    const old = process.cwd();
    try {
      process.chdir(root);
      const code = await main([
        "create",
        "--name", "my-create-repo",
        "--kind", "repo",
        "--url", "https://github.com/test/my-create-repo",
        "--subject", "Create User",
        "--output", join(root, "create.receipt.json"),
      ]);
      expect(code).toBe(0);
      const data = JSON.parse(await readFile(join(root, "create.receipt.json"), "utf8"));
      expect(data.version).toBe("1.0");
      expect(data.subject.name).toBe("Create User");
      expect(data.artifacts[0].name).toBe("my-create-repo");
    } finally {
      process.chdir(old);
    }
  });

  it("init with --hash includes content_hash", async () => {
    const root = await mkdtemp(join(tmpdir(), "sr-ts-init-"));
    const outFile = join(root, "hashed.receipt.json");
    const code = await main([
      "init",
      "--name", "hashed-pkg",
      "--kind", "package",
      "--url", "https://npmjs.com/package/test",
      "--subject", "Tester",
      "--output", outFile,
      "--hash",
    ]);
    expect(code).toBe(0);
    const data = JSON.parse(await readFile(outFile, "utf8"));
    expect(typeof data.meta.content_hash).toBe("string");
    expect(data.meta.content_hash.length).toBeGreaterThan(0);
  });

  it("init fails on invalid kind in non-TTY", async () => {
    const root = await mkdtemp(join(tmpdir(), "sr-ts-init-"));
    const code = await main([
      "init",
      "--name", "test",
      "--kind", "invalid-kind",
      "--url", "https://example.com",
      "--subject", "Tester",
      "--output", join(root, "out.json"),
    ]);
    expect(code).toBe(1);
  });

  it("init fails when required flag missing in non-TTY", async () => {
    const code = await main([
      "init",
      "--kind", "repo",
      "--url", "https://example.com",
      "--subject", "Tester",
      // missing --name
    ]);
    expect(code).toBe(1);
  });

  it("init output validates against schema", async () => {
    const root = await mkdtemp(join(tmpdir(), "sr-ts-init-"));
    const outFile = join(root, "valid.receipt.json");
    await main([
      "init",
      "--name", "validated-artifact",
      "--kind", "demo",
      "--url", "https://example.com/demo",
      "--subject", "Demo User",
      "--output", outFile,
    ]);
    const code = await main(["validate", outFile]);
    expect(code).toBe(0);
  });

  it("daily renders dashboard in fresh state", async () => {
    const root = await mkdtemp(join(tmpdir(), "sr-ts-daily-"));
    const old = process.cwd();
    try {
      process.chdir(root);
      const code = await main(["daily"]);
      expect(code).toBe(0);
    } finally {
      process.chdir(old);
    }
  });

  it("wellness returns zero receipts in fresh state", async () => {
    const root = await mkdtemp(join(tmpdir(), "sr-ts-wellness-"));
    const old = process.cwd();
    try {
      process.chdir(root);
      const code = await main(["wellness", "--json"]);
      expect(code).toBe(0);
    } finally {
      process.chdir(old);
    }
  });

  it("init --from-git creates receipt from git history", async () => {
    const root = await mkdtemp(join(tmpdir(), "sr-ts-git-"));
    const outFile = join(root, "git.receipt.json");
    // Run from within this repo so git log returns actual commits
    const code = await main([
      "init",
      "--from-git",
      "--days", "3650", // wide window to guarantee commits
      "--author", "Test Builder",
      "--output", outFile,
    ]);
    expect(code).toBe(0);
    const data = JSON.parse(await readFile(outFile, "utf8"));
    expect(data.version).toBe("1.0");
    expect(data.subject.name).toBe("Test Builder");
    expect(data.artifacts[0].kind).toBe("repo");
    expect(typeof data.artifacts[0].immutable_ref).toBe("string");
    expect(data.artifacts[0].verify.length).toBeGreaterThan(0);
  });

  it("init --from-git output validates against schema", async () => {
    const root = await mkdtemp(join(tmpdir(), "sr-ts-git-"));
    const outFile = join(root, "git.receipt.json");
    await main([
      "init",
      "--from-git",
      "--days", "3650",
      "--author", "Schema Test",
      "--output", outFile,
    ]);
    const code = await main(["validate", outFile]);
    expect(code).toBe(0);
  });

  it("mint adds calibration fields from context store", async () => {
    const root = await mkdtemp(join(tmpdir(), "sr-ts-mint-"));
    const receiptFile = join(root, "receipt.json");
    const contextStore = join(root, "context-store.jsonl");
    const outFile = join(root, "minted.receipt.json");

    await writeFile(receiptFile, JSON.stringify(sampleReceipt(), null, 2), "utf8");
    await writeFile(contextStore, [
      JSON.stringify({
        type: "verification_outcome",
        agent_name: "codex",
        shot_call_confidence: 0.9,
        verification_result: "pass",
      }),
      JSON.stringify({
        type: "verification_outcome",
        agent_name: "codex",
        shot_call_confidence: 0.8,
        verification_result: "fail",
      }),
      JSON.stringify({
        type: "verification_outcome",
        agent_name: "rowan",
        shot_call_confidence: 0.7,
        verification_result: "pass",
      }),
    ].join("\n") + "\n", "utf8");

    const code = await main([
      "mint",
      receiptFile,
      "--agent", "codex",
      "--context-store", contextStore,
      "--verification-result", "pass",
      "--confidence", "0.87",
      "--dr-signal", "SHIP",
      "--output", outFile,
    ]);
    expect(code).toBe(0);

    const minted = JSON.parse(await readFile(outFile, "utf8"));
    expect(minted.version).toBe("1.1");
    expect(minted.agent).toBe("codex");
    expect(minted.agent_calibration_score).toBe(0.325);
    expect(minted.agent_predictions_n).toBe(2);
    expect(minted.shot_call_confidence).toBe(0.87);
    expect(minted.verification_result).toBe("pass");
    expect(minted.dr_signal).toBe("SHIP");
    expect(minted.meta.schema_version).toBe("1.1");
    expect(typeof minted.meta.content_hash).toBe("string");
    expect(minted.meta.content_hash.startsWith("sha256:")).toBe(true);
  });

  it("mint proceeds with null calibration when context store is unavailable", async () => {
    const root = await mkdtemp(join(tmpdir(), "sr-ts-mint-"));
    const receiptFile = join(root, "receipt.json");
    const outFile = join(root, "minted.receipt.json");
    await writeFile(receiptFile, JSON.stringify(sampleReceipt(), null, 2), "utf8");

    const code = await main([
      "mint",
      receiptFile,
      "--agent", "codex",
      "--context-store", join(root, "missing-context.jsonl"),
      "--output", outFile,
    ]);
    expect(code).toBe(0);

    const minted = JSON.parse(await readFile(outFile, "utf8"));
    expect(minted.agent_calibration_score).toBeNull();
    expect(minted.agent_predictions_n).toBeNull();
    expect(minted.verification_result).toBe("skipped");
  });

  it("mint fails with clear error when flag value is missing", async () => {
    const root = await mkdtemp(join(tmpdir(), "sr-ts-mint-"));
    const receiptFile = join(root, "receipt.json");
    await writeFile(receiptFile, JSON.stringify(sampleReceipt(), null, 2), "utf8");

    const code = await main([
      "mint",
      receiptFile,
      "--output",
      "--agent",
      "codex",
    ]);
    expect(code).toBe(1);
  });

  it("mint falls back to codex when SHIP_RECEIPTS_AGENT is empty", async () => {
    const root = await mkdtemp(join(tmpdir(), "sr-ts-mint-"));
    const receiptFile = join(root, "receipt.json");
    const outFile = join(root, "minted.receipt.json");
    await writeFile(receiptFile, JSON.stringify(sampleReceipt(), null, 2), "utf8");

    const previous = process.env.SHIP_RECEIPTS_AGENT;
    process.env.SHIP_RECEIPTS_AGENT = "";
    try {
      const code = await main([
        "mint",
        receiptFile,
        "--context-store", join(root, "missing-context.jsonl"),
        "--output", outFile,
      ]);
      expect(code).toBe(0);
      const minted = JSON.parse(await readFile(outFile, "utf8"));
      expect(minted.agent).toBe("codex");
    } finally {
      if (previous === undefined) {
        delete process.env.SHIP_RECEIPTS_AGENT;
      } else {
        process.env.SHIP_RECEIPTS_AGENT = previous;
      }
    }
  });

  it("goal set stores goal in game-state.json", async () => {
    const root = await mkdtemp(join(tmpdir(), "sr-ts-goal-"));
    const old = process.cwd();
    try {
      process.chdir(root);
      const code = await main(["goal", "set", "Get one project to revenue"]);
      expect(code).toBe(0);
      const state = JSON.parse(await readFile(join(root, ".ship-receipts", "game-state.json"), "utf8"));
      expect(state.odyssey.ithaca).toBe("Get one project to revenue");
      expect(state.odyssey.completed).toBe(false);
    } finally {
      process.chdir(old);
    }
  });

  it("goal status shows goal after set", async () => {
    const root = await mkdtemp(join(tmpdir(), "sr-ts-goal-"));
    const old = process.cwd();
    try {
      process.chdir(root);
      await main(["goal", "set", "Ship something useful"]);
      const code = await main(["goal", "status"]);
      expect(code).toBe(0);
    } finally {
      process.chdir(old);
    }
  });

  it("goal complete marks goal done", async () => {
    const root = await mkdtemp(join(tmpdir(), "sr-ts-goal-"));
    const old = process.cwd();
    try {
      process.chdir(root);
      await main(["goal", "set", "Reach the stars"]);
      const code = await main(["goal", "complete"]);
      expect(code).toBe(0);
      const state = JSON.parse(await readFile(join(root, ".ship-receipts", "game-state.json"), "utf8"));
      expect(state.odyssey.completed).toBe(true);
      expect(typeof state.odyssey.completed_at).toBe("string");
    } finally {
      process.chdir(old);
    }
  });

  it("goal complete fails when no goal set", async () => {
    const root = await mkdtemp(join(tmpdir(), "sr-ts-goal-"));
    const old = process.cwd();
    try {
      process.chdir(root);
      const code = await main(["goal", "complete"]);
      expect(code).toBe(1);
    } finally {
      process.chdir(old);
    }
  });
});
