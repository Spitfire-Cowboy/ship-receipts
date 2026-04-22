import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ulid } from "ulid";
import { computeContentHash } from "../scoring/hash-validator.js";

type Receipt = Record<string, any>;
type GameState = Record<string, any> | null | undefined;

const GITHUB_URL_RE = /^https?:\/\/github\.com\/([a-zA-Z0-9](?:[a-zA-Z0-9]|-(?=[a-zA-Z0-9])){0,38})/;

export function extractActor(receipt: Receipt): Record<string, any> {
  const subject = receipt.subject ?? {};
  const profiles = Array.isArray(subject.profiles) ? subject.profiles : [];
  let githubUsername: string | null = null;
  const profileUrls: string[] = [];

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
    profile_urls: profileUrls,
  };
}

function extractLocalSnapshot(receipt: Receipt, gameState: Record<string, any>): Record<string, any> | null {
  const contentHash = receipt?.meta?.content_hash || computeContentHash(receipt);
  const history = Array.isArray(gameState?.history) ? gameState.history : [];
  for (const entry of history) {
    if (entry?.receipt_hash === contentHash) {
      return {
        base_score: entry.breakdown.base,
        final_score: entry.score,
        streak_days: gameState?.streak?.current ?? 0,
        streak_multiplier: entry.breakdown.streak_multiplier ?? 1.0,
        integrity_multiplier: entry.breakdown.integrity_multiplier ?? 1.0,
        computed_at: new Date().toISOString(),
      };
    }
  }
  return null;
}

export function exportProofEnvelope(receipt: Receipt, gameState?: GameState): Record<string, any> {
  const actor = extractActor(receipt);
  const contentHash = computeContentHash(receipt);

  const envelope: Record<string, any> = {
    envelope_version: "1.0",
    envelope_id: ulid(),
    content_hash: contentHash,
    submitted_at: new Date().toISOString().replace(/\.\d{3}Z$/, "Z"),
    actor,
    receipt,
    export_metadata: {
      generator: "ship-receipts",
      generator_version: "0.1.0",
      ship_receipts_schema_version: receipt.version ?? "0.1",
    },
  };

  if (gameState) {
    const snapshot = extractLocalSnapshot(receipt, gameState);
    if (snapshot) envelope.local_score_snapshot = snapshot;
  }

  return envelope;
}

export async function readGameStateIfPresent(rootDir = "."): Promise<Record<string, any> | null> {
  try {
    const raw = await readFile(join(rootDir, ".ship-receipts", "game-state.json"), "utf8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}
