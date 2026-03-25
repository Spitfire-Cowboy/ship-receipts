#!/usr/bin/env node

// src-ts/cli.ts
import { readFile as readFile4, writeFile as writeFile2 } from "fs/promises";
import { existsSync } from "fs";
import { basename, resolve, join as join4 } from "path";
import { homedir as homedir2 } from "os";
import { fileURLToPath } from "url";
import { execSync } from "child_process";
import * as readline from "readline";

// src-ts/scoring/engine.ts
var MINIMUM_QUALIFYING_SCORE = 6;
var STREAK_TIERS = [
  [5, 1.5],
  [3, 1.25],
  [2, 1.1]
];
function computeBaseScore(receipt) {
  const breakdown = {};
  let score = 0;
  if (receipt?.subject?.name) {
    breakdown["subject.name"] = 1;
    score += 1;
  }
  const profiles = Array.isArray(receipt?.subject?.profiles) ? receipt.subject.profiles : [];
  const validProfiles = profiles.filter((p) => p?.kind && p?.url);
  if (validProfiles.length > 0) {
    breakdown["subject.profiles"] = 2;
    score += 2;
  }
  if (receipt?.meta?.created_at) {
    breakdown["meta.created_at"] = 1;
    score += 1;
  }
  if (receipt?.meta?.content_hash) {
    breakdown["meta.content_hash"] = 3;
    score += 3;
  }
  const artifacts = Array.isArray(receipt?.artifacts) ? receipt.artifacts : [];
  artifacts.forEach((artifact, i) => {
    const prefix = `artifact[${i}]`;
    if (artifact?.immutable_ref) {
      breakdown[`${prefix}.immutable_ref`] = 2;
      score += 2;
    }
    if (artifact?.ci_url) {
      breakdown[`${prefix}.ci_url`] = 1;
      score += 1;
    }
    const verify = Array.isArray(artifact?.verify) ? artifact.verify : [];
    verify.forEach((v, j) => {
      const vprefix = `${prefix}.verify[${j}]`;
      if (v?.kind === "checksum" && v?.algo && v?.hash) {
        breakdown[`${vprefix}.checksum`] = 3;
        score += 3;
      } else if (v?.kind === "link" && v?.url) {
        breakdown[`${vprefix}.link`] = 1;
        score += 1;
      } else if (v?.kind === "command" && v?.command) {
        breakdown[`${vprefix}.command`] = 2;
        score += 2;
      } else if (v?.kind === "attestation" && v?.attestation) {
        breakdown[`${vprefix}.attestation`] = 2;
        score += 2;
      }
    });
    const signals = artifact?.signals ?? {};
    for (const key of ["dependents", "downloads_30d", "stars"]) {
      const val = signals[key];
      if (typeof val === "number" && val > 0) {
        breakdown[`${prefix}.signals.${key}`] = 1;
        score += 1;
      }
    }
    const citations = signals.downstream_citations;
    if (Array.isArray(citations) && citations.length > 0) {
      breakdown[`${prefix}.signals.citations`] = 1;
      score += 1;
    }
  });
  return [score, breakdown];
}
function streakMultiplier(streakDays) {
  for (const [threshold, mult] of STREAK_TIERS) {
    if (streakDays >= threshold) return mult;
  }
  return 1;
}
function integrityMultiplier(receipt, hashValid) {
  if (!hashValid) return 1;
  const artifacts = Array.isArray(receipt?.artifacts) ? receipt.artifacts : [];
  for (const artifact of artifacts) {
    const verify = Array.isArray(artifact?.verify) ? artifact.verify : [];
    for (const v of verify) {
      if (v?.kind === "checksum" && v?.algo && v?.hash) return 1.5;
    }
  }
  return 1;
}
function qualifiesForStreak(baseScore) {
  return baseScore >= MINIMUM_QUALIFYING_SCORE;
}
function computeFinalScore(baseScore, streakDays, receipt, hashValid) {
  const sMult = streakMultiplier(streakDays);
  const iMult = integrityMultiplier(receipt, hashValid);
  return Math.floor(baseScore * sMult * iMult);
}
function confidenceLevel(baseScore, hashValid) {
  if (!hashValid && baseScore === 0) return "none";
  if (baseScore === 0) return "none";
  if (baseScore < 6) return "minimal";
  if (baseScore < 12) return "moderate";
  if (baseScore < 20) return "strong";
  return "verified";
}

// src-ts/scoring/state.ts
import { mkdir, readFile, writeFile } from "fs/promises";
import { join } from "path";

// src-ts/scoring/hash-validator.ts
import { createHash } from "crypto";
function isPlainObject(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function sortKeys(value) {
  if (Array.isArray(value)) {
    return value.map(sortKeys);
  }
  if (isPlainObject(value)) {
    const out = {};
    for (const key of Object.keys(value).sort()) {
      out[key] = sortKeys(value[key]);
    }
    return out;
  }
  return value;
}
function canonicalJson(obj) {
  return JSON.stringify(sortKeys(obj));
}
function computeContentHash(receipt) {
  const copy = JSON.parse(JSON.stringify(receipt));
  const meta = isPlainObject(copy.meta) ? { ...copy.meta } : void 0;
  if (meta) {
    delete meta.content_hash;
    if (Object.keys(meta).length === 0) {
      delete copy.meta;
    } else {
      copy.meta = meta;
    }
  }
  const canonical = canonicalJson(copy);
  const digest = createHash("sha256").update(canonical, "utf8").digest("hex");
  return `sha256:${digest}`;
}
function validateContentHash(receipt) {
  const meta = isPlainObject(receipt.meta) ? receipt.meta : {};
  const claimed = typeof meta.content_hash === "string" ? meta.content_hash : "";
  if (!claimed) return true;
  if (!claimed.startsWith("sha256:")) return false;
  return computeContentHash(receipt) === claimed;
}

// src-ts/scoring/state.ts
var STATE_DIR = ".ship-receipts";
var STATE_FILE = "game-state.json";
var MAX_EVENTS = 1e3;
function todayIso() {
  return (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
}
function hasChecksum(receipt) {
  const artifacts = Array.isArray(receipt?.artifacts) ? receipt.artifacts : [];
  for (const artifact of artifacts) {
    const verify = Array.isArray(artifact?.verify) ? artifact.verify : [];
    for (const v of verify) {
      if (v?.kind === "checksum" && v?.algo && v?.hash) return true;
    }
  }
  return false;
}
var GameState = class _GameState {
  rootDir;
  statePath;
  state;
  constructor(rootDir, statePath, state) {
    this.rootDir = rootDir;
    this.statePath = statePath;
    this.state = state;
  }
  static async create(rootDir = ".") {
    const statePath = join(rootDir, STATE_DIR, STATE_FILE);
    try {
      const raw = await readFile(statePath, "utf8");
      return new _GameState(rootDir, statePath, JSON.parse(raw));
    } catch {
      return new _GameState(rootDir, statePath, {
        version: "1",
        subject: "",
        total_score: 0,
        receipts_submitted: 0,
        receipts_rejected: 0,
        streak: {
          current: 0,
          longest: 0,
          last_qualifying_date: null,
          streak_start_date: null
        },
        history: [],
        events: []
      });
    }
  }
  async save() {
    await mkdir(join(this.rootDir, STATE_DIR), { recursive: true });
    await writeFile(this.statePath, `${JSON.stringify(this.state, null, 2)}
`, "utf8");
  }
  isDuplicate(contentHash) {
    const history = Array.isArray(this.state.history) ? this.state.history : [];
    return history.some((h) => h?.receipt_hash === contentHash);
  }
  emitEvent(eventType, payload) {
    const events = Array.isArray(this.state.events) ? this.state.events : [];
    events.push({
      type: eventType,
      timestamp: (/* @__PURE__ */ new Date()).toISOString(),
      payload
    });
    this.state.events = events.slice(-MAX_EVENTS);
  }
  updateStreak(today, qualifies) {
    const streak = this.state.streak;
    const lastDate = streak.last_qualifying_date;
    if (!qualifies) return;
    if (lastDate === today) return;
    if (!lastDate) {
      streak.current = 1;
      streak.last_qualifying_date = today;
      streak.streak_start_date = today;
    } else {
      const currentEpoch = Date.parse(`${today}T00:00:00Z`);
      const lastEpoch = Date.parse(`${lastDate}T00:00:00Z`);
      const delta = Math.floor((currentEpoch - lastEpoch) / 864e5);
      if (delta === 1) {
        streak.current += 1;
        streak.last_qualifying_date = today;
      } else if (delta > 1) {
        this.emitEvent("streak.broken", {
          previous_length: streak.current,
          break_date: today
        });
        streak.current = 1;
        streak.last_qualifying_date = today;
        streak.streak_start_date = today;
      }
    }
    if (streak.current > (streak.longest ?? 0)) {
      streak.longest = streak.current;
    }
  }
  scoreReceipt(receipt) {
    const today = todayIso();
    const hashValid = validateContentHash(receipt);
    const hasHash = Boolean(receipt?.meta?.content_hash);
    if (hasHash && !hashValid) {
      this.state.receipts_rejected += 1;
      this.emitEvent("receipt.rejected", { reason: "content_hash_mismatch" });
      return { status: "REJECTED", reason: "content_hash_mismatch", score: 0 };
    }
    const contentHash = receipt?.meta?.content_hash || computeContentHash(receipt);
    if (this.isDuplicate(contentHash)) {
      this.emitEvent("receipt.duplicate", { receipt_hash: contentHash });
      return { status: "DUPLICATE", reason: "already_submitted", score: 0 };
    }
    const [baseScore, breakdown] = computeBaseScore(receipt);
    const currentStreak = this.state.streak.current;
    const finalScore = computeFinalScore(baseScore, currentStreak, receipt, hashValid && hasHash);
    const qualifies = qualifiesForStreak(baseScore);
    this.updateStreak(today, qualifies);
    if (qualifies) {
      this.emitEvent("streak.advanced", {
        new_length: this.state.streak.current,
        date: today
      });
    }
    if (receipt?.subject?.name) this.state.subject = receipt.subject.name;
    const entry = {
      receipt_hash: contentHash,
      score: finalScore,
      date: today,
      dispute_status: "none",
      confidence: confidenceLevel(baseScore, hashValid && hasHash),
      breakdown: {
        base: baseScore,
        streak_multiplier: streakMultiplier(currentStreak),
        integrity_multiplier: hashValid && hasHash && hasChecksum(receipt) ? 1.5 : 1
      }
    };
    if (!Array.isArray(this.state.history)) this.state.history = [];
    this.state.history.push(entry);
    this.state.receipts_submitted += 1;
    this.state.total_score += finalScore;
    this.emitEvent("receipt.submitted", {
      receipt_hash: contentHash,
      score: finalScore,
      breakdown: entry.breakdown
    });
    return {
      status: "ACCEPTED",
      score: finalScore,
      base_score: baseScore,
      breakdown,
      multipliers: entry.breakdown,
      streak: this.state.streak.current,
      confidence: entry.confidence,
      qualifies_for_streak: qualifies
    };
  }
};

// src-ts/envelope/export.ts
import { readFile as readFile2 } from "fs/promises";
import { join as join2 } from "path";
import { ulid } from "ulid";
var GITHUB_URL_RE = /^https?:\/\/github\.com\/([a-zA-Z0-9](?:[a-zA-Z0-9]|-(?=[a-zA-Z0-9])){0,38})/;
function extractActor(receipt) {
  const subject = receipt.subject ?? {};
  const profiles = Array.isArray(subject.profiles) ? subject.profiles : [];
  let githubUsername = null;
  const profileUrls = [];
  for (const p of profiles) {
    const url = typeof p?.url === "string" ? p.url : "";
    if (url) profileUrls.push(url);
    if (p?.kind === "github") {
      const match = url.match(GITHUB_URL_RE);
      if (match?.[1]) githubUsername = match[1];
    }
  }
  if (!githubUsername) {
    throw new Error("No GitHub profile found in receipt subject.profiles");
  }
  return {
    github_username: githubUsername,
    display_name: subject.name ?? githubUsername,
    profile_urls: profileUrls
  };
}
function extractLocalSnapshot(receipt, gameState) {
  const contentHash = receipt?.meta?.content_hash || computeContentHash(receipt);
  const history = Array.isArray(gameState?.history) ? gameState.history : [];
  for (const entry of history) {
    if (entry?.receipt_hash === contentHash) {
      return {
        base_score: entry.breakdown.base,
        final_score: entry.score,
        streak_days: gameState?.streak?.current ?? 0,
        streak_multiplier: entry.breakdown.streak_multiplier ?? 1,
        integrity_multiplier: entry.breakdown.integrity_multiplier ?? 1,
        computed_at: (/* @__PURE__ */ new Date()).toISOString()
      };
    }
  }
  return null;
}
function exportProofEnvelope(receipt, gameState) {
  const actor = extractActor(receipt);
  const contentHash = computeContentHash(receipt);
  const envelope = {
    envelope_version: "1.0",
    envelope_id: ulid(),
    content_hash: contentHash,
    submitted_at: (/* @__PURE__ */ new Date()).toISOString().replace(/\.\d{3}Z$/, "Z"),
    actor,
    receipt,
    export_metadata: {
      generator: "ship-receipts",
      generator_version: "0.1.0",
      ship_receipts_schema_version: receipt.version ?? "0.1"
    }
  };
  if (gameState) {
    const snapshot = extractLocalSnapshot(receipt, gameState);
    if (snapshot) envelope.local_score_snapshot = snapshot;
  }
  return envelope;
}
async function readGameStateIfPresent(rootDir = ".") {
  try {
    const raw = await readFile2(join2(rootDir, ".ship-receipts", "game-state.json"), "utf8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

// src-ts/calibration.ts
import { readFile as readFile3 } from "fs/promises";
import { homedir } from "os";
import { join as join3 } from "path";
var DEFAULT_CONTEXT_STORE_PATH = join3(homedir(), ".rowan", "memory", "context-store.jsonl");
var DEFAULT_WINDOW_SIZE = 20;
function getPath(record, path) {
  let cursor = record;
  for (const key of path) {
    if (!cursor || typeof cursor !== "object" || !(key in cursor)) {
      return void 0;
    }
    cursor = cursor[key];
  }
  return cursor;
}
function pickFirst(record, paths) {
  for (const path of paths) {
    const value = getPath(record, path);
    if (value !== void 0) return value;
  }
  return void 0;
}
function normalizeAgent(value) {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  return normalized.length > 0 ? normalized : null;
}
function normalizeConfidence(value) {
  if (typeof value !== "number" || Number.isNaN(value)) return null;
  if (value < 0 || value > 1) return null;
  return value;
}
function normalizeObservedResult(value) {
  if (value === true) return 1;
  if (value === false) return 0;
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  if (normalized === "pass") return 1;
  if (normalized === "fail") return 0;
  if (normalized === "skipped") return null;
  return null;
}
function looksLikeVerificationOutcome(record) {
  const type = pickFirst(record, [["type"], ["event_type"], ["kind"], ["payload", "type"]]);
  if (typeof type === "string" && type.trim().toLowerCase() === "verification_outcome") return true;
  const result = pickFirst(record, [
    ["verification_result"],
    ["result"],
    ["outcome"],
    ["payload", "verification_result"],
    ["payload", "result"],
    ["payload", "outcome"]
  ]);
  return result !== void 0;
}
function extractVerificationOutcome(record) {
  if (!looksLikeVerificationOutcome(record)) return null;
  const confidence = normalizeConfidence(pickFirst(record, [
    ["shot_call_confidence"],
    ["confidence"],
    ["predicted_probability"],
    ["payload", "shot_call_confidence"],
    ["payload", "confidence"],
    ["payload", "predicted_probability"]
  ]));
  if (confidence === null) return null;
  const observed = normalizeObservedResult(pickFirst(record, [
    ["verification_result"],
    ["result"],
    ["outcome"],
    ["payload", "verification_result"],
    ["payload", "result"],
    ["payload", "outcome"]
  ]));
  if (observed === null) return null;
  return { confidence, observed };
}
function computeBrierScore(outcomes) {
  if (outcomes.length === 0) return Number.NaN;
  const total = outcomes.reduce((sum, item) => {
    const error = item.confidence - item.observed;
    return sum + error * error;
  }, 0);
  return Number((total / outcomes.length).toFixed(6));
}
async function readAgentCalibration(agentName, options = {}) {
  const normalizedAgent = normalizeAgent(agentName);
  if (!normalizedAgent) {
    return {
      score: null,
      predictionsN: null,
      warning: "agent name is required to compute calibration"
    };
  }
  const contextStorePath = options.contextStorePath ?? DEFAULT_CONTEXT_STORE_PATH;
  const windowSize = options.windowSize ?? DEFAULT_WINDOW_SIZE;
  let raw;
  try {
    raw = await readFile3(contextStorePath, "utf8");
  } catch (error) {
    return {
      score: null,
      predictionsN: null,
      warning: `unable to read context store at ${contextStorePath}: ${error?.message ?? String(error)}`
    };
  }
  const lines = raw.split("\n").map((line) => line.trim()).filter((line) => line.length > 0);
  const outcomes = [];
  for (let i = lines.length - 1; i >= 0; i -= 1) {
    let parsed;
    try {
      parsed = JSON.parse(lines[i]);
    } catch {
      continue;
    }
    const rowAgent = normalizeAgent(pickFirst(parsed, [
      ["agent_name"],
      ["agent"],
      ["payload", "agent_name"],
      ["payload", "agent"],
      ["metadata", "agent_name"],
      ["metadata", "agent"]
    ]));
    if (rowAgent !== normalizedAgent) continue;
    const outcome = extractVerificationOutcome(parsed);
    if (!outcome) continue;
    outcomes.push(outcome);
    if (outcomes.length >= windowSize) break;
  }
  if (outcomes.length === 0) {
    return { score: null, predictionsN: null };
  }
  return {
    score: computeBrierScore(outcomes),
    predictionsN: outcomes.length
  };
}

// src-ts/cli.ts
var VALID_ARTIFACT_KINDS = /* @__PURE__ */ new Set(["repo", "release", "package", "dataset", "paper", "demo", "disclosure", "community_contribution", "wellness", "session_replay", "other"]);
var VALID_VERIFY_KINDS = /* @__PURE__ */ new Set(["command", "checksum", "note", "link", "attestation"]);
var VALID_VERIFICATION_RESULTS = /* @__PURE__ */ new Set(["pass", "fail", "skipped"]);
var VALID_DR_SIGNALS = /* @__PURE__ */ new Set(["SHIP", "CONTINUE", "ESCALATE"]);
function usage() {
  return `ship-receipts CLI (TypeScript port)

Usage:
  ship-receipts score <receipt.json>
  ship-receipts validate <receipt.json>
  ship-receipts verify <receipt.json>
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
  ship-receipts daily [--watch] [--interval <seconds>]`;
}
async function prompt(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve2) => rl.question(question, (ans) => {
    rl.close();
    resolve2(ans.trim());
  }));
}
function parseInitArgs(argv) {
  const opts = { hash: false, fromGit: false, days: 7 };
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
function gitExec(cmd) {
  try {
    return execSync(cmd, { encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] }).trim();
  } catch {
    return "";
  }
}
async function cmdInitFromGit(opts) {
  const repoUrl = gitExec("git remote get-url origin");
  if (!repoUrl) {
    console.error("error: not in a git repo or no origin remote");
    return 1;
  }
  const subject = opts.author ?? (gitExec("git config user.name") || "unknown");
  const since = new Date(Date.now() - opts.days * 86400 * 1e3).toISOString();
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
  const repoName = repoUrl.replace(/\.git$/, "").split("/").pop() ?? "repo";
  const now = (/* @__PURE__ */ new Date()).toISOString().replace(/\.\d+Z$/, "Z");
  const dateSlug = now.slice(0, 10);
  const receipt = {
    version: "1.0",
    issued_at: now,
    subject: { name: subject },
    artifacts: [
      {
        kind: "repo",
        name: repoName,
        url: repoUrl.startsWith("git@") ? repoUrl.replace("git@github.com:", "https://github.com/").replace(/\.git$/, "") : repoUrl.replace(/\.git$/, ""),
        immutable_ref: commits[0].sha,
        verify: commits.map((c) => ({
          kind: "note",
          note: `${c.sha.slice(0, 12)}: ${c.msg}`,
          observed_at: c.date ? new Date(c.date).toISOString() : now
        }))
      }
    ],
    meta: { created_at: now, generator: "ship-receipts-ts", source: "git-log" }
  };
  if (opts.hash) {
    receipt.meta.content_hash = computeContentHash(receipt);
  }
  const defaultOutput = join4(".ship-receipts", "receipts", `${dateSlug}-git.receipt.json`);
  const outputPath = resolve(opts.output ?? defaultOutput);
  const { mkdir: mkdirAsync } = await import("fs/promises");
  await mkdirAsync(resolve(join4(".ship-receipts", "receipts")), { recursive: true }).catch(() => {
  });
  try {
    await writeFile2(outputPath, JSON.stringify(receipt, null, 2) + "\n", "utf8");
  } catch (e) {
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
async function cmdInit(argv) {
  const opts = parseInitArgs(argv);
  if (opts.fromGit) return cmdInitFromGit(opts);
  const isTTY = process.stdin.isTTY;
  async function requireField(value, flag, label) {
    if (value !== void 0) return value;
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
  const now = (/* @__PURE__ */ new Date()).toISOString().replace(/\.\d+Z$/, "Z");
  const receipt = {
    version: "1.0",
    subject: { name: subject },
    artifacts: [{ kind, name, url }],
    meta: { created_at: now, generator: "ship-receipts-ts" }
  };
  if (opts.hash) {
    const hash = computeContentHash(receipt);
    receipt.meta.content_hash = hash;
  }
  const slug = name.toLowerCase().replace(/\s+/g, "-");
  const outputPath = resolve(opts.output ?? `${slug}.receipt.json`);
  try {
    await writeFile2(outputPath, JSON.stringify(receipt, null, 2) + "\n", "utf8");
  } catch (e) {
    console.error(`error: could not write ${outputPath}: ${e?.message}`);
    return 2;
  }
  console.log(`Created: ${outputPath}`);
  if (opts.hash) console.log(`Hash:    ${receipt.meta.content_hash}`);
  return 0;
}
async function loadJson(path) {
  const raw = await readFile4(path, "utf8");
  return JSON.parse(raw);
}
async function cmdValidate(receiptPath) {
  const receipt = await loadJson(receiptPath);
  const schemaErrors = validateReceiptShape(receipt);
  console.log(`Receipt: ${receiptPath}
`);
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
  console.log(`Base:    ${base} points
`);
  console.log("VALID");
  return 0;
}
async function cmdScore(receiptPath) {
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
  console.log(`Status:  ${result.status}
`);
  if (result.status === "ACCEPTED") {
    const mults = result.multipliers ?? {};
    console.log(`  Base Score:          ${result.base_score}`);
    console.log(
      `  Streak Multiplier:   ${mults.streak_multiplier ?? 1}x (${state.state.streak.current}-day streak)`
    );
    console.log(`  Integrity Bonus:     ${mults.integrity_multiplier ?? 1}x`);
    console.log("  -----------------------");
    console.log(`  Final Score:         ${result.score}
`);
    console.log(`  Streak: ${state.state.streak.current} days`);
    console.log(`  Total Score: ${state.state.total_score} (${state.state.receipts_submitted} receipts)`);
    const config = await loadConfig();
    const hookCmd = config?.odyssey?.llm_hook ?? config?.compass?.command ?? "";
    if (hookCmd) {
      const goal = state.state?.odyssey?.ithaca;
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
async function cmdExport(receiptPath, outputPath) {
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
  await writeFile2(output, `${JSON.stringify(envelope, null, 2)}
`, "utf8");
  console.log(`Exported proof envelope to ${output}`);
  console.log(`  Content Hash: ${envelope.content_hash.slice(0, 40)}...`);
  console.log(`  Actor: ${envelope.actor.github_username}`);
  console.log(`  Envelope ID: ${envelope.envelope_id}`);
  return 0;
}
async function cmdStreak() {
  const state = await GameState.create(".");
  const streak = state.state.streak;
  const current = streak.current ?? 0;
  console.log("Streak Status");
  console.log(`  Current:  ${current} days`);
  console.log(`  Longest:  ${streak.longest ?? 0} days`);
  console.log(`  Started:  ${streak.streak_start_date ?? "-"}`);
  console.log(`  Last:     ${streak.last_qualifying_date ?? "never"}`);
  console.log(`  Multiplier: ${streakMultiplier(current)}x
`);
  console.log(`  Total Score: ${state.state.total_score}`);
  console.log(
    `  Receipts: ${state.state.receipts_submitted} submitted, ${state.state.receipts_rejected} rejected`
  );
  return 0;
}
function readMintFlagValue(args, index, flag) {
  const value = args[index + 1];
  if (!value || value.startsWith("-")) {
    throw new Error(`missing value for ${flag}`);
  }
  return value;
}
function parseMintArgs(args) {
  const receiptPath = args[0];
  if (!receiptPath) {
    throw new Error("missing receipt path");
  }
  const opts = { receiptPath };
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
      const value = readMintFlagValue(args, i, "--verification-result").toLowerCase();
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
async function cmdMint(args) {
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
  const mintedAt = (/* @__PURE__ */ new Date()).toISOString().replace(/\.\d+Z$/, "Z");
  const minted = JSON.parse(JSON.stringify(receipt));
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
  await writeFile2(outputPath, `${JSON.stringify(minted, null, 2)}
`, "utf8");
  console.log(`Minted receipt written to ${outputPath}`);
  console.log(`  Agent: ${minted.agent}`);
  console.log(`  Calibration: ${minted.agent_calibration_score ?? "unrated"} (${minted.agent_predictions_n ?? 0} predictions)`);
  console.log(`  Verification: ${minted.verification_result}`);
  console.log(`  Hash: ${minted.meta.content_hash}`);
  return 0;
}
function parseExportArgs(args) {
  const receiptPath = args[0];
  if (!receiptPath) {
    throw new Error("missing receipt path");
  }
  let outputPath;
  for (let i = 1; i < args.length; i += 1) {
    if (args[i] === "--output" || args[i] === "-o") {
      outputPath = args[i + 1];
      i += 1;
    }
  }
  return { receiptPath, outputPath };
}
function validateReceiptShape(receipt) {
  const errors = [];
  const isoUtcRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/;
  if (receipt.version !== "0.1" && receipt.version !== "1.0" && receipt.version !== "1.1") {
    errors.push("$.version: must be '0.1', '1.0', or '1.1'");
  }
  if (!receipt.subject || typeof receipt.subject !== "object") {
    errors.push("$.subject: required object");
  } else if (!receipt.subject.name || typeof receipt.subject.name !== "string") {
    errors.push("$.subject.name: required non-empty string");
  } else {
    const profiles = receipt.subject.profiles;
    if (profiles !== void 0) {
      if (!Array.isArray(profiles)) {
        errors.push("$.subject.profiles: must be array when present");
      } else {
        profiles.forEach((p, i) => {
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
    receipt.artifacts.forEach((artifact, i) => {
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
      if (artifact.verify !== void 0) {
        if (!Array.isArray(artifact.verify)) {
          errors.push(`$.artifacts[${i}].verify: must be array when present`);
        } else {
          artifact.verify.forEach((v, j) => {
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
  if (receipt.agent !== void 0 && (typeof receipt.agent !== "string" || receipt.agent.trim().length === 0)) {
    errors.push("$.agent: must be a non-empty string when present");
  }
  if (receipt.agent_calibration_score !== void 0) {
    if (receipt.agent_calibration_score !== null) {
      if (typeof receipt.agent_calibration_score !== "number" || Number.isNaN(receipt.agent_calibration_score)) {
        errors.push("$.agent_calibration_score: must be number or null");
      } else if (receipt.agent_calibration_score < 0 || receipt.agent_calibration_score > 1) {
        errors.push("$.agent_calibration_score: must be between 0 and 1");
      }
    }
  }
  if (receipt.agent_predictions_n !== void 0) {
    if (receipt.agent_predictions_n !== null) {
      if (!Number.isInteger(receipt.agent_predictions_n) || receipt.agent_predictions_n < 0) {
        errors.push("$.agent_predictions_n: must be integer >= 0 or null");
      }
    }
  }
  if (receipt.shot_call_confidence !== void 0) {
    if (receipt.shot_call_confidence !== null) {
      if (typeof receipt.shot_call_confidence !== "number" || Number.isNaN(receipt.shot_call_confidence)) {
        errors.push("$.shot_call_confidence: must be number or null");
      } else if (receipt.shot_call_confidence < 0 || receipt.shot_call_confidence > 1) {
        errors.push("$.shot_call_confidence: must be between 0 and 1");
      }
    }
  }
  if (receipt.verification_result !== void 0) {
    if (typeof receipt.verification_result !== "string" || !VALID_VERIFICATION_RESULTS.has(receipt.verification_result)) {
      errors.push("$.verification_result: must be pass|fail|skipped");
    }
  }
  if (receipt.dr_signal !== void 0 && receipt.dr_signal !== null) {
    if (typeof receipt.dr_signal !== "string" || !VALID_DR_SIGNALS.has(receipt.dr_signal)) {
      errors.push("$.dr_signal: must be SHIP|CONTINUE|ESCALATE|null");
    }
  }
  if (receipt.commit !== void 0 && receipt.commit !== null && typeof receipt.commit !== "string") {
    errors.push("$.commit: must be string or null");
  }
  if (receipt.ts !== void 0 && receipt.ts !== null) {
    const validTs = typeof receipt.ts === "string" && isoUtcRegex.test(receipt.ts) && !Number.isNaN(Date.parse(receipt.ts));
    if (!validTs) {
      errors.push("$.ts: must be ISO-8601 string or null");
    }
  }
  return errors;
}
async function cmdGoal(argv) {
  const sub = argv[0];
  const gameState = await GameState.create(resolve("."));
  const odyssey = gameState.state.odyssey ?? {};
  if (sub === "set") {
    const text = argv.slice(1).join(" ").trim();
    if (!text) {
      console.error('error: provide goal text, e.g. goal set "Get one project to revenue"');
      return 1;
    }
    odyssey.ithaca = text;
    odyssey.set_at = (/* @__PURE__ */ new Date()).toISOString();
    odyssey.completed = false;
    gameState.state.odyssey = odyssey;
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
    odyssey.completed_at = (/* @__PURE__ */ new Date()).toISOString();
    gameState.state.odyssey = odyssey;
    await gameState.save();
    console.log("Ithaca reached.");
    console.log(`  "${odyssey.ithaca}"`);
    console.log("\nThe journey is complete. Start a new one with: goal set");
    return 0;
  }
  console.error(`error: unknown goal subcommand '${sub ?? ""}'. Use: set, status, complete`);
  return 1;
}
function runCompassHook(receipt, goal, hookCmd) {
  const receiptJson = JSON.stringify(receipt, null, 2);
  const cmd = hookCmd.replace("{goal}", goal ?? "").replace("{receipt_json}", receiptJson);
  try {
    const output = execSync(cmd, { encoding: "utf8", timeout: 6e4 }).trim();
    if (output) {
      console.log();
      console.log("  Compass " + "\u2500".repeat(48));
      for (const line of output.split("\n")) {
        console.log(`  ${line}`);
      }
      console.log("  " + "\u2500".repeat(56));
    }
  } catch (e) {
    if (e?.code === "ETIMEDOUT") {
      console.error("  (Compass hook timed out)");
    } else {
      console.error(`  (Compass hook error: ${e?.message ?? String(e)})`);
    }
  }
}
async function cmdWellness(argv) {
  const jsonMode = argv.includes("--json");
  const gameState = await GameState.create(resolve("."));
  const state = gameState.state;
  const today = (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
  const todayEvents = (state.events ?? []).filter(
    (e) => e?.timestamp?.startsWith(today) && e?.type === "receipt.submitted"
  );
  const receiptsToday = todayEvents.length;
  const shippedToday = receiptsToday > 0;
  const streakDays = state.streak?.current ?? 0;
  let sessionDurationMinutes = 0;
  let timeSinceLastBreakMinutes = 0;
  if (todayEvents.length > 0) {
    const timestamps = todayEvents.map((e) => new Date(e.timestamp).getTime()).filter(Boolean).sort((a, b) => a - b);
    const first = timestamps[0];
    const last = timestamps[timestamps.length - 1];
    sessionDurationMinutes = Math.round((last - first) / 6e4);
    timeSinceLastBreakMinutes = Math.round((Date.now() - last) / 6e4);
  }
  const signal = {
    sessionDurationMinutes,
    timeSinceLastBreakMinutes,
    receiptsToday,
    streakDays,
    shippedToday,
    readingAt: (/* @__PURE__ */ new Date()).toISOString()
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
function renderDailyDashboard(state, receiptsToday, streakDays) {
  const sep = "\u2500".repeat(56);
  const now = (/* @__PURE__ */ new Date()).toLocaleTimeString("en-US", { hour12: false });
  const today = (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
  const ithaca = state?.odyssey?.ithaca;
  const streakMult = (() => {
    if (streakDays >= 5) return "1.5x";
    if (streakDays >= 3) return "1.25x";
    if (streakDays >= 2) return "1.1x";
    return "1.0x";
  })();
  const todayEvents = (state.events ?? []).filter((e) => e?.timestamp?.startsWith(today) && e?.type === "receipt.submitted").slice(-5).reverse();
  let lines = [
    `  ship-receipts daily    ${now}`,
    `  ${sep}`,
    `  Streak:   ${streakDays} days   ${streakMult} multiplier`,
    `  Score:    ${state.total_score ?? 0} total   ${state.receipts_submitted ?? 0} receipts`
  ];
  if (ithaca) {
    const status = state?.odyssey?.completed ? "COMPLETE \u2713" : "in progress";
    lines.push(`  Ithaca:   ${ithaca.slice(0, 48)}`);
    lines.push(`            ${status}`);
  } else {
    lines.push(`  Ithaca:   (not set \u2014 run: ship-receipts goal set "...")`);
  }
  lines.push(`  ${sep}`);
  lines.push(`  Today (${today}):`);
  if (todayEvents.length === 0) {
    lines.push(`    no receipts yet today`);
  } else {
    for (const e of todayEvents) {
      const score = e?.payload?.score ?? 0;
      const hash = e?.payload?.receipt_hash?.slice(0, 12) ?? "???";
      lines.push(`    ${hash}  +${score} pts`);
    }
    lines.push(`    total today: ${receiptsToday} receipt${receiptsToday === 1 ? "" : "s"}`);
  }
  lines.push(`  ${sep}`);
  lines.push(`  Ctrl+C to exit`);
  return lines.join("\n");
}
async function cmdDaily(argv) {
  const watchMode = argv.includes("--watch");
  const intervalIdx = argv.indexOf("--interval");
  const intervalSec = intervalIdx !== -1 ? parseInt(argv[intervalIdx + 1] ?? "5", 10) : 5;
  const render = async () => {
    const gameState = await GameState.create(resolve("."));
    const state = gameState.state;
    const today = (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
    const receiptsToday = (state.events ?? []).filter(
      (e) => e?.timestamp?.startsWith(today) && e?.type === "receipt.submitted"
    ).length;
    const streakDays = state.streak?.current ?? 0;
    if (watchMode) {
      process.stdout.write("\x1B[2J\x1B[H");
    }
    console.log(renderDailyDashboard(state, receiptsToday, streakDays));
  };
  await render();
  if (!watchMode) return 0;
  const timer = setInterval(render, intervalSec * 1e3);
  await new Promise((resolve2) => {
    process.on("SIGINT", () => {
      clearInterval(timer);
      process.stdout.write("\x1B[2J\x1B[H");
      console.log("  Goodbye.");
      resolve2();
    });
  });
  return 0;
}
async function loadConfig() {
  const configPath = join4(homedir2(), ".ship-receipts", "config.json");
  try {
    const raw = await readFile4(configPath, "utf8");
    return JSON.parse(raw);
  } catch {
    return {};
  }
}
async function main(argv = process.argv.slice(2)) {
  if (argv.length === 0) {
    console.log(usage());
    return 1;
  }
  const command = argv[0];
  try {
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
    if (command === "mint") {
      return await cmdMint(argv.slice(1));
    }
    if (command === "export") {
      const { receiptPath, outputPath } = parseExportArgs(argv.slice(1));
      return await cmdExport(resolve(receiptPath), outputPath ? resolve(outputPath) : void 0);
    }
  } catch (error) {
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
var invokedPath = process.argv[1] ? resolve(process.argv[1]) : "";
var currentModulePath = fileURLToPath(import.meta.url);
if (existsSync(invokedPath) && invokedPath === currentModulePath) {
  main().then((code) => process.exit(code));
}
export {
  main
};
