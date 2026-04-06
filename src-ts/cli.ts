#!/usr/bin/env node
import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { basename, resolve, join } from "node:path";
import { homedir, tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { execFileSync, execSync } from "node:child_process";
import * as readline from "node:readline";
import { computeBaseScore, streakMultiplier } from "./scoring/engine.js";
import { GameState } from "./scoring/state.js";
import { computeContentHash, validateContentHash } from "./scoring/hash-validator.js";
import { exportProofEnvelope, readGameStateIfPresent } from "./envelope/export.js";
import { readAgentCalibration, type VerificationResult } from "./calibration.js";

type JsonObject = Record<string, any>;
const VALID_ARTIFACT_KINDS = new Set(["repo", "release", "package", "dataset", "paper", "demo", "disclosure", "community_contribution", "wellness", "session_replay", "other"]);
const VALID_VERIFY_KINDS = new Set(["command", "checksum", "note", "link", "attestation"]);
const VALID_VERIFICATION_RESULTS = new Set<VerificationResult>(["pass", "fail", "skipped"]);
const VALID_DR_SIGNALS = new Set(["SHIP", "CONTINUE", "ESCALATE"]);

function usage(): string {
  return `ship-receipts CLI (TypeScript port)

Usage:
  ship-receipts score <receipt.json>
  ship-receipts validate <receipt.json>
  ship-receipts verify <receipt.json>
  ship-receipts verify ots <receipt.json>
  ship-receipts anchor ots <receipt.json> [--output <file>] [--network <name>]
  ship-receipts mint <receipt.json> [--output <file>] [--agent <name>] [--context-store <path>] [--confidence <0..1>] [--verification-result <pass|fail|skipped>] [--dr-signal <SHIP|CONTINUE|ESCALATE>]
  ship-receipts export <receipt.json> [--output <file>]
  ship-receipts streak
  ship-receipts init [--name <name>] [--kind <kind>] [--url <url>] [--subject <name>] [--output <file>] [--hash]
  ship-receipts create [--name <name>] [--kind <kind>] [--url <url>] [--subject <name>] [--output <file>] [--hash]
  ship-receipts init --from-git [--days <n>] [--author <name>] [--output <file>] [--hash]
  ship-receipts create --from-git [--days <n>] [--author <name>] [--output <file>] [--hash]
  ship-receipts goal set "<text>"
  ship-receipts goal status
  ship-receipts goal complete
  ship-receipts wellness [--json]
  ship-receipts daily [--watch] [--interval <seconds>]
  ship-receipts simulate [<receipt.json> ...] [--receipts-dir <dir>] [--json]`;
}

async function prompt(question: string): Promise<string> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => rl.question(question, (ans) => { rl.close(); resolve(ans.trim()); }));
}

function parseInitArgs(argv: string[]): {
  name?: string; kind?: string; url?: string; subject?: string; output?: string; hash: boolean;
  fromGit: boolean; days: number; author?: string;
} {
  const opts: {
    name?: string; kind?: string; url?: string; subject?: string; output?: string; hash: boolean;
    fromGit: boolean; days: number; author?: string;
  } = { hash: false, fromGit: false, days: 7 };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--name" && argv[i + 1]) opts.name = argv[++i];
    else if (argv[i] === "--kind" && argv[i + 1]) opts.kind = argv[++i];
    else if (argv[i] === "--url" && argv[i + 1]) opts.url = argv[++i];
    else if (argv[i] === "--subject" && argv[i + 1]) opts.subject = argv[++i];
    else if (argv[i] === "--output" && argv[i + 1]) opts.output = argv[++i];
    else if (argv[i] === "--hash") opts.hash = true;
    else if (argv[i] === "--no-hash") opts.hash = false;
    else if (argv[i] === "--from-git") opts.fromGit = true;
    else if (argv[i] === "--days" && argv[i + 1]) opts.days = parseInt(argv[++i], 10);
    else if (argv[i] === "--author" && argv[i + 1]) opts.author = argv[++i];
  }
  return opts;
}

function gitExec(cmd: string): string {
  try {
    return execSync(cmd, { encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] }).trim();
  } catch {
    return "";
  }
}

async function cmdInitFromGit(opts: ReturnType<typeof parseInitArgs>): Promise<number> {
  // Get repo origin URL
  const repoUrl = gitExec("git remote get-url origin");
  if (!repoUrl) {
    console.error("error: not in a git repo or no origin remote");
    return 1;
  }

  // Get subject from git config or --author flag
  const subject = opts.author ?? (gitExec("git config user.name") || "unknown");

  // Get commits from the last N days
  const since = new Date(Date.now() - opts.days * 86400 * 1000).toISOString();
  const logOutput = gitExec(`git log --since="${since}" --format="%H|%s|%ai" HEAD`);
  if (!logOutput) {
    console.log(`No commits found in the last ${opts.days} days.`);
    return 0;
  }

  const commits = logOutput.split("\n").filter(Boolean).map((line) => {
    const [sha, msg, date] = line.split("|");
    return { sha: sha?.trim(), msg: msg?.trim(), date: date?.trim() };
  }).filter((c) => c.sha && c.msg);

  if (commits.length === 0) {
    console.log(`No commits found in the last ${opts.days} days.`);
    return 0;
  }

  // Build artifact name from repo URL (last path segment)
  const repoName = repoUrl.replace(/\.git$/, "").split("/").pop() ?? "repo";

  const now = new Date().toISOString().replace(/\.\d+Z$/, "Z");
  const dateSlug = now.slice(0, 10);

  const receipt: JsonObject = {
    version: "1.0",
    issued_at: now,
    subject: { name: subject },
    artifacts: [
      {
        kind: "repo",
        name: repoName,
        url: repoUrl.startsWith("git@")
          ? repoUrl.replace("git@github.com:", "https://github.com/").replace(/\.git$/, "")
          : repoUrl.replace(/\.git$/, ""),
        immutable_ref: commits[0].sha,
        verify: commits.map((c) => ({
          kind: "note" as const,
          note: `${c.sha!.slice(0, 12)}: ${c.msg}`,
          observed_at: c.date ? new Date(c.date).toISOString() : now,
        })),
      },
    ],
    meta: { created_at: now, generator: "ship-receipts-ts", source: "git-log" },
  };

  if (opts.hash) {
    receipt.meta.content_hash = computeContentHash(receipt);
  }

  // Write to .ship-receipts/receipts/ by default
  const defaultOutput = join(".ship-receipts", "receipts", `${dateSlug}-git.receipt.json`);
  const outputPath = resolve(opts.output ?? defaultOutput);

  // Ensure directory exists
  const { mkdir: mkdirAsync } = await import("node:fs/promises");
  await mkdirAsync(resolve(join(".ship-receipts", "receipts")), { recursive: true }).catch(() => {});

  try {
    await writeFile(outputPath, JSON.stringify(receipt, null, 2) + "\n", "utf8");
  } catch (e: any) {
    console.error(`error: could not write ${outputPath}: ${e?.message}`);
    return 2;
  }

  console.log(`Created: ${outputPath}`);
  console.log(`  Subject: ${subject}`);
  console.log(`  Repo:    ${repoUrl}`);
  console.log(`  Commits: ${commits.length} (last ${opts.days} days)`);
  if (opts.hash) console.log(`  Hash:    ${receipt.meta.content_hash}`);
  return 0;
}

async function cmdInit(argv: string[]): Promise<number> {
  const opts = parseInitArgs(argv);
  if (opts.fromGit) return cmdInitFromGit(opts);
  const isTTY = process.stdin.isTTY;

  async function requireField(value: string | undefined, flag: string, label: string): Promise<string | null> {
    if (value !== undefined) return value;
    if (!isTTY) {
      console.error(`error: --${flag} is required when stdin is not a terminal`);
      return null;
    }
    let result = "";
    while (!result) {
      result = await prompt(`${label}: `);
      if (!result) console.error(`  error: ${label} cannot be empty`);
    }
    return result;
  }

  const name = await requireField(opts.name, "name", "Artifact name");
  if (name === null) return 1;

  const kind = await requireField(opts.kind, "kind", "Kind");
  if (kind === null) return 1;

  const url = await requireField(opts.url, "url", "Artifact URL");
  if (url === null) return 1;

  const subject = await requireField(opts.subject, "subject", "Builder name (subject)");
  if (subject === null) return 1;

  if (!VALID_ARTIFACT_KINDS.has(kind)) {
    console.error(`error: invalid kind '${kind}'. Must be one of: ${[...VALID_ARTIFACT_KINDS].join(", ")}`);
    return 1;
  }

  const now = new Date().toISOString().replace(/\.\d+Z$/, "Z");
  const receipt: JsonObject = {
    version: "1.0",
    subject: { name: subject },
    artifacts: [{ kind, name, url }],
    meta: { created_at: now, generator: "ship-receipts-ts" },
  };

  if (opts.hash) {
    const hash = computeContentHash(receipt);
    receipt.meta.content_hash = hash;
  }

  const slug = name.toLowerCase().replace(/\s+/g, "-");
  const outputPath = resolve(opts.output ?? `${slug}.receipt.json`);

  try {
    await writeFile(outputPath, JSON.stringify(receipt, null, 2) + "\n", "utf8");
  } catch (e: any) {
    console.error(`error: could not write ${outputPath}: ${e?.message}`);
    return 2;
  }

  console.log(`Created: ${outputPath}`);
  if (opts.hash) console.log(`Hash:    ${receipt.meta.content_hash}`);
  return 0;
}

async function loadJson(path: string): Promise<JsonObject> {
  const raw = await readFile(path, "utf8");
  return JSON.parse(raw);
}

async function collectSimulationReceiptPaths(argv: string[]): Promise<string[]> {
  const positional: string[] = [];
  let receiptsDir = join(".ship-receipts", "receipts");

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--receipts-dir") {
      const next = argv[i + 1];
      if (!next) {
        throw new Error("missing value for --receipts-dir");
      }
      receiptsDir = next;
      i += 1;
      continue;
    }
    if (arg === "--json") continue;
    positional.push(arg);
  }

  if (positional.length > 0) {
    return positional.map((path) => resolve(path));
  }

  const dirPath = resolve(receiptsDir);
  const entries = await readdir(dirPath, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
    .map((entry) => join(dirPath, entry.name))
    .sort();
}

type SimulationStep = {
  path: string;
  created_at: string;
  status: string;
  score: number;
  streak: number;
  reason?: string;
};

type SimulationSummary = {
  receipts_processed: number;
  accepted: number;
  rejected: number;
  duplicates: number;
  final_score: number;
  current_streak: number;
  longest_streak: number;
  milestones: Array<Record<string, any>>;
  steps: SimulationStep[];
};

async function cmdSimulate(argv: string[]): Promise<number> {
  const jsonMode = argv.includes("--json");
  const receiptPaths = await collectSimulationReceiptPaths(argv);
  if (receiptPaths.length === 0) {
    console.error("error: no receipt files found for simulation");
    return 1;
  }

  const loaded = await Promise.all(
    receiptPaths.map(async (path) => ({ path, receipt: await loadJson(path) })),
  );

  loaded.sort((left, right) => {
    const leftCreated = String(left.receipt?.meta?.created_at ?? "");
    const rightCreated = String(right.receipt?.meta?.created_at ?? "");
    if (leftCreated && rightCreated && leftCreated !== rightCreated) {
      return leftCreated.localeCompare(rightCreated);
    }
    return left.path.localeCompare(right.path);
  });

  const state = GameState.fresh(resolve("."));
  const summary: SimulationSummary = {
    receipts_processed: loaded.length,
    accepted: 0,
    rejected: 0,
    duplicates: 0,
    final_score: 0,
    current_streak: 0,
    longest_streak: 0,
    milestones: [],
    steps: [],
  };

  for (const { path, receipt } of loaded) {
    const schemaErrors = validateReceiptShape(receipt);
    const createdAt = String(receipt?.meta?.created_at ?? "");
    const scoreDate = createdAt ? createdAt.slice(0, 10) : undefined;
    const eventTimestamp = createdAt || undefined;

    if (schemaErrors.length > 0) {
      summary.rejected += 1;
      summary.steps.push({
        path,
        created_at: createdAt,
        status: "REJECTED",
        score: 0,
        streak: state.state.streak?.current ?? 0,
        reason: schemaErrors.join("; "),
      });
      continue;
    }

    const result = state.scoreReceipt(receipt, { scoreDate, eventTimestamp });
    if (result.status === "ACCEPTED") summary.accepted += 1;
    if (result.status === "REJECTED") summary.rejected += 1;
    if (result.status === "DUPLICATE") summary.duplicates += 1;
    summary.steps.push({
      path,
      created_at: createdAt,
      status: result.status,
      score: result.score ?? 0,
      streak: result.streak ?? state.state.streak?.current ?? 0,
      reason: result.reason,
    });
  }

  summary.final_score = state.state.total_score ?? 0;
  summary.current_streak = state.state.streak?.current ?? 0;
  summary.longest_streak = state.state.streak?.longest ?? 0;
  summary.milestones = (state.state.events ?? []).filter((event: any) =>
    ["streak.advanced", "streak.broken", "receipt.rejected", "receipt.duplicate"].includes(event?.type),
  );

  if (jsonMode) {
    console.log(JSON.stringify(summary, null, 2));
    return 0;
  }

  console.log("Simulation Summary");
  console.log(`  Receipts processed: ${summary.receipts_processed}`);
  console.log(`  Accepted:           ${summary.accepted}`);
  console.log(`  Rejected:           ${summary.rejected}`);
  console.log(`  Duplicates:         ${summary.duplicates}`);
  console.log(`  Final score:        ${summary.final_score}`);
  console.log(`  Current streak:     ${summary.current_streak}`);
  console.log(`  Longest streak:     ${summary.longest_streak}`);
  console.log("");
  if (summary.milestones.length === 0) {
    console.log("  No milestone events emitted.");
  } else {
    console.log("  Milestones:");
    for (const event of summary.milestones) {
      console.log(`    ${event.timestamp}  ${event.type}`);
    }
  }
  return 0;
}

function cloneWithoutAnchors(receipt: JsonObject): JsonObject {
  const clone = JSON.parse(JSON.stringify(receipt)) as JsonObject;
  delete clone.anchors;
  return clone;
}

function computeOtsDigestHex(receipt: JsonObject): string {
  const hash = computeContentHash(cloneWithoutAnchors(receipt));
  return hash.replace(/^sha256:/, "");
}

function runOtsCommand(args: string[]): void {
  try {
    execFileSync("ots", args, { stdio: ["ignore", "pipe", "pipe"] });
  } catch (error: any) {
    if (error?.code === "ENOENT") {
      throw new Error("OpenTimestamps CLI not found. Install with: pip3 install opentimestamps-client");
    }
    const stderr = Buffer.isBuffer(error?.stderr)
      ? error.stderr.toString("utf8").trim()
      : typeof error?.stderr === "string"
        ? error.stderr.trim()
        : "";
    const detail = stderr ? `: ${stderr}` : "";
    throw new Error(`ots ${args[0]} failed${detail}`);
  }
}

function runOtsStamp(digestPath: string, network?: string): void {
  if (!network) {
    runOtsCommand(["stamp", digestPath]);
    return;
  }
  try {
    runOtsCommand(["stamp", "--network", network, digestPath]);
  } catch (error: any) {
    const message = String(error?.message ?? error);
    // Some ots client builds do not expose a --network flag.
    if (!/unknown|unrecognized|invalid option|no such option/i.test(message)) {
      throw error;
    }
    runOtsCommand(["stamp", digestPath]);
  }
}

function parseAnchorOtsArgs(args: string[]): { receiptPath: string; outputPath?: string; network?: string } {
  const receiptPath = args[0];
  if (!receiptPath) {
    throw new Error("missing receipt path");
  }
  let outputPath: string | undefined;
  let network: string | undefined;
  for (let i = 1; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === "--output" || arg === "-o") {
      outputPath = readMintFlagValue(args, i, "--output");
      i += 1;
      continue;
    }
    if (arg === "--network") {
      network = readMintFlagValue(args, i, "--network");
      i += 1;
      continue;
    }
    throw new Error(`unknown anchor flag '${arg}'`);
  }
  return { receiptPath, outputPath, network };
}

async function cmdAnchorOts(args: string[]): Promise<number> {
  const opts = parseAnchorOtsArgs(args);
  const receiptPath = resolve(opts.receiptPath);
  const receipt = await loadJson(receiptPath);
  const schemaErrors = validateReceiptShape(receipt);
  if (schemaErrors.length > 0) {
    console.error("error: receipt fails schema validation:");
    for (const err of schemaErrors) {
      console.error(`  ${err}`);
    }
    return 1;
  }

  const stampingReceipt = JSON.parse(JSON.stringify(receipt)) as JsonObject;
  stampingReceipt.version = "1.2";
  if (!stampingReceipt.meta || typeof stampingReceipt.meta !== "object") {
    stampingReceipt.meta = {};
  }
  stampingReceipt.meta.schema_version = "1.2";

  const digestHex = computeOtsDigestHex(stampingReceipt);
  const scratchDir = await mkdtemp(join(tmpdir(), "ship-receipts-ots-"));
  const digestPath = join(scratchDir, `${digestHex}.sha256`);
  const proofPath = `${digestPath}.ots`;

  try {
    await writeFile(digestPath, Buffer.from(digestHex, "hex"));
    runOtsStamp(digestPath, opts.network);
    const proofBytes = await readFile(proofPath);
    const proofB64 = proofBytes.toString("base64");

    const anchored = JSON.parse(JSON.stringify(stampingReceipt)) as JsonObject;
    anchored.meta.content_hash = computeContentHash(cloneWithoutAnchors(anchored));

    const currentAnchors = Array.isArray(anchored.anchors) ? anchored.anchors : [];
    const filtered = currentAnchors.filter((anchor: any) => anchor?.kind !== "opentimestamps");
    const anchor: Record<string, any> = {
      kind: "opentimestamps",
      digest_alg: "sha256",
      digest_hex: digestHex,
      ots_proof: proofB64,
    };
    if (opts.network) {
      anchor.network = opts.network;
    }
    filtered.push(anchor);
    anchored.anchors = filtered;

    const outPath = resolve(opts.outputPath ?? opts.receiptPath);
    await writeFile(outPath, `${JSON.stringify(anchored, null, 2)}\n`, "utf8");
    console.log(`Anchored with OpenTimestamps: ${outPath}`);
    console.log(`  Digest: ${digestHex}`);
    if (opts.network) {
      console.log(`  Network: ${opts.network}`);
    }
    return 0;
  } finally {
    await rm(scratchDir, { recursive: true, force: true });
  }
}

async function cmdVerifyOts(args: string[]): Promise<number> {
  const receiptPath = args[0];
  if (!receiptPath) {
    console.error("error: missing receipt path");
    return 1;
  }
  const resolvedPath = resolve(receiptPath);
  const receipt = await loadJson(resolvedPath);
  const schemaErrors = validateReceiptShape(receipt);
  if (schemaErrors.length > 0) {
    console.error("error: receipt fails schema validation:");
    for (const err of schemaErrors) {
      console.error(`  ${err}`);
    }
    return 1;
  }

  const anchors = Array.isArray(receipt.anchors) ? receipt.anchors : [];
  const anchor = anchors.find((candidate: any) => candidate?.kind === "opentimestamps");
  if (!anchor) {
    console.error("error: no opentimestamps anchor found");
    return 1;
  }
  if (typeof anchor.ots_proof !== "string" || anchor.ots_proof.length === 0) {
    console.error("error: opentimestamps anchor missing ots_proof");
    return 1;
  }
  if (typeof anchor.digest_hex !== "string" || !/^[a-f0-9]{64}$/.test(anchor.digest_hex)) {
    console.error("error: opentimestamps anchor has invalid digest_hex");
    return 1;
  }

  const digestHex = computeOtsDigestHex(receipt);
  if (digestHex !== anchor.digest_hex) {
    console.error("error: digest mismatch between receipt and opentimestamps anchor");
    return 1;
  }

  const scratchDir = await mkdtemp(join(tmpdir(), "ship-receipts-ots-verify-"));
  const digestPath = join(scratchDir, `${digestHex}.sha256`);
  const proofPath = join(scratchDir, `${digestHex}.sha256.ots`);

  try {
    await writeFile(digestPath, Buffer.from(digestHex, "hex"));
    await writeFile(proofPath, Buffer.from(anchor.ots_proof, "base64"));
    runOtsCommand(["verify", proofPath, "-f", digestPath]);
    console.log(`OTS verification passed for ${resolvedPath}`);
    return 0;
  } finally {
    await rm(scratchDir, { recursive: true, force: true });
  }
}

async function cmdValidate(receiptPath: string): Promise<number> {
  const receipt = await loadJson(receiptPath);
  const schemaErrors = validateReceiptShape(receipt);
  console.log(`Receipt: ${receiptPath}\n`);
  if (schemaErrors.length > 0) {
    console.log("Schema:  FAIL");
    for (const err of schemaErrors) {
      console.log(`  ${err}`);
    }
    return 1;
  }
  console.log("Schema:  PASS");

  const claimed = receipt?.meta?.content_hash;
  if (claimed) {
    if (validateContentHash(receipt)) {
      console.log("Hash:    PASS");
    } else {
      console.log("Hash:    FAIL - content_hash does not match computed hash");
      return 1;
    }
  } else {
    console.log("Hash:    SKIP (no meta.content_hash)");
  }

  const [base] = computeBaseScore(receipt);
  console.log(`Base:    ${base} points\n`);
  console.log("VALID");
  return 0;
}

async function cmdScore(receiptPath: string): Promise<number> {
  const receipt = await loadJson(receiptPath);
  const schemaErrors = validateReceiptShape(receipt);
  if (schemaErrors.length > 0) {
    console.log(`Receipt: ${receiptPath}`);
    console.log("Status:  REJECTED (schema validation failed)");
    for (const err of schemaErrors) {
      console.log(`  ${err}`);
    }
    return 1;
  }
  const state = await GameState.create(".");
  const result = state.scoreReceipt(receipt);
  await state.save();

  console.log(`Receipt: ${receiptPath}`);
  console.log(`Subject: ${receipt?.subject?.name ?? "unknown"}`);
  console.log(`Status:  ${result.status}\n`);

  if (result.status === "ACCEPTED") {
    const mults = result.multipliers ?? {};
    console.log(`  Base Score:          ${result.base_score}`);
    console.log(
      `  Streak Multiplier:   ${mults.streak_multiplier ?? 1.0}x (${state.state.streak.current}-day streak)`,
    );
    console.log(`  Integrity Bonus:     ${mults.integrity_multiplier ?? 1.0}x`);
    console.log("  -----------------------");
    console.log(`  Final Score:         ${result.score}\n`);
    console.log(`  Streak: ${state.state.streak.current} days`);
    console.log(`  Total Score: ${state.state.total_score} (${state.state.receipts_submitted} receipts)`);

    // Compass hook — optional LLM reflection
    const config = await loadConfig();
    const hookCmd = config?.odyssey?.llm_hook ?? config?.compass?.command ?? "";
    if (hookCmd) {
      const goal: string | undefined = (state.state as any)?.odyssey?.ithaca;
      runCompassHook(receipt, goal, hookCmd);
    }

    return 0;
  }

  if (result.status === "REJECTED") {
    console.log(`  Reason: ${result.reason ?? "unknown"}`);
  } else if (result.status === "DUPLICATE") {
    console.log("  This receipt has already been submitted.");
  }
  return 1;
}

async function cmdExport(receiptPath: string, outputPath?: string): Promise<number> {
  const receipt = await loadJson(receiptPath);
  const schemaErrors = validateReceiptShape(receipt);
  if (schemaErrors.length > 0) {
    console.error("error: receipt fails schema validation:");
    for (const err of schemaErrors) {
      console.error(`  ${err}`);
    }
    return 1;
  }
  const gameState = await readGameStateIfPresent(".");
  const envelope = exportProofEnvelope(receipt, gameState);
  const output = outputPath || `${basename(receiptPath, ".json")}.envelope.json`;
  await writeFile(output, `${JSON.stringify(envelope, null, 2)}\n`, "utf8");

  console.log(`Exported proof envelope to ${output}`);
  console.log(`  Content Hash: ${envelope.content_hash.slice(0, 40)}...`);
  console.log(`  Actor: ${envelope.actor.github_username}`);
  console.log(`  Envelope ID: ${envelope.envelope_id}`);
  return 0;
}

async function cmdStreak(): Promise<number> {
  const state = await GameState.create(".");
  const streak = state.state.streak;
  const current = streak.current ?? 0;
  console.log("Streak Status");
  console.log(`  Current:  ${current} days`);
  console.log(`  Longest:  ${streak.longest ?? 0} days`);
  console.log(`  Started:  ${streak.streak_start_date ?? "-"}`);
  console.log(`  Last:     ${streak.last_qualifying_date ?? "never"}`);
  console.log(`  Multiplier: ${streakMultiplier(current)}x\n`);
  console.log(`  Total Score: ${state.state.total_score}`);
  console.log(
    `  Receipts: ${state.state.receipts_submitted} submitted, ${state.state.receipts_rejected} rejected`,
  );
  return 0;
}

type MintOptions = {
  receiptPath: string;
  outputPath?: string;
  agentName?: string;
  contextStorePath?: string;
  shotCallConfidence?: number;
  verificationResult?: VerificationResult;
  drSignal?: string;
};

function readMintFlagValue(args: string[], index: number, flag: string): string {
  const value = args[index + 1];
  if (!value || value.startsWith("-")) {
    throw new Error(`missing value for ${flag}`);
  }
  return value;
}

function parseMintArgs(args: string[]): MintOptions {
  const receiptPath = args[0];
  if (!receiptPath) {
    throw new Error("missing receipt path");
  }

  const opts: MintOptions = { receiptPath };
  for (let i = 1; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === "--output" || arg === "-o") {
      opts.outputPath = readMintFlagValue(args, i, "--output");
      i += 1;
      continue;
    }
    if (arg === "--agent") {
      opts.agentName = readMintFlagValue(args, i, "--agent");
      i += 1;
      continue;
    }
    if (arg === "--context-store") {
      opts.contextStorePath = readMintFlagValue(args, i, "--context-store");
      i += 1;
      continue;
    }
    if (arg === "--confidence") {
      const parsed = Number(readMintFlagValue(args, i, "--confidence"));
      if (Number.isNaN(parsed) || parsed < 0 || parsed > 1) {
        throw new Error("invalid --confidence value, expected a number between 0 and 1");
      }
      opts.shotCallConfidence = parsed;
      i += 1;
      continue;
    }
    if (arg === "--verification-result") {
      const value = readMintFlagValue(args, i, "--verification-result").toLowerCase() as VerificationResult;
      if (!VALID_VERIFICATION_RESULTS.has(value)) {
        throw new Error("invalid --verification-result, expected pass|fail|skipped");
      }
      opts.verificationResult = value;
      i += 1;
      continue;
    }
    if (arg === "--dr-signal") {
      const value = readMintFlagValue(args, i, "--dr-signal").toUpperCase();
      if (!VALID_DR_SIGNALS.has(value)) {
        throw new Error("invalid --dr-signal, expected SHIP|CONTINUE|ESCALATE");
      }
      opts.drSignal = value;
      i += 1;
      continue;
    }
    throw new Error(`unknown mint flag '${arg}'`);
  }
  return opts;
}

async function cmdMint(args: string[]): Promise<number> {
  const opts = parseMintArgs(args);
  const receipt = await loadJson(resolve(opts.receiptPath));
  const schemaErrors = validateReceiptShape(receipt);
  if (schemaErrors.length > 0) {
    console.error("error: receipt fails schema validation:");
    for (const err of schemaErrors) {
      console.error(`  ${err}`);
    }
    return 1;
  }

  const envAgent = process.env.SHIP_RECEIPTS_AGENT?.trim();
  const agentName = opts.agentName?.trim() || envAgent || "codex";
  const calibration = await readAgentCalibration(agentName, { contextStorePath: opts.contextStorePath });
  if (calibration.warning) {
    console.error(`warning: ${calibration.warning}`);
  }

  const mintedAt = new Date().toISOString().replace(/\.\d+Z$/, "Z");
  const minted = JSON.parse(JSON.stringify(receipt)) as JsonObject;
  minted.version = "1.1";
  if (!minted.meta || typeof minted.meta !== "object") {
    minted.meta = {};
  }
  minted.meta.schema_version = "1.1";
  minted.meta.minted_at = mintedAt;

  minted.agent = agentName;
  minted.agent_calibration_score = calibration.score;
  minted.agent_predictions_n = calibration.predictionsN;
  minted.shot_call_confidence = opts.shotCallConfidence ?? null;
  minted.verification_result = opts.verificationResult ?? "skipped";
  minted.dr_signal = opts.drSignal ?? null;
  minted.commit = gitExec("git rev-parse --short HEAD") || null;
  minted.ts = mintedAt;

  minted.meta.content_hash = computeContentHash(minted);

  const outputPath = resolve(opts.outputPath ?? `${basename(opts.receiptPath, ".json")}.minted.receipt.json`);
  await writeFile(outputPath, `${JSON.stringify(minted, null, 2)}\n`, "utf8");

  console.log(`Minted receipt written to ${outputPath}`);
  console.log(`  Agent: ${minted.agent}`);
  console.log(`  Calibration: ${minted.agent_calibration_score ?? "unrated"} (${minted.agent_predictions_n ?? 0} predictions)`);
  console.log(`  Verification: ${minted.verification_result}`);
  console.log(`  Hash: ${minted.meta.content_hash}`);
  return 0;
}

function parseExportArgs(args: string[]): { receiptPath: string; outputPath?: string } {
  const receiptPath = args[0];
  if (!receiptPath) {
    throw new Error("missing receipt path");
  }
  let outputPath: string | undefined;
  for (let i = 1; i < args.length; i += 1) {
    if (args[i] === "--output" || args[i] === "-o") {
      outputPath = args[i + 1];
      i += 1;
    }
  }
  return { receiptPath, outputPath };
}

function validateReceiptShape(receipt: JsonObject): string[] {
  const errors: string[] = [];
  const isoUtcRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/;
  const base64Regex = /^[A-Za-z0-9+/]+={0,2}$/;

  if (receipt.version !== "0.1" && receipt.version !== "1.0" && receipt.version !== "1.1" && receipt.version !== "1.2") {
    errors.push("$.version: must be '0.1', '1.0', '1.1', or '1.2'");
  }

  if (!receipt.subject || typeof receipt.subject !== "object") {
    errors.push("$.subject: required object");
  } else if (!receipt.subject.name || typeof receipt.subject.name !== "string") {
    errors.push("$.subject.name: required non-empty string");
  } else {
    const profiles = receipt.subject.profiles;
    if (profiles !== undefined) {
      if (!Array.isArray(profiles)) {
        errors.push("$.subject.profiles: must be array when present");
      } else {
        profiles.forEach((p: any, i: number) => {
          if (!p || typeof p !== "object") {
            errors.push(`$.subject.profiles[${i}]: must be object`);
            return;
          }
          if (!p.kind || typeof p.kind !== "string") {
            errors.push(`$.subject.profiles[${i}].kind: required string`);
          }
          if (!p.url || typeof p.url !== "string") {
            errors.push(`$.subject.profiles[${i}].url: required string`);
          }
        });
      }
    }
  }

  if (!Array.isArray(receipt.artifacts) || receipt.artifacts.length < 1) {
    errors.push("$.artifacts: required non-empty array");
  } else {
    receipt.artifacts.forEach((artifact: any, i: number) => {
      if (!artifact || typeof artifact !== "object") {
        errors.push(`$.artifacts[${i}]: must be object`);
        return;
      }
      if (!artifact.kind || typeof artifact.kind !== "string") {
        errors.push(`$.artifacts[${i}].kind: required string`);
      } else if (!VALID_ARTIFACT_KINDS.has(artifact.kind)) {
        errors.push(`$.artifacts[${i}].kind: invalid kind '${artifact.kind}'`);
      }
      if (!artifact.name || typeof artifact.name !== "string") {
        errors.push(`$.artifacts[${i}].name: required non-empty string`);
      }
      if (!artifact.url || typeof artifact.url !== "string") {
        errors.push(`$.artifacts[${i}].url: required non-empty string`);
      }
      if (artifact.verify !== undefined) {
        if (!Array.isArray(artifact.verify)) {
          errors.push(`$.artifacts[${i}].verify: must be array when present`);
        } else {
          artifact.verify.forEach((v: any, j: number) => {
            if (!v || typeof v !== "object") {
              errors.push(`$.artifacts[${i}].verify[${j}]: must be object`);
              return;
            }
            if (!v.kind || typeof v.kind !== "string") {
              errors.push(`$.artifacts[${i}].verify[${j}].kind: required string`);
              return;
            }
            if (!VALID_VERIFY_KINDS.has(v.kind)) {
              errors.push(`$.artifacts[${i}].verify[${j}].kind: invalid kind '${v.kind}'`);
            }
          });
        }
      }
    });
  }

  if (receipt.agent !== undefined && (typeof receipt.agent !== "string" || receipt.agent.trim().length === 0)) {
    errors.push("$.agent: must be a non-empty string when present");
  }

  if (receipt.agent_calibration_score !== undefined) {
    if (receipt.agent_calibration_score !== null) {
      if (typeof receipt.agent_calibration_score !== "number" || Number.isNaN(receipt.agent_calibration_score)) {
        errors.push("$.agent_calibration_score: must be number or null");
      } else if (receipt.agent_calibration_score < 0 || receipt.agent_calibration_score > 1) {
        errors.push("$.agent_calibration_score: must be between 0 and 1");
      }
    }
  }

  if (receipt.agent_predictions_n !== undefined) {
    if (receipt.agent_predictions_n !== null) {
      if (!Number.isInteger(receipt.agent_predictions_n) || receipt.agent_predictions_n < 0) {
        errors.push("$.agent_predictions_n: must be integer >= 0 or null");
      }
    }
  }

  if (receipt.shot_call_confidence !== undefined) {
    if (receipt.shot_call_confidence !== null) {
      if (typeof receipt.shot_call_confidence !== "number" || Number.isNaN(receipt.shot_call_confidence)) {
        errors.push("$.shot_call_confidence: must be number or null");
      } else if (receipt.shot_call_confidence < 0 || receipt.shot_call_confidence > 1) {
        errors.push("$.shot_call_confidence: must be between 0 and 1");
      }
    }
  }

  if (receipt.verification_result !== undefined) {
    if (typeof receipt.verification_result !== "string" || !VALID_VERIFICATION_RESULTS.has(receipt.verification_result as VerificationResult)) {
      errors.push("$.verification_result: must be pass|fail|skipped");
    }
  }

  if (receipt.dr_signal !== undefined && receipt.dr_signal !== null) {
    if (typeof receipt.dr_signal !== "string" || !VALID_DR_SIGNALS.has(receipt.dr_signal)) {
      errors.push("$.dr_signal: must be SHIP|CONTINUE|ESCALATE|null");
    }
  }

  if (receipt.commit !== undefined && receipt.commit !== null && typeof receipt.commit !== "string") {
    errors.push("$.commit: must be string or null");
  }

  if (receipt.ts !== undefined && receipt.ts !== null) {
    const validTs =
      typeof receipt.ts === "string" &&
      isoUtcRegex.test(receipt.ts) &&
      !Number.isNaN(Date.parse(receipt.ts));
    if (!validTs) {
      errors.push("$.ts: must be ISO-8601 string or null");
    }
  }

  if (receipt.anchors !== undefined) {
    if (!Array.isArray(receipt.anchors)) {
      errors.push("$.anchors: must be array when present");
    } else {
      receipt.anchors.forEach((anchor: any, i: number) => {
        if (!anchor || typeof anchor !== "object") {
          errors.push(`$.anchors[${i}]: must be object`);
          return;
        }
        if (anchor.kind !== "opentimestamps") {
          errors.push(`$.anchors[${i}].kind: must be 'opentimestamps'`);
        }
        if (anchor.digest_alg !== "sha256") {
          errors.push(`$.anchors[${i}].digest_alg: must be 'sha256'`);
        }
        if (typeof anchor.digest_hex !== "string" || !/^[a-f0-9]{64}$/.test(anchor.digest_hex)) {
          errors.push(`$.anchors[${i}].digest_hex: must be 64-char lowercase hex`);
        }
        if (typeof anchor.ots_proof !== "string" || anchor.ots_proof.length === 0) {
          errors.push(`$.anchors[${i}].ots_proof: required base64 string`);
        } else if (!base64Regex.test(anchor.ots_proof)) {
          errors.push(`$.anchors[${i}].ots_proof: invalid base64`);
        }
        if (anchor.network !== undefined && typeof anchor.network !== "string") {
          errors.push(`$.anchors[${i}].network: must be string when present`);
        }
        if (anchor.verified_at !== undefined) {
          const validVerifiedAt =
            typeof anchor.verified_at === "string" &&
            isoUtcRegex.test(anchor.verified_at) &&
            !Number.isNaN(Date.parse(anchor.verified_at));
          if (!validVerifiedAt) {
            errors.push(`$.anchors[${i}].verified_at: must be ISO-8601 string`);
          }
        }
      });
    }
  }

  return errors;
}

async function cmdGoal(argv: string[]): Promise<number> {
  const sub = argv[0];
  const gameState = await GameState.create(resolve("."));
  const odyssey: Record<string, any> = (gameState.state as any).odyssey ?? {};

  if (sub === "set") {
    const text = argv.slice(1).join(" ").trim();
    if (!text) {
      console.error('error: provide goal text, e.g. goal set "Get one project to revenue"');
      return 1;
    }
    odyssey.ithaca = text;
    odyssey.set_at = new Date().toISOString();
    odyssey.completed = false;
    (gameState.state as any).odyssey = odyssey;
    await gameState.save();
    console.log(`Goal set: "${text}"`);
    console.log("Your Ithaca is declared. Every receipt will be measured against it.");
    return 0;
  }

  if (sub === "status" || sub === "show") {
    const ithaca = odyssey.ithaca;
    if (!ithaca) {
      console.log('No goal set. Run: ship-receipts goal set "<your goal>"');
      return 0;
    }
    console.log(`Goal:      ${ithaca}`);
    console.log(`Status:    ${odyssey.completed ? "COMPLETE" : "in progress"}`);
    return 0;
  }

  if (sub === "complete") {
    if (!odyssey.ithaca) {
      console.error('error: no goal set. Run: ship-receipts goal set "<your goal>"');
      return 1;
    }
    odyssey.completed = true;
    odyssey.completed_at = new Date().toISOString();
    (gameState.state as any).odyssey = odyssey;
    await gameState.save();
    console.log("Ithaca reached.");
    console.log(`  "${odyssey.ithaca}"`);
    console.log("\nThe journey is complete. Start a new one with: goal set");
    return 0;
  }

  console.error(`error: unknown goal subcommand '${sub ?? ""}'. Use: set, status, complete`);
  return 1;
}

function runCompassHook(receipt: JsonObject, goal: string | undefined, hookCmd: string): void {
  const receiptJson = JSON.stringify(receipt, null, 2);
  const cmd = hookCmd
    .replace("{goal}", goal ?? "")
    .replace("{receipt_json}", receiptJson);
  try {
    const output = execSync(cmd, { encoding: "utf8", timeout: 60000 }).trim();
    if (output) {
      console.log();
      console.log("  Compass " + "─".repeat(48));
      for (const line of output.split("\n")) {
        console.log(`  ${line}`);
      }
      console.log("  " + "─".repeat(56));
    }
  } catch (e: any) {
    if (e?.code === "ETIMEDOUT") {
      console.error("  (Compass hook timed out)");
    } else {
      console.error(`  (Compass hook error: ${e?.message ?? String(e)})`);
    }
  }
}

async function cmdWellness(argv: string[]): Promise<number> {
  const jsonMode = argv.includes("--json");
  const gameState = await GameState.create(resolve("."));
  const state = gameState.state as any;

  const today = new Date().toISOString().slice(0, 10);
  const todayEvents = (state.events ?? []).filter(
    (e: any) => e?.timestamp?.startsWith(today) && e?.type === "receipt.submitted"
  );
  const receiptsToday = todayEvents.length;
  const shippedToday = receiptsToday > 0;
  const streakDays: number = state.streak?.current ?? 0;

  // Estimate session duration from first/last receipt event today
  let sessionDurationMinutes = 0;
  let timeSinceLastBreakMinutes = 0;
  if (todayEvents.length > 0) {
    const timestamps = todayEvents
      .map((e: any) => new Date(e.timestamp).getTime())
      .filter(Boolean)
      .sort((a: number, b: number) => a - b);
    const first = timestamps[0];
    const last = timestamps[timestamps.length - 1];
    sessionDurationMinutes = Math.round((last - first) / 60000);
    timeSinceLastBreakMinutes = Math.round((Date.now() - last) / 60000);
  }

  const signal = {
    sessionDurationMinutes,
    timeSinceLastBreakMinutes,
    receiptsToday,
    streakDays,
    shippedToday,
    readingAt: new Date().toISOString(),
  };

  if (jsonMode) {
    console.log(JSON.stringify(signal, null, 2));
    return 0;
  }

  console.log(`Wellness signal (${today})`);
  console.log(`  Receipts today:       ${receiptsToday}`);
  console.log(`  Shipped today:        ${shippedToday ? "yes" : "no"}`);
  console.log(`  Streak:               ${streakDays} days`);
  console.log(`  Session duration:     ${sessionDurationMinutes} min`);
  console.log(`  Since last break:     ${timeSinceLastBreakMinutes} min`);
  return 0;
}

function renderDailyDashboard(state: any, receiptsToday: number, streakDays: number): string {
  const sep = "─".repeat(56);
  const now = new Date().toLocaleTimeString("en-US", { hour12: false });
  const today = new Date().toISOString().slice(0, 10);

  const ithaca = state?.odyssey?.ithaca;
  const streakMult = (() => {
    if (streakDays >= 5) return "1.5x";
    if (streakDays >= 3) return "1.25x";
    if (streakDays >= 2) return "1.1x";
    return "1.0x";
  })();

  const todayEvents = (state.events ?? [])
    .filter((e: any) => e?.timestamp?.startsWith(today) && e?.type === "receipt.submitted")
    .slice(-5)
    .reverse();

  let lines: string[] = [
    `  ship-receipts daily    ${now}`,
    `  ${sep}`,
    `  Streak:   ${streakDays} days   ${streakMult} multiplier`,
    `  Score:    ${state.total_score ?? 0} total   ${state.receipts_submitted ?? 0} receipts`,
  ];

  if (ithaca) {
    const status = state?.odyssey?.completed ? "COMPLETE ✓" : "in progress";
    lines.push(`  Ithaca:   ${ithaca.slice(0, 48)}`);
    lines.push(`            ${status}`);
  } else {
    lines.push(`  Ithaca:   (not set — run: ship-receipts goal set "...")`);
  }

  lines.push(`  ${sep}`);
  lines.push(`  Today (${today}):`);

  if (todayEvents.length === 0) {
    lines.push(`    no receipts yet today`);
  } else {
    for (const e of todayEvents) {
      const score = e?.payload?.score ?? 0;
      const hash = (e?.payload?.receipt_hash as string)?.slice(0, 12) ?? "???";
      lines.push(`    ${hash}  +${score} pts`);
    }
    lines.push(`    total today: ${receiptsToday} receipt${receiptsToday === 1 ? "" : "s"}`);
  }

  lines.push(`  ${sep}`);
  lines.push(`  Ctrl+C to exit`);

  return lines.join("\n");
}

async function cmdDaily(argv: string[]): Promise<number> {
  const watchMode = argv.includes("--watch");
  const intervalIdx = argv.indexOf("--interval");
  const intervalSec = intervalIdx !== -1 ? parseInt(argv[intervalIdx + 1] ?? "5", 10) : 5;

  const render = async () => {
    const gameState = await GameState.create(resolve("."));
    const state = gameState.state as any;
    const today = new Date().toISOString().slice(0, 10);
    const receiptsToday = (state.events ?? []).filter(
      (e: any) => e?.timestamp?.startsWith(today) && e?.type === "receipt.submitted"
    ).length;
    const streakDays: number = state.streak?.current ?? 0;

    if (watchMode) {
      process.stdout.write("\x1b[2J\x1b[H"); // clear screen
    }
    console.log(renderDailyDashboard(state, receiptsToday, streakDays));
  };

  await render();

  if (!watchMode) return 0;

  // Watch mode: auto-refresh
  const timer = setInterval(render, intervalSec * 1000);

  await new Promise<void>((resolve) => {
    process.on("SIGINT", () => {
      clearInterval(timer);
      process.stdout.write("\x1b[2J\x1b[H"); // clear on exit
      console.log("  Goodbye.");
      resolve();
    });
  });

  return 0;
}

async function loadConfig(): Promise<Record<string, any>> {
  const configPath = join(homedir(), ".ship-receipts", "config.json");
  try {
    const raw = await readFile(configPath, "utf8");
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

export async function main(argv = process.argv.slice(2)): Promise<number> {
  if (argv.length === 0) {
    console.log(usage());
    return 1;
  }

  const command = argv[0];
  try {
    if (command === "anchor") {
      if (argv[1] !== "ots") {
        console.error("error: unknown anchor subcommand. Use: anchor ots <receipt.json>");
        return 1;
      }
      return await cmdAnchorOts(argv.slice(2));
    }
    if (command === "verify" && argv[1] === "ots") {
      return await cmdVerifyOts(argv.slice(2));
    }
    if (command === "validate" || command === "verify") {
      if (!argv[1]) {
        console.error("error: missing receipt path");
        return 1;
      }
      return await cmdValidate(resolve(argv[1]));
    }
    if (command === "score") {
      if (!argv[1]) {
        console.error("error: missing receipt path");
        return 1;
      }
      return await cmdScore(resolve(argv[1]));
    }
    if (command === "streak") return await cmdStreak();
    if (command === "init" || command === "create") return await cmdInit(argv.slice(1));
    if (command === "goal") return await cmdGoal(argv.slice(1));
    if (command === "wellness") return await cmdWellness(argv.slice(1));
    if (command === "daily") return await cmdDaily(argv.slice(1));
    if (command === "simulate") return await cmdSimulate(argv.slice(1));
    if (command === "mint") {
      return await cmdMint(argv.slice(1));
    }
    if (command === "export") {
      const { receiptPath, outputPath } = parseExportArgs(argv.slice(1));
      return await cmdExport(resolve(receiptPath), outputPath ? resolve(outputPath) : undefined);
    }
  } catch (error: any) {
    if (error?.code === "ENOENT") {
      console.error(`error: file not found: ${error.path ?? "unknown path"}`);
      return 1;
    }
    if (error instanceof SyntaxError) {
      console.error("error: invalid JSON");
      return 1;
    }
    console.error(`error: ${error?.message ?? String(error)}`);
    return 1;
  }

  console.log(usage());
  return 1;
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : "";
const currentModulePath = fileURLToPath(import.meta.url);
if (existsSync(invokedPath) && invokedPath === currentModulePath) {
  main().then((code) => process.exit(code));
}
