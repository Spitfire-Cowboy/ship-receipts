import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { createServer } from "node:http";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";

type JsonObject = Record<string, any>;

export type ShipReceiptV1 = {
  schema: "ship-receipt/v1";
  receipt_id: string;
  issued_at: string;
  event: {
    work_id: string;
    actor: string;
    summary: string;
    artifacts?: string[];
    pr?: string | null;
    commit?: string;
  };
  proof: {
    method: "sha256-canonical-json";
    digest: string;
  };
};

export type RunwayLoadResult = {
  receipts: ShipReceiptV1[];
  skipped: string[];
};

export type RunwayGitBuildOptions = {
  cwd?: string;
  days?: number;
  limit?: number;
  author?: string;
};

export type RunwayPreviewServer = {
  close(): Promise<void>;
  host: string;
  outputDir: string;
  port: number;
  url: string;
};

type GitCommitRecord = {
  sha: string;
  issuedAt: string;
  author: string;
  summary: string;
  artifacts: string[];
};

function sortJson(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortJson);
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, nested]) => [key, sortJson(nested)]),
    );
  }
  return value;
}

function canonicalJson(data: Record<string, any>): string {
  return JSON.stringify(sortJson(data));
}

function sha256Hex(text: string): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

function git(args: string[], cwd: string): string {
  return execFileSync("git", args, {
    cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "unknown";
}

function parseGithubRepo(remoteUrl: string): { owner: string; repo: string } | null {
  const ssh = remoteUrl.match(/^git@github\.com:([^/]+)\/(.+?)(?:\.git)?$/);
  if (ssh) return { owner: ssh[1], repo: ssh[2] };

  const https = remoteUrl.match(/^https?:\/\/github\.com\/([^/]+)\/(.+?)(?:\.git)?$/);
  if (https) return { owner: https[1], repo: https[2] };

  return null;
}

function inferRepoName(cwd: string): string {
  try {
    const remoteUrl = git(["remote", "get-url", "origin"], cwd);
    const githubRepo = parseGithubRepo(remoteUrl);
    if (githubRepo) return slugify(githubRepo.repo);
    const tail = remoteUrl.replace(/\.git$/, "").split(/[/:]/).pop();
    if (tail) return slugify(tail);
  } catch {}

  return slugify(resolve(cwd).split("/").pop() ?? "repo");
}

function inferWorkSurface(artifacts: string[]): string {
  const topLevels = artifacts
    .filter(Boolean)
    .map((artifact) => artifact.split("/")[0])
    .filter((segment) => segment && segment !== ".");

  const nonRoot = topLevels.filter((segment) => !segment.includes("."));
  if (nonRoot.length === 0) return "repo";

  const counts = new Map<string, number>();
  for (const segment of nonRoot) {
    counts.set(segment, (counts.get(segment) ?? 0) + 1);
  }

  const sorted = [...counts.entries()].sort((left, right) => {
    if (right[1] !== left[1]) return right[1] - left[1];
    return left[0].localeCompare(right[0]);
  });

  if (sorted.length === 0) return "repo";
  if (sorted.length === 1) return slugify(sorted[0][0]);
  if (sorted[0][1] > sorted[1][1]) return slugify(sorted[0][0]);
  return "repo";
}

function buildPullRequestUrl(summary: string, cwd: string): string | null {
  const githubRepo = (() => {
    try {
      return parseGithubRepo(git(["remote", "get-url", "origin"], cwd));
    } catch {
      return null;
    }
  })();
  if (!githubRepo) return null;

  const match = summary.match(/\(#(\d+)\)(?!.*\(#\d+\))/);
  if (!match) return null;
  return `https://github.com/${githubRepo.owner}/${githubRepo.repo}/pull/${match[1]}`;
}

function buildGitShipReceipt(repoName: string, cwd: string, record: GitCommitRecord): ShipReceiptV1 {
  const eventId = `evt_${record.sha.slice(0, 12)}`;
  const eventCore = {
    event_id: eventId,
    signal: "SHIP",
    work_id: `${repoName}/${inferWorkSurface(record.artifacts)}`,
    actor: `agent:${slugify(record.author)}`,
    summary: record.summary,
    commit: record.sha.slice(0, 12),
    pr: buildPullRequestUrl(record.summary, cwd),
    artifacts: record.artifacts.slice(0, 8),
  };

  const eventHash = sha256Hex(canonicalJson(eventCore));
  const receiptCore = {
    schema: "ship-receipt/v1" as const,
    receipt_id: `rcpt_${eventId}`,
    issued_at: record.issuedAt,
    event: {
      ...eventCore,
      event_hash: eventHash,
    },
  };

  return {
    ...receiptCore,
    proof: {
      method: "sha256-canonical-json",
      digest: sha256Hex(canonicalJson(receiptCore)),
    },
  };
}

export function buildRunwayReceiptsFromGitHistory(
  records: GitCommitRecord[],
  options: { repoName: string; cwd: string },
): ShipReceiptV1[] {
  return records.map((record) => buildGitShipReceipt(options.repoName, options.cwd, record));
}

export function collectGitCommitRecords(options: RunwayGitBuildOptions = {}): GitCommitRecord[] {
  const cwd = resolve(options.cwd ?? ".");
  const days = options.days ?? 30;
  const limit = options.limit ?? 40;
  const since = new Date(Date.now() - days * 86400 * 1000).toISOString();
  const args = ["log", `--since=${since}`, `-n`, String(limit), "--format=%H%x1f%aI%x1f%an%x1f%s"];
  if (options.author) {
    args.splice(1, 0, `--author=${options.author}`);
  }

  const output = git(args, cwd);
  if (!output) return [];

  return output
    .split("\n")
    .filter(Boolean)
    .map((line) => {
      const [sha, issuedAt, author, summary] = line.split("\u001f");
      const artifacts = git(["show", "--pretty=format:", "--name-only", "--diff-filter=AMR", sha], cwd)
        .split("\n")
        .map((artifact) => artifact.trim())
        .filter(Boolean);
      return {
        sha,
        issuedAt,
        author,
        summary,
        artifacts,
      };
    });
}

export function loadRunwayReceiptsFromGit(options: RunwayGitBuildOptions = {}): RunwayLoadResult {
  const cwd = resolve(options.cwd ?? ".");
  const repoName = inferRepoName(cwd);
  const records = collectGitCommitRecords({ ...options, cwd });
  return {
    receipts: buildRunwayReceiptsFromGitHistory(records, { repoName, cwd }).sort((left, right) => right.issued_at.localeCompare(left.issued_at)),
    skipped: [],
  };
}

export function normalizeRunwayReceipt(receipt: JsonObject): ShipReceiptV1 | null {
  if (receipt?.schema !== "ship-receipt/v1") return null;
  if (typeof receipt?.receipt_id !== "string" || receipt.receipt_id.length === 0) return null;
  if (typeof receipt?.issued_at !== "string" || receipt.issued_at.length === 0) return null;
  if (!receipt?.event || typeof receipt.event !== "object") return null;
  if (typeof receipt.event.work_id !== "string" || receipt.event.work_id.length === 0) return null;
  if (typeof receipt.event.actor !== "string" || receipt.event.actor.length === 0) return null;
  if (typeof receipt.event.summary !== "string" || receipt.event.summary.length === 0) return null;

  const issuedAt = new Date(receipt.issued_at);
  if (Number.isNaN(issuedAt.getTime())) return null;

  const artifacts = Array.isArray(receipt.event.artifacts)
    ? receipt.event.artifacts.filter((artifact: unknown): artifact is string => typeof artifact === "string" && artifact.length > 0)
    : [];

  return {
    schema: "ship-receipt/v1",
    receipt_id: receipt.receipt_id,
    issued_at: issuedAt.toISOString(),
    event: {
      work_id: receipt.event.work_id,
      actor: receipt.event.actor,
      summary: receipt.event.summary,
      artifacts,
      pr: typeof receipt.event.pr === "string" ? receipt.event.pr : null,
      commit: typeof receipt.event.commit === "string" ? receipt.event.commit : "",
    },
    proof: receipt?.proof?.method === "sha256-canonical-json" && typeof receipt?.proof?.digest === "string"
      ? {
          method: "sha256-canonical-json",
          digest: receipt.proof.digest,
        }
      : {
          method: "sha256-canonical-json",
          digest: "",
        },
  };
}

async function readJson(path: string): Promise<JsonObject> {
  const raw = await readFile(path, "utf8");
  return JSON.parse(raw) as JsonObject;
}

export async function loadRunwayReceiptsFromFeed(feedPath: string): Promise<RunwayLoadResult> {
  const payload = await readJson(resolve(feedPath));
  if (!Array.isArray(payload)) {
    throw new Error("runway feed must be a JSON array");
  }

  const receipts: ShipReceiptV1[] = [];
  const skipped: string[] = [];

  for (let index = 0; index < payload.length; index += 1) {
    const normalized = normalizeRunwayReceipt(payload[index] as JsonObject);
    if (normalized) {
      receipts.push(normalized);
      continue;
    }
    skipped.push(`feed[${index}]`);
  }

  receipts.sort((left, right) => right.issued_at.localeCompare(left.issued_at));
  return { receipts, skipped };
}

export async function loadRunwayReceiptsFromFiles(receiptPaths: string[]): Promise<RunwayLoadResult> {
  const receipts: ShipReceiptV1[] = [];
  const skipped: string[] = [];

  for (const path of receiptPaths) {
    const normalized = normalizeRunwayReceipt(await readJson(path));
    if (normalized) {
      receipts.push(normalized);
      continue;
    }
    skipped.push(resolve(path));
  }

  receipts.sort((left, right) => right.issued_at.localeCompare(left.issued_at));
  return { receipts, skipped };
}

export function renderRunwayHtml(): string {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="robots" content="noindex" />
  <title>Runway | Ship Receipts</title>
  <style>
    :root {
      color-scheme: dark;
      --bg-0: #09111c;
      --bg-1: #0f1e31;
      --panel: rgba(11, 20, 33, 0.82);
      --panel-2: rgba(255, 255, 255, 0.05);
      --grid: rgba(124, 186, 255, 0.08);
      --accent: #8fd3ff;
      --amber: #ffb457;
      --text: #f4f7fb;
      --muted: #9fb2c7;
      --border: rgba(255, 255, 255, 0.09);
      --shadow: 0 24px 56px rgba(0, 0, 0, 0.34);
      --mono: "SFMono-Regular", "SF Mono", ui-monospace, monospace;
      --sans: "Iowan Old Style", "Palatino Linotype", "Book Antiqua", Palatino, Georgia, serif;
    }

    * { box-sizing: border-box; }

    body {
      margin: 0;
      min-height: 100vh;
      color: var(--text);
      font-family: var(--sans);
      background:
        linear-gradient(90deg, transparent 0 49.5%, var(--grid) 49.5% 50.5%, transparent 50.5% 100%),
        linear-gradient(var(--grid) 1px, transparent 1px),
        linear-gradient(90deg, var(--grid) 1px, transparent 1px),
        radial-gradient(circle at top, rgba(143, 211, 255, 0.18), transparent 28%),
        linear-gradient(180deg, var(--bg-0), var(--bg-1));
      background-size: auto, 100% 88px, 88px 100%, auto, auto;
    }

    main {
      max-width: 1180px;
      margin: 0 auto;
      padding: 24px 18px 56px;
    }

    .shell,
    .panel,
    .day-card,
    .empty-state {
      border: 1px solid var(--border);
      border-radius: 26px;
      background: var(--panel);
      box-shadow: var(--shadow);
      backdrop-filter: blur(16px);
    }

    .shell {
      display: flex;
      justify-content: space-between;
      gap: 12px;
      align-items: center;
      padding: 14px 16px;
      margin-bottom: 18px;
    }

    .brand {
      display: inline-flex;
      gap: 10px;
      align-items: center;
      text-decoration: none;
      color: inherit;
      font-weight: 700;
      letter-spacing: 0.02em;
    }

    .mark {
      width: 14px;
      height: 14px;
      border-radius: 999px;
      background: linear-gradient(135deg, var(--accent), var(--amber));
      box-shadow: 0 0 0 8px rgba(143, 211, 255, 0.12);
      flex: none;
    }

    .chip {
      font-family: var(--mono);
      font-size: 12px;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      color: var(--muted);
    }

    .hero {
      display: grid;
      grid-template-columns: minmax(0, 1.35fr) minmax(300px, 0.95fr);
      gap: 18px;
      margin-bottom: 18px;
    }

    .panel {
      padding: 26px;
    }

    h1 {
      margin: 8px 0 0;
      font-size: clamp(2.7rem, 6vw, 4.8rem);
      line-height: 0.94;
      letter-spacing: -0.05em;
      max-width: 9ch;
    }

    .lede,
    .stat-copy,
    .flight-work,
    .footer {
      color: var(--muted);
      line-height: 1.65;
    }

    .lede {
      margin: 16px 0 0;
      max-width: 34ch;
      font-size: 17px;
    }

    .badges,
    .filters,
    .flight-tags,
    .artifact-list,
    .flight-links {
      display: flex;
      gap: 10px;
      flex-wrap: wrap;
    }

    .badge,
    .filter-chip,
    .flight-tag,
    .artifact {
      border-radius: 999px;
      border: 1px solid rgba(143, 211, 255, 0.18);
      background: rgba(143, 211, 255, 0.08);
      color: var(--accent);
      padding: 8px 12px;
      font-family: var(--mono);
      font-size: 12px;
    }

    .badge.warn {
      border-color: rgba(255, 180, 87, 0.24);
      background: rgba(255, 180, 87, 0.08);
      color: var(--amber);
    }

    .stats {
      display: grid;
      gap: 12px;
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .stat {
      min-height: 134px;
      padding: 18px;
      border-radius: 22px;
      background: linear-gradient(180deg, rgba(255, 255, 255, 0.06), var(--panel-2));
      border: 1px solid var(--border);
    }

    .stat-label,
    .section-label,
    .artifact-count {
      margin: 0;
      font-family: var(--mono);
      font-size: 12px;
      letter-spacing: 0.14em;
      text-transform: uppercase;
      color: var(--muted);
    }

    .stat-value {
      font-size: clamp(2rem, 4vw, 3rem);
      line-height: 1;
      margin: 10px 0 0;
      letter-spacing: -0.05em;
    }

    .controls {
      padding: 18px;
      margin-bottom: 18px;
    }

    .controls-head {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 12px;
      flex-wrap: wrap;
      margin-bottom: 12px;
    }

    .search {
      width: 100%;
      min-height: 50px;
      border-radius: 18px;
      border: 1px solid var(--border);
      background: rgba(255, 255, 255, 0.04);
      color: inherit;
      padding: 0 16px;
      font: inherit;
      font-size: 16px;
    }

    .search::placeholder {
      color: rgba(255, 255, 255, 0.44);
    }

    .filter-chip {
      color: var(--muted);
      cursor: pointer;
    }

    .filter-chip.is-active {
      background: linear-gradient(135deg, rgba(143, 211, 255, 0.2), rgba(255, 180, 87, 0.14));
      color: var(--text);
    }

    .timeline {
      display: grid;
      gap: 16px;
    }

    .pagination {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 12px;
      margin: 18px 0;
      padding: 16px 18px;
      flex-wrap: wrap;
    }

    .pagination[hidden] {
      display: none;
    }

    .pagination-meta {
      color: var(--muted);
      font-family: var(--mono);
      font-size: 12px;
      letter-spacing: 0.12em;
      text-transform: uppercase;
    }

    .pagination-actions {
      display: flex;
      gap: 10px;
      flex-wrap: wrap;
    }

    .pagination-button {
      border-radius: 999px;
      border: 1px solid rgba(143, 211, 255, 0.18);
      background: rgba(143, 211, 255, 0.08);
      color: var(--text);
      padding: 10px 14px;
      font-family: var(--mono);
      font-size: 12px;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      cursor: pointer;
    }

    .pagination-button[disabled] {
      cursor: not-allowed;
      opacity: 0.45;
    }

    .day-card {
      padding: 22px;
    }

    .day-head,
    .flight-top {
      display: flex;
      justify-content: space-between;
      gap: 12px;
      align-items: flex-start;
      flex-wrap: wrap;
    }

    .day-title {
      margin: 8px 0 0;
      font-size: 1.8rem;
    }

    .day-count,
    .flight-time {
      font-family: var(--mono);
      font-size: 12px;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      color: var(--muted);
    }

    .flight-list {
      display: grid;
      gap: 14px;
      margin-top: 16px;
    }

    .flight-card {
      padding: 18px;
      border-radius: 20px;
      background: rgba(255, 255, 255, 0.04);
      border: 1px solid rgba(255, 255, 255, 0.06);
    }

    .flight-title {
      margin: 12px 0 0;
      font-size: 1.35rem;
      line-height: 1.2;
    }

    .flight-work {
      margin: 10px 0 0;
      font-family: var(--mono);
      font-size: 13px;
    }

    .flight-links,
    .flight-links a {
      margin-top: 12px;
      color: var(--accent);
      font-family: var(--mono);
      font-size: 12px;
    }

    .artifact-list {
      margin-top: 10px;
    }

    .artifact-summary {
      margin-top: 10px;
      color: var(--muted);
      font-family: var(--mono);
      font-size: 12px;
      line-height: 1.6;
    }

    .artifact-overflow {
      color: var(--amber);
    }

    .empty-state {
      padding: 22px;
      margin-top: 18px;
      text-align: center;
      color: var(--muted);
    }

    .footer {
      margin-top: 18px;
      text-align: center;
      font-size: 14px;
    }

    @media (max-width: 900px) {
      .hero {
        grid-template-columns: 1fr;
      }

      .stats {
        grid-template-columns: 1fr 1fr;
      }
    }

    @media (max-width: 640px) {
      .stats {
        grid-template-columns: 1fr;
      }

      main {
        padding: 18px 14px 40px;
      }
    }
  </style>
</head>
<body>
  <main>
    <header class="shell" aria-label="Runway navigation">
      <a class="brand" href="https://github.com/Spitfire-Cowboy/ship-receipts">
        <span class="mark" aria-hidden="true"></span>
        <span>ship-receipts runway</span>
      </a>
      <span class="chip" id="feed-label">loading runway feed</span>
    </header>

    <section class="hero">
      <article class="panel">
        <p class="section-label">Receipt viewer</p>
        <h1>Runway</h1>
        <p class="lede">
          Static timeline view for <code>ship-receipt/v1</code> entries. Point the CLI at
          real receipt JSON, export this bundle, and serve the directory anywhere.
        </p>
        <div class="badges">
          <span class="badge">Static HTML</span>
          <span class="badge">ship-receipt/v1</span>
          <span class="badge warn">real receipt feed</span>
        </div>
      </article>
      <section class="stats">
        <article class="stat">
          <p class="stat-label">Visible receipts</p>
          <p class="stat-value" id="stat-total">0</p>
          <p class="stat-copy">Receipt-backed launches currently on the runway.</p>
        </article>
        <article class="stat">
          <p class="stat-label">Projects</p>
          <p class="stat-value" id="stat-projects">0</p>
          <p class="stat-copy">Unique project prefixes inferred from <code>event.work_id</code>.</p>
        </article>
        <article class="stat">
          <p class="stat-label">Artifacts</p>
          <p class="stat-value" id="stat-artifacts">0</p>
          <p class="stat-copy">Artifact refs attached across the currently visible receipts.</p>
        </article>
        <article class="stat">
          <p class="stat-label">Latest ship</p>
          <p class="stat-value" id="stat-latest">--</p>
          <p class="stat-copy" id="stat-latest-copy">Waiting for feed.</p>
        </article>
      </section>
    </section>

    <section class="panel controls">
      <div class="controls-head">
        <p class="section-label">Filter runway</p>
        <span class="chip" id="results-label">0 visible</span>
      </div>
      <div class="filters" id="project-filters"></div>
      <input class="search" id="runway-search" type="search" placeholder="summary, work id, artifact, actor" />
    </section>

    <section class="panel pagination" id="pagination" hidden>
      <span class="pagination-meta" id="pagination-meta">Page 1 of 1</span>
      <div class="pagination-actions">
        <button class="pagination-button" id="pagination-prev" type="button">Previous</button>
        <button class="pagination-button" id="pagination-next" type="button">Next</button>
      </div>
    </section>

    <section class="timeline" id="timeline"></section>
    <section class="empty-state" id="empty-state" hidden>
      No runway matches this filter. Clear search or switch projects.
    </section>

    <footer class="footer">
      Generated by <code>ship-receipts runway build</code> from <code>ship-receipt/v1</code> entries.
    </footer>
  </main>

  <script>
    (function () {
      var FEED_URL = './receipts.json';
      var PAGE_SIZE = 8;

      function escapeHtml(value) {
        return String(value == null ? '' : value).replace(/[&<>"']/g, function (ch) {
          return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch];
        });
      }

      function safeHttpUrl(value) {
        try {
          var url = new URL(String(value || ''), window.location.origin);
          if (url.protocol === 'http:' || url.protocol === 'https:') return url.href;
        } catch (_) {}
        return '';
      }

      function titleCase(value) {
        return value.replace(/[-_]/g, ' ').replace(/\\b\\w/g, function (match) {
          return match.toUpperCase();
        });
      }

      function shortCommit(value) {
        return value ? value.slice(0, 10) : 'no commit';
      }

      function formatDay(date) {
        return new Intl.DateTimeFormat(undefined, {
          weekday: 'short',
          month: 'short',
          day: 'numeric'
        }).format(date);
      }

      function formatTime(date) {
        return new Intl.DateTimeFormat(undefined, {
          hour: 'numeric',
          minute: '2-digit'
        }).format(date);
      }

      function formatShortDate(date) {
        return new Intl.DateTimeFormat(undefined, {
          month: 'short',
          day: 'numeric'
        }).format(date);
      }

      function normalize(receipt) {
        if (!receipt || typeof receipt !== 'object') return null;
        if (receipt.schema !== 'ship-receipt/v1') return null;
        if (!receipt.event || typeof receipt.event !== 'object') return null;
        if (typeof receipt.issued_at !== 'string') return null;

        var issuedAt = new Date(receipt.issued_at);
        if (Number.isNaN(issuedAt.getTime())) return null;

        var rawWorkId = typeof receipt.event.work_id === 'string' ? receipt.event.work_id : '';
        var workId = rawWorkId || 'unknown/unknown';
        var parts = workId.split('/');
        var project = parts[0] || 'unknown';
        var surface = parts.slice(1).join('/') || workId;
        var actor = typeof receipt.event.actor === 'string' ? receipt.event.actor : 'agent:unknown';
        actor = actor.replace(/^agent:/, '');

        var artifacts = Array.isArray(receipt.event.artifacts)
          ? receipt.event.artifacts.filter(function (artifact) { return typeof artifact === 'string' && artifact.length > 0; })
          : [];
        var summary = typeof receipt.event.summary === 'string' ? receipt.event.summary : '';
        var pr = typeof receipt.event.pr === 'string' ? receipt.event.pr : '';
        var commit = typeof receipt.event.commit === 'string' ? receipt.event.commit : '';
        var receiptId = typeof receipt.receipt_id === 'string' ? receipt.receipt_id : '';

        var haystack = [
          receiptId,
          summary,
          workId,
          actor,
          project,
          artifacts.join(' ')
        ].join(' ').toLowerCase();

        return {
          receiptId: receiptId,
          summary: summary,
          workId: workId,
          project: project,
          projectLabel: titleCase(project),
          surface: titleCase(surface),
          actor: actor,
          actorLabel: titleCase(actor),
          issuedAt: issuedAt,
          dayKey: issuedAt.toISOString().slice(0, 10),
          artifacts: artifacts,
          pr: pr,
          commit: commit,
          haystack: haystack
        };
      }

      var state = {
        page: 1,
        project: 'all',
        query: '',
        receipts: []
      };

      var projectFilters = document.getElementById('project-filters');
      var searchInput = document.getElementById('runway-search');
      var timeline = document.getElementById('timeline');
      var emptyState = document.getElementById('empty-state');
      var feedLabel = document.getElementById('feed-label');
      var resultsLabel = document.getElementById('results-label');
      var pagination = document.getElementById('pagination');
      var paginationMeta = document.getElementById('pagination-meta');
      var paginationPrev = document.getElementById('pagination-prev');
      var paginationNext = document.getElementById('pagination-next');

      function getVisibleReceipts() {
        return state.receipts.filter(function (item) {
          var matchesProject = state.project === 'all' || item.project === state.project;
          var matchesQuery = !state.query || item.haystack.indexOf(state.query) !== -1;
          return matchesProject && matchesQuery;
        });
      }

      function groupByDay(items) {
        return items.reduce(function (map, item) {
          if (!map[item.dayKey]) map[item.dayKey] = [];
          map[item.dayKey].push(item);
          return map;
        }, {});
      }

      function paginate(items) {
        var totalPages = Math.max(1, Math.ceil(items.length / PAGE_SIZE));
        if (state.page > totalPages) state.page = totalPages;
        if (state.page < 1) state.page = 1;
        var start = (state.page - 1) * PAGE_SIZE;
        return {
          pageItems: items.slice(start, start + PAGE_SIZE),
          totalPages: totalPages
        };
      }

      function renderFilters() {
        var counts = {};
        state.receipts.forEach(function (item) {
          counts[item.project] = (counts[item.project] || 0) + 1;
        });

        var projects = Object.keys(counts).sort();
        var chips = [
          '<button class="filter-chip' + (state.project === 'all' ? ' is-active' : '') + '" data-project="all" type="button">All <span>' + state.receipts.length + '</span></button>'
        ];

        projects.forEach(function (project) {
          chips.push(
            '<button class="filter-chip' + (state.project === project ? ' is-active' : '') + '" data-project="' + escapeHtml(project) + '" type="button">' +
              escapeHtml(titleCase(project)) + ' <span>' + String(counts[project]) + '</span>' +
            '</button>'
          );
        });

        projectFilters.innerHTML = chips.join('');
      }

      function renderStats(visible) {
        var artifactCount = visible.reduce(function (count, item) {
          return count + item.artifacts.length;
        }, 0);
        var projects = new Set(visible.map(function (item) { return item.project; }));
        var latest = visible[0];

        document.getElementById('stat-total').textContent = String(visible.length);
        document.getElementById('stat-projects').textContent = String(projects.size);
        document.getElementById('stat-artifacts').textContent = String(artifactCount);
        document.getElementById('stat-latest').textContent = latest ? formatShortDate(latest.issuedAt) : '--';
        document.getElementById('stat-latest-copy').textContent = latest ? latest.summary : 'Waiting for feed.';
        resultsLabel.textContent = String(visible.length) + ' visible';
      }

      function renderPagination(totalVisible, totalPages) {
        if (!totalVisible || totalPages <= 1) {
          pagination.hidden = true;
          paginationMeta.textContent = 'Page 1 of 1';
          paginationPrev.disabled = true;
          paginationNext.disabled = true;
          return;
        }

        pagination.hidden = false;
        var start = (state.page - 1) * PAGE_SIZE + 1;
        var end = Math.min(totalVisible, state.page * PAGE_SIZE);
        paginationMeta.textContent = 'Page ' + String(state.page) + ' of ' + String(totalPages) + ' • Showing ' + String(start) + '–' + String(end) + ' of ' + String(totalVisible);
        paginationPrev.disabled = state.page <= 1;
        paginationNext.disabled = state.page >= totalPages;
      }

      function renderTimeline(pageItems) {
        if (!pageItems.length) {
          timeline.innerHTML = '';
          emptyState.hidden = false;
          return;
        }

        emptyState.hidden = true;
        var groups = groupByDay(pageItems);
        var dayKeys = Object.keys(groups).sort().reverse();
        timeline.innerHTML = dayKeys.map(function (dayKey) {
          var flights = groups[dayKey];
          var dayTitle = formatDay(flights[0].issuedAt);

          var cards = flights.map(function (item) {
            var previewArtifacts = item.artifacts.slice(0, 3);
            var artifactHtml = previewArtifacts.map(function (artifact) {
              return '<span class="artifact">' + escapeHtml(artifact) + '</span>';
            }).join('');
            var overflowCount = Math.max(0, item.artifacts.length - previewArtifacts.length);
            var overflowHtml = overflowCount > 0
              ? '<p class="artifact-summary"><span class="artifact-overflow">+' + String(overflowCount) + ' more</span></p>'
              : '';

            var links = [];
            if (item.pr) {
              var prHref = safeHttpUrl(item.pr);
              if (prHref) links.push('<a href="' + prHref + '" target="_blank" rel="noreferrer noopener">GitHub link</a>');
            }
            if (item.commit) links.push('<span>commit ' + escapeHtml(shortCommit(item.commit)) + '</span>');
            links.push('<span>' + escapeHtml(item.receiptId) + '</span>');

            return (
              '<article class="flight-card">' +
                '<div class="flight-top">' +
                  '<div class="flight-tags">' +
                    '<span class="flight-tag">' + escapeHtml(item.projectLabel) + '</span>' +
                    '<span class="flight-tag">' + escapeHtml(item.actorLabel) + '</span>' +
                  '</div>' +
                  '<time class="flight-time" datetime="' + item.issuedAt.toISOString() + '">' + formatTime(item.issuedAt) + '</time>' +
                '</div>' +
                '<h3 class="flight-title">' + escapeHtml(item.summary) + '</h3>' +
                '<p class="flight-work">' + escapeHtml(item.workId) + '</p>' +
                '<div class="flight-links">' + links.join('') + '</div>' +
                '<div class="artifact-list">' +
                  '<p class="artifact-count">' + String(item.artifacts.length) + ' artifacts</p>' +
                  artifactHtml +
                  overflowHtml +
                '</div>' +
              '</article>'
            );
          }).join('');

          return (
            '<section class="day-card">' +
              '<div class="day-head">' +
                '<div>' +
                  '<p class="section-label">Runway lane</p>' +
                  '<h2 class="day-title">' + dayTitle + '</h2>' +
                '</div>' +
                '<span class="day-count">' + flights.length + ' ship event' + (flights.length === 1 ? '' : 's') + '</span>' +
              '</div>' +
              '<div class="flight-list">' + cards + '</div>' +
            '</section>'
          );
        }).join('');
      }

      function render() {
        var visible = getVisibleReceipts();
        var paginationState = paginate(visible);
        renderFilters();
        renderStats(visible);
        renderPagination(visible.length, paginationState.totalPages);
        renderTimeline(paginationState.pageItems);
      }

      projectFilters.addEventListener('click', function (event) {
        var target = event.target.closest('[data-project]');
        if (!target) return;
        state.project = target.getAttribute('data-project') || 'all';
        state.page = 1;
        render();
      });

      searchInput.addEventListener('input', function (event) {
        state.query = String(event.target.value || '').trim().toLowerCase();
        state.page = 1;
        render();
      });

      paginationPrev.addEventListener('click', function () {
        if (state.page <= 1) return;
        state.page -= 1;
        render();
      });

      paginationNext.addEventListener('click', function () {
        state.page += 1;
        render();
      });

      fetch(FEED_URL, { cache: 'no-store' })
        .then(function (response) {
          if (!response.ok) throw new Error('HTTP ' + response.status);
          return response.json();
        })
        .then(function (payload) {
          if (!Array.isArray(payload)) throw new Error('expected array payload');
          state.receipts = payload.map(normalize).filter(Boolean).sort(function (a, b) {
            return b.issuedAt.getTime() - a.issuedAt.getTime();
          });
          feedLabel.textContent = 'ship-receipt/v1 feed';
          render();
        })
        .catch(function (error) {
          feedLabel.textContent = 'feed unavailable';
          timeline.innerHTML = '';
          emptyState.hidden = false;
          emptyState.textContent = 'Could not load the runway feed: ' + error.message;
        });
    })();
  </script>
</body>
</html>
`;
}

export async function exportRunwaySite(receipts: ShipReceiptV1[], outputDir: string): Promise<{
  outputDir: string;
  indexPath: string;
  feedPath: string;
}> {
  const resolvedOutputDir = resolve(outputDir);
  await mkdir(resolvedOutputDir, { recursive: true });

  const indexPath = join(resolvedOutputDir, "index.html");
  const feedPath = join(resolvedOutputDir, "receipts.json");

  await writeFile(indexPath, `${renderRunwayHtml()}\n`, "utf8");
  await writeFile(feedPath, `${JSON.stringify(receipts, null, 2)}\n`, "utf8");

  return {
    outputDir: resolvedOutputDir,
    indexPath,
    feedPath,
  };
}

export async function startRunwayPreviewServer(
  outputDir: string,
  options: { host?: string; port?: number } = {},
): Promise<RunwayPreviewServer> {
  const resolvedOutputDir = resolve(outputDir);
  const host = options.host ?? "127.0.0.1";
  const port = options.port ?? 4173;
  const indexPath = join(resolvedOutputDir, "index.html");
  const feedPath = join(resolvedOutputDir, "receipts.json");

  const server = createServer(async (request, response) => {
    const isHead = request.method === "HEAD";
    const reply = async (status: number, headers: Record<string, string>, bodyPath?: string) => {
      response.writeHead(status, headers);
      if (!isHead && bodyPath) {
        response.end(await readFile(bodyPath));
        return;
      }
      response.end();
    };

    try {
      const pathname = new URL(request.url ?? "/", `http://${host}`).pathname;
      if (request.method !== "GET" && request.method !== "HEAD") {
        await reply(405, { "content-type": "text/plain; charset=utf-8" });
        return;
      }

      if (pathname === "/" || pathname === "/index.html") {
        await reply(200, { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" }, indexPath);
        return;
      }

      if (pathname === "/receipts.json") {
        await reply(200, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" }, feedPath);
        return;
      }

      await reply(404, { "content-type": "text/plain; charset=utf-8" });
    } catch {
      response.writeHead(500, { "content-type": "text/plain; charset=utf-8" });
      response.end("runway preview unavailable");
    }
  });

  await new Promise<void>((resolvePromise, rejectPromise) => {
    server.once("error", rejectPromise);
    server.listen(port, host, () => {
      server.off("error", rejectPromise);
      resolvePromise();
    });
  });

  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("could not determine preview server address");
  }

  return {
    host,
    outputDir: resolvedOutputDir,
    port: address.port,
    url: `http://${host}:${address.port}/`,
    close: async () => {
      await new Promise<void>((resolvePromise, rejectPromise) => {
        server.close((error) => {
          if (error) {
            rejectPromise(error);
            return;
          }
          resolvePromise();
        });
      });
    },
  };
}
