import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import {
  computeBaseScore,
  computeFinalScore,
  confidenceLevel,
  qualifiesForStreak,
  streakMultiplier,
} from "./engine.js";
import { computeContentHash, validateContentHash } from "./hash-validator.js";

export const STATE_DIR = ".ship-receipts";
export const STATE_FILE = "game-state.json";
const MAX_EVENTS = 1000;

type Receipt = Record<string, any>;
type State = Record<string, any>;
type ScoreReceiptOptions = {
  scoreDate?: string;
  eventTimestamp?: string;
};

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function isoAtStartOfDay(date: string): string {
  return `${date}T00:00:00Z`;
}

function normalizeScoreDate(value?: string): string {
  if (!value) return todayIso();
  return value.slice(0, 10);
}

function defaultState(): State {
  return {
    version: "1",
    subject: "",
    total_score: 0,
    receipts_submitted: 0,
    receipts_rejected: 0,
    streak: {
      current: 0,
      longest: 0,
      last_qualifying_date: null,
      streak_start_date: null,
    },
    history: [],
    events: [],
  };
}

function hasChecksum(receipt: Receipt): boolean {
  const artifacts = Array.isArray(receipt?.artifacts) ? receipt.artifacts : [];
  for (const artifact of artifacts) {
    const verify = Array.isArray(artifact?.verify) ? artifact.verify : [];
    for (const v of verify) {
      if (v?.kind === "checksum" && v?.algo && v?.hash) return true;
    }
  }
  return false;
}

export class GameState {
  rootDir: string;
  statePath: string;
  state: State;

  private constructor(rootDir: string, statePath: string, state: State) {
    this.rootDir = rootDir;
    this.statePath = statePath;
    this.state = state;
  }

  static async create(rootDir = "."): Promise<GameState> {
    const statePath = join(rootDir, STATE_DIR, STATE_FILE);
    try {
      const raw = await readFile(statePath, "utf8");
      return new GameState(rootDir, statePath, JSON.parse(raw));
    } catch {
      return new GameState(rootDir, statePath, defaultState());
    }
  }

  static fresh(rootDir = "."): GameState {
    const statePath = join(rootDir, STATE_DIR, STATE_FILE);
    return new GameState(rootDir, statePath, defaultState());
  }

  async save(): Promise<void> {
    await mkdir(join(this.rootDir, STATE_DIR), { recursive: true });
    await writeFile(this.statePath, `${JSON.stringify(this.state, null, 2)}\n`, "utf8");
  }

  private isDuplicate(contentHash: string): boolean {
    const history = Array.isArray(this.state.history) ? this.state.history : [];
    return history.some((h: any) => h?.receipt_hash === contentHash);
  }

  private emitEvent(eventType: string, payload: Record<string, any>, timestamp = new Date().toISOString()): void {
    const events = Array.isArray(this.state.events) ? this.state.events : [];
    events.push({
      type: eventType,
      timestamp,
      payload,
    });
    this.state.events = events.slice(-MAX_EVENTS);
  }

  private updateStreak(today: string, qualifies: boolean, eventTimestamp: string): void {
    const streak = this.state.streak;
    const lastDate = streak.last_qualifying_date as string | null;
    if (!qualifies) return;
    if (lastDate === today) return;

    if (!lastDate) {
      streak.current = 1;
      streak.last_qualifying_date = today;
      streak.streak_start_date = today;
    } else {
      const currentEpoch = Date.parse(`${today}T00:00:00Z`);
      const lastEpoch = Date.parse(`${lastDate}T00:00:00Z`);
      const delta = Math.floor((currentEpoch - lastEpoch) / 86400000);

      if (delta === 1) {
        streak.current += 1;
        streak.last_qualifying_date = today;
      } else if (delta > 1) {
        this.emitEvent("streak.broken", {
          previous_length: streak.current,
          break_date: today,
        }, eventTimestamp);
        streak.current = 1;
        streak.last_qualifying_date = today;
        streak.streak_start_date = today;
      }
    }

    if (streak.current > (streak.longest ?? 0)) {
      streak.longest = streak.current;
    }
  }

  scoreReceipt(receipt: Receipt, opts: ScoreReceiptOptions = {}): Record<string, any> {
    const today = normalizeScoreDate(opts.scoreDate);
    const eventTimestamp = opts.eventTimestamp ?? isoAtStartOfDay(today);
    const hashValid = validateContentHash(receipt);
    const hasHash = Boolean(receipt?.meta?.content_hash);

    if (hasHash && !hashValid) {
      this.state.receipts_rejected += 1;
      this.emitEvent("receipt.rejected", { reason: "content_hash_mismatch" }, eventTimestamp);
      return { status: "REJECTED", reason: "content_hash_mismatch", score: 0 };
    }

    const contentHash = (receipt?.meta?.content_hash as string) || computeContentHash(receipt);
    if (this.isDuplicate(contentHash)) {
      this.emitEvent("receipt.duplicate", { receipt_hash: contentHash }, eventTimestamp);
      return { status: "DUPLICATE", reason: "already_submitted", score: 0 };
    }

    const [baseScore, breakdown] = computeBaseScore(receipt);
    const currentStreak = this.state.streak.current as number;
    const finalScore = computeFinalScore(baseScore, currentStreak, receipt, hashValid && hasHash);
    const qualifies = qualifiesForStreak(baseScore);
    this.updateStreak(today, qualifies, eventTimestamp);
    if (qualifies) {
      this.emitEvent("streak.advanced", {
        new_length: this.state.streak.current,
        date: today,
      }, eventTimestamp);
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
        integrity_multiplier: hashValid && hasHash && hasChecksum(receipt) ? 1.5 : 1.0,
      },
    };

    if (!Array.isArray(this.state.history)) this.state.history = [];
    this.state.history.push(entry);
    this.state.receipts_submitted += 1;
    this.state.total_score += finalScore;
    this.emitEvent("receipt.submitted", {
      receipt_hash: contentHash,
      score: finalScore,
      breakdown: entry.breakdown,
    }, eventTimestamp);

    return {
      status: "ACCEPTED",
      score: finalScore,
      base_score: baseScore,
      breakdown,
      multipliers: entry.breakdown,
      streak: this.state.streak.current,
      confidence: entry.confidence,
      qualifies_for_streak: qualifies,
    };
  }
}
