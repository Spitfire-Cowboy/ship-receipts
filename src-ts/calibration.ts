import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";

export type VerificationResult = "pass" | "fail" | "skipped";

export type CalibrationSnapshot = {
  score: number | null;
  predictionsN: number | null;
  warning?: string;
};

type VerificationOutcome = {
  confidence: number;
  observed: 0 | 1;
};

const DEFAULT_CONTEXT_STORE_PATH = join(homedir(), ".ship-receipts", "context-store.jsonl");
const DEFAULT_WINDOW_SIZE = 20;

function getPath(record: unknown, path: string[]): unknown {
  let cursor: unknown = record;
  for (const key of path) {
    if (!cursor || typeof cursor !== "object" || !(key in (cursor as Record<string, unknown>))) {
      return undefined;
    }
    cursor = (cursor as Record<string, unknown>)[key];
  }
  return cursor;
}

function pickFirst(record: unknown, paths: string[][]): unknown {
  for (const path of paths) {
    const value = getPath(record, path);
    if (value !== undefined) return value;
  }
  return undefined;
}

function normalizeAgent(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  return normalized.length > 0 ? normalized : null;
}

function normalizeConfidence(value: unknown): number | null {
  if (typeof value !== "number" || Number.isNaN(value)) return null;
  if (value < 0 || value > 1) return null;
  return value;
}

function normalizeObservedResult(value: unknown): 0 | 1 | null {
  if (value === true) return 1;
  if (value === false) return 0;
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  if (normalized === "pass") return 1;
  if (normalized === "fail") return 0;
  if (normalized === "skipped") return null;
  return null;
}

function looksLikeVerificationOutcome(record: unknown): boolean {
  const type = pickFirst(record, [["type"], ["event_type"], ["kind"], ["payload", "type"]]);
  if (typeof type === "string" && type.trim().toLowerCase() === "verification_outcome") return true;

  const result = pickFirst(record, [
    ["verification_result"],
    ["result"],
    ["outcome"],
    ["payload", "verification_result"],
    ["payload", "result"],
    ["payload", "outcome"],
  ]);
  return result !== undefined;
}

function extractVerificationOutcome(record: unknown): VerificationOutcome | null {
  if (!looksLikeVerificationOutcome(record)) return null;

  const confidence = normalizeConfidence(pickFirst(record, [
    ["shot_call_confidence"],
    ["confidence"],
    ["predicted_probability"],
    ["payload", "shot_call_confidence"],
    ["payload", "confidence"],
    ["payload", "predicted_probability"],
  ]));

  if (confidence === null) return null;

  const observed = normalizeObservedResult(pickFirst(record, [
    ["verification_result"],
    ["result"],
    ["outcome"],
    ["payload", "verification_result"],
    ["payload", "result"],
    ["payload", "outcome"],
  ]));

  if (observed === null) return null;
  return { confidence, observed };
}

function computeBrierScore(outcomes: VerificationOutcome[]): number {
  if (outcomes.length === 0) return Number.NaN;
  const total = outcomes.reduce((sum, item) => {
    const error = item.confidence - item.observed;
    return sum + error * error;
  }, 0);
  return Number((total / outcomes.length).toFixed(6));
}

export async function readAgentCalibration(
  agentName: string,
  options: { contextStorePath?: string; windowSize?: number } = {},
): Promise<CalibrationSnapshot> {
  const normalizedAgent = normalizeAgent(agentName);
  if (!normalizedAgent) {
    return {
      score: null,
      predictionsN: null,
      warning: "agent name is required to compute calibration",
    };
  }

  const contextStorePath = options.contextStorePath ?? DEFAULT_CONTEXT_STORE_PATH;
  const windowSize = options.windowSize ?? DEFAULT_WINDOW_SIZE;

  let raw: string;
  try {
    raw = await readFile(contextStorePath, "utf8");
  } catch (error: any) {
    return {
      score: null,
      predictionsN: null,
      warning: `unable to read context store at ${contextStorePath}: ${error?.message ?? String(error)}`,
    };
  }

  const lines = raw
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  const outcomes: VerificationOutcome[] = [];
  for (let i = lines.length - 1; i >= 0; i -= 1) {
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(lines[i]) as Record<string, unknown>;
    } catch {
      continue;
    }

    const rowAgent = normalizeAgent(pickFirst(parsed, [
      ["agent_name"],
      ["agent"],
      ["payload", "agent_name"],
      ["payload", "agent"],
      ["metadata", "agent_name"],
      ["metadata", "agent"],
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
    predictionsN: outcomes.length,
  };
}
