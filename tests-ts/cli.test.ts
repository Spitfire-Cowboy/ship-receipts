import { afterEach, describe, expect, it, vi } from "vitest";
import { chmod, mkdir, mkdtemp, readFile, writeFile, copyFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { main } from "../src-ts/cli.js";
import { computeContentHash } from "../src-ts/scoring/hash-validator.js";

function sampleReceipt(overrides: Record<string, any> = {}): Record<string, any> {
  const artifactOverrides = overrides.artifacts?.[0] ?? {};
  const artifacts = overrides.artifacts ?? [
    {
      kind: artifactOverrides.kind ?? "repo",
      name: artifactOverrides.name ?? "app",
      url: artifactOverrides.url ?? "https://github.com/clitest/app",
      immutable_ref: artifactOverrides.immutable_ref ?? "abc123",
    },
  ];

  return {
    version: "0.1",
    receipt_id: overrides.receipt_id ?? "urn:ship-receipt:test:sample",
    issued_at: overrides.issued_at,
    subject: {
      name: overrides.subject?.name ?? "CLITest",
      profiles: overrides.subject?.profiles ?? [{ kind: "github", url: "https://github.com/clitest" }],
    },
    meta: { created_at: overrides.meta?.created_at ?? "2026-02-25T12:00:00Z" },
    artifacts,
  };
}

function sampleShipReceipt(overrides: Record<string, any> = {}): Record<string, any> {
  const eventOverrides = overrides.event ?? {};
  return {
    schema: "ship-receipt/v1",
    receipt_id: overrides.receipt_id ?? "rcpt_evt_2026-04-08_cli_runway",
    issued_at: overrides.issued_at ?? "2026-04-08T12:00:00Z",
    event: {
      event_id: eventOverrides.event_id ?? "evt_2026-04-08_cli_runway",
      event_hash: eventOverrides.event_hash ?? "abc123",
      signal: "SHIP",
      work_id: eventOverrides.work_id ?? "ship-receipts/runway",
      actor: eventOverrides.actor ?? "agent:codex",
      summary: eventOverrides.summary ?? "Ship runway from the CLI",
      artifacts: eventOverrides.artifacts ?? ["dist/index.html"],
      pr: eventOverrides.pr ?? "https://github.com/Spitfire-Cowboy/ship-receipts/pull/24",
      commit: eventOverrides.commit ?? "0123456789abcdef0123456789abcdef01234567",
    },
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
  cat "\${target}" > "\${target}.ots"
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
  cmp -s "\${proof}" "\${target}" || exit 2
  exit 0
fi
exit 2
`;
  await writeFile(scriptPath, script, "utf8");
  await chmod(scriptPath, 0o755);
}

function git(cwd: string, args: string[], env: Record<string, string> = {}): string {
  return execFileSync("git", args, {
    cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    env: {
      ...process.env,
      ...env,
    },
  }).trim();
}

describe("ts cli", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

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

  it("validate passes with a well-formed media entry", async () => {
    const root = await mkdtemp(join(tmpdir(), "sr-ts-cli-"));
    const receipt = sampleReceipt();
    receipt.media = [
      {
        kind: "proof-card",
        format: "png",
        path: "renders/proof-card.png",
        content_hash: `sha256:${"a".repeat(64)}`,
        derived_from: `sha256:${"b".repeat(64)}`,
        renderer: { name: "ship-receipts", version: "0.1.0" },
      },
    ];
    const file = join(root, "media.json");
    await writeFile(file, JSON.stringify(receipt, null, 2), "utf8");
    const code = await main(["validate", file]);
    expect(code).toBe(0);
  });

  it("validate fails on malformed media entry", async () => {
    const root = await mkdtemp(join(tmpdir(), "sr-ts-cli-"));
    const receipt = sampleReceipt();
    receipt.media = [
      {
        kind: "proof-card",
        format: "exe",
        renderer: { name: "ship-receipts" },
      },
    ];
    const file = join(root, "bad-media.json");
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
      expect(Buffer.from(anchored.anchors[0].ots_proof, "base64")).toEqual(
        Buffer.from(anchored.anchors[0].digest_hex, "hex"),
      );

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

  it("render writes a manifest and attached receipt copy", async () => {
    const root = await mkdtemp(join(tmpdir(), "sr-ts-render-"));
    const receiptFile = join(root, "receipt.json");
    const assetFile = join(root, "proof-card.png");
    const manifestFile = join(root, "proof-card.render.json");
    const attachedFile = join(root, "receipt.rendered.json");

    await writeFile(receiptFile, JSON.stringify(sampleReceipt(), null, 2), "utf8");
    await writeFile(assetFile, "fake-png-data", "utf8");

    const code = await main([
      "render",
      receiptFile,
      "--preset", "proof-card",
      "--asset", assetFile,
      "--output", manifestFile,
      "--attach", attachedFile,
    ]);
    expect(code).toBe(0);

    const manifest = JSON.parse(await readFile(manifestFile, "utf8"));
    expect(manifest.preset).toBe("proof-card");
    expect(manifest.media[0].format).toBe("png");
    expect(manifest.media[0].content_hash.startsWith("sha256:")).toBe(true);

    const attached = JSON.parse(await readFile(attachedFile, "utf8"));
    expect(Array.isArray(attached.media)).toBe(true);
    expect(attached.media[0].kind).toBe("proof-card");
    expect(attached.meta.content_hash.startsWith("sha256:")).toBe(true);
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

  it("daily watch supports a no-clear mode for screen readers", async () => {
    const root = await mkdtemp(join(tmpdir(), "sr-ts-daily-a11y-"));
    const old = process.cwd();
    const write = vi.spyOn(process.stdout, "write").mockImplementation(() => true);
    const log = vi.spyOn(console, "log").mockImplementation(() => {});

    try {
      process.chdir(root);
      const run = main(["daily", "--watch", "--no-clear", "--interval", "999"]);
      setTimeout(() => process.emit("SIGINT"), 0);
      const code = await run;
      expect(code).toBe(0);
      expect(write).not.toHaveBeenCalledWith("\x1b[2J\x1b[H");
      expect(log.mock.calls.some((call) => String(call[0]).includes("ship-receipts daily"))).toBe(true);
    } finally {
      write.mockRestore();
      log.mockRestore();
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

  it("simulate replays historical receipts without mutating live state", async () => {
    const root = await mkdtemp(join(tmpdir(), "sr-ts-sim-"));
    const receiptsDir = join(root, ".ship-receipts", "receipts");
    const old = process.cwd();
    const log = vi.spyOn(console, "log").mockImplementation(() => {});

    try {
      process.chdir(root);
      await mkdir(receiptsDir, { recursive: true });

      const first = sampleReceipt();
      first.meta.created_at = "2026-03-01T10:00:00Z";
      first.artifacts[0].immutable_ref = "abc123";

      const second = sampleReceipt();
      second.meta.created_at = "2026-03-02T10:00:00Z";
      second.artifacts[0].immutable_ref = "def456";

      await writeFile(join(receiptsDir, "second.json"), JSON.stringify(second, null, 2), "utf8");
      await writeFile(join(receiptsDir, "first.json"), JSON.stringify(first, null, 2), "utf8");

      const code = await main(["simulate", "--json"]);
      expect(code).toBe(0);

      const payload = JSON.parse(log.mock.calls.at(-1)?.[0] as string);
      expect(payload.receipts_processed).toBe(2);
      expect(payload.accepted).toBe(2);
      expect(payload.longest_streak).toBe(2);
      expect(payload.final_score).toBeGreaterThan(0);
      await expect(readFile(join(root, ".ship-receipts", "game-state.json"), "utf8")).rejects.toMatchObject({
        code: "ENOENT",
      });
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
        agent_name: "example-agent",
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

  it("runway build exports a static viewer from ship-receipt v1 files", async () => {
    const root = await mkdtemp(join(tmpdir(), "sr-ts-runway-"));
    const validA = join(root, "a.receipt.json");
    const validB = join(root, "b.receipt.json");
    const ignored = join(root, "ignored.receipt.json");
    const outDir = join(root, "runway");

    await writeFile(validA, JSON.stringify(sampleShipReceipt(), null, 2), "utf8");
    await writeFile(validB, JSON.stringify(sampleShipReceipt({
      receipt_id: "rcpt_evt_2026-04-09_cli_runway",
      issued_at: "2026-04-09T09:30:00Z",
      event: {
        work_id: "ship-receipts/release",
        summary: "Publish a release candidate",
        artifacts: ["dist/ship-receipts.tgz", "CHANGELOG.md"],
      },
    }), null, 2), "utf8");
    await writeFile(ignored, JSON.stringify({ version: "0.1", artifacts: [] }, null, 2), "utf8");

    const code = await main(["runway", "build", validA, ignored, validB, "--output-dir", outDir]);
    expect(code).toBe(0);

    const indexHtml = await readFile(join(outDir, "index.html"), "utf8");
    const feed = JSON.parse(await readFile(join(outDir, "receipts.json"), "utf8"));

    expect(indexHtml).toContain("ship-receipts runway");
    expect(indexHtml).toContain("./receipts.json");
    expect(feed).toHaveLength(2);
    expect(feed[0].receipt_id).toBe("rcpt_evt_2026-04-09_cli_runway");
    expect(feed[1].receipt_id).toBe("rcpt_evt_2026-04-08_cli_runway");
  });

  it("runway build accepts legacy receipt documents with receipt_id metadata", async () => {
    const root = await mkdtemp(join(tmpdir(), "sr-ts-runway-legacy-"));
    const legacy = join(root, "legacy.receipt.json");
    const outDir = join(root, "runway");

    await writeFile(legacy, JSON.stringify(sampleReceipt({
      version: "1.0",
      receipt_id: "urn:ship-receipt:legacy:one",
      meta: { created_at: "2026-04-07T10:00:00Z" },
      subject: { name: "Legacy Builder" },
      artifacts: [
        {
          kind: "repo",
          name: "legacy-app",
          url: "https://github.com/legacy/app",
          immutable_ref: "deadbeef",
        },
      ],
    }), null, 2), "utf8");

    const code = await main(["runway", "build", legacy, "--output-dir", outDir]);
    expect(code).toBe(0);

    const feed = JSON.parse(await readFile(join(outDir, "receipts.json"), "utf8"));
    expect(feed).toHaveLength(1);
    expect(feed[0].schema).toBe("ship-receipt/v1");
    expect(feed[0].receipt_id).toBe("urn:ship-receipt:legacy:one");
    expect(feed[0].event.work_id).toBe("legacy-builder/legacy-app");
    expect(feed[0].event.actor).toBe("subject:legacy-builder");
    expect(feed[0].event.summary).toContain("legacy-app");
  });

  it("runway build accepts a prebuilt feed file", async () => {
    const root = await mkdtemp(join(tmpdir(), "sr-ts-runway-feed-"));
    const feedPath = join(root, "feed.json");
    const outDir = join(root, "runway");

    await writeFile(feedPath, JSON.stringify([
      sampleShipReceipt({
        receipt_id: "rcpt_evt_feed_one",
        issued_at: "2026-04-07T10:00:00Z",
      }),
      sampleShipReceipt({
        receipt_id: "rcpt_evt_feed_two",
        issued_at: "2026-04-08T10:00:00Z",
      }),
    ], null, 2), "utf8");

    const code = await main(["runway", "build", "--feed", feedPath, "--output-dir", outDir]);
    expect(code).toBe(0);

    const feed = JSON.parse(await readFile(join(outDir, "receipts.json"), "utf8"));
    expect(feed).toHaveLength(2);
    expect(feed[0].receipt_id).toBe("rcpt_evt_feed_two");
    expect(feed[1].receipt_id).toBe("rcpt_evt_feed_one");
  });

  it("runway build can generate a feed directly from git history", async () => {
    const root = await mkdtemp(join(tmpdir(), "sr-ts-runway-git-"));
    const outDir = join(root, "runway");

    git(root, ["init"]);
    git(root, ["config", "user.name", "Test Builder"]);
    git(root, ["config", "user.email", "test@example.com"]);
    git(root, ["remote", "add", "origin", "git@github.com:Spitfire-Cowboy/ship-receipts.git"]);

    await mkdir(join(root, "src-ts"), { recursive: true });
    await mkdir(join(root, "docs"), { recursive: true });
    await writeFile(join(root, "src-ts", "alpha.ts"), "export const alpha = 1;\n", "utf8");
    git(root, ["add", "."], {
      GIT_AUTHOR_DATE: "2026-04-07T10:00:00Z",
      GIT_COMMITTER_DATE: "2026-04-07T10:00:00Z",
    });
    git(root, ["commit", "-m", "feat(runway): add generator (#24)"], {
      GIT_AUTHOR_DATE: "2026-04-07T10:00:00Z",
      GIT_COMMITTER_DATE: "2026-04-07T10:00:00Z",
    });

    await writeFile(join(root, "docs", "guide.md"), "# guide\n", "utf8");
    git(root, ["add", "."], {
      GIT_AUTHOR_DATE: "2026-04-08T11:30:00Z",
      GIT_COMMITTER_DATE: "2026-04-08T11:30:00Z",
    });
    git(root, ["commit", "-m", "docs: add runway guide"], {
      GIT_AUTHOR_DATE: "2026-04-08T11:30:00Z",
      GIT_COMMITTER_DATE: "2026-04-08T11:30:00Z",
    });

    const old = process.cwd();
    try {
      process.chdir(root);
      const code = await main(["runway", "build", "--from-git", "--days", "3650", "--output-dir", outDir]);
      expect(code).toBe(0);
    } finally {
      process.chdir(old);
    }

    const feed = JSON.parse(await readFile(join(outDir, "receipts.json"), "utf8"));
    expect(feed).toHaveLength(2);
    expect(feed[0].event.work_id).toBe("ship-receipts/docs");
    expect(feed[0].event.actor).toBe("agent:test-builder");
    expect(feed[1].event.work_id).toBe("ship-receipts/src-ts");
    expect(feed[1].event.pr).toBe("https://github.com/Spitfire-Cowboy/ship-receipts/pull/24");
    expect(feed[0].proof.method).toBe("sha256-canonical-json");
  });
});
