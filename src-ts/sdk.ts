/**
 * ship-receipts Game Mode SDK
 *
 * TypeScript interfaces for building ship-receipts game mode plugins.
 * A game mode is an npm package that exports a GameMode object.
 *
 * Plugin discovery: list package names in .ship-receipts/config.json under "game_modes".
 * Each package must export `default` as a GameMode implementation.
 *
 * @example
 * // my-game-mode/index.ts
 * import type { GameMode, GameContext, GameState, GameEvent, GameInput } from "ship-receipts/sdk";
 *
 * const mode: GameMode = {
 *   name: "my-mode",
 *   version: "1.0.0",
 *   description: "My custom ship-receipts game mode",
 *   async setup(ctx) { ... },
 *   update(dt, input) { ... },
 *   onEvent(event) { ... },
 * };
 *
 * export default mode;
 */

// ---------------------------------------------------------------------------
// Core types
// ---------------------------------------------------------------------------

/** A ship receipt as a plain object. */
export type Receipt = Record<string, unknown>;

/** Read-only view of the current game state. */
export interface ReadonlyGameState {
  readonly totalScore: number;
  readonly receiptsSubmitted: number;
  readonly streak: {
    readonly current: number;
    readonly longest: number;
    readonly lastQualifyingDate: string | null;
  };
  readonly odyssey: {
    readonly ithaca: string | undefined;
    readonly completed: boolean;
  } | undefined;
}

// ---------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------

export type GameEventType =
  | "receipt.submitted"
  | "receipt.rejected"
  | "receipt.duplicate"
  | "streak.advanced"
  | "streak.broken"
  | "goal.set"
  | "goal.completed"
  | "mode.started"
  | "mode.ended";

export interface GameEvent {
  type: GameEventType;
  timestamp: string;
  payload: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Input
// ---------------------------------------------------------------------------

export interface GameInput {
  /** Key press events from the terminal, if running in TUI context. */
  keys: string[];
  /** The receipt that was just scored, if any. */
  receipt: Receipt | undefined;
  /** Latest score result. */
  scoreResult: {
    status: "ACCEPTED" | "REJECTED" | "DUPLICATE";
    score: number;
    streakDays: number;
  } | undefined;
}

// ---------------------------------------------------------------------------
// Asset loading
// ---------------------------------------------------------------------------

export interface AssetLoader {
  /** Load a JSON asset from the game mode's package directory. */
  loadJson(path: string): Promise<Record<string, unknown>>;
  /** Load a text asset from the game mode's package directory. */
  loadText(path: string): Promise<string>;
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

export interface GameContext {
  /** Emit a game event to other listeners. */
  emit(event: GameEvent): void;
  /** Read-only view of the current game state. */
  readonly state: ReadonlyGameState;
  /** Asset loader scoped to this game mode's package directory. */
  assets: AssetLoader;
  /** Absolute path to the current repo's .ship-receipts directory. */
  readonly stateDir: string;
}

// ---------------------------------------------------------------------------
// Wellness signals
// ---------------------------------------------------------------------------

/**
 * Scalar wellness signals exported by ship-receipts for game clients.
 * All values are local-only — no PII, no network.
 * See: ship-receipts wellness --json
 */
export interface WellnessSignal {
  /** Minutes elapsed since the first receipt scored today. Approximates session duration. */
  sessionDurationMinutes: number;
  /** Minutes since last break (gap of >15 minutes with no activity). */
  timeSinceLastBreakMinutes: number;
  /** Receipts scored today. */
  receiptsToday: number;
  /** Current streak in days. */
  streakDays: number;
  /** Whether the user has shipped today. */
  shippedToday: boolean;
  /** ISO timestamp of this reading. */
  readingAt: string;
}

// ---------------------------------------------------------------------------
// Game mode interface
// ---------------------------------------------------------------------------

export interface GameMode {
  /** Unique name for this game mode (matches npm package name convention). */
  name: string;
  /** Semver version string. */
  version: string;
  /** Human-readable description shown in mode picker. */
  description: string;

  /**
   * Called once when the game mode is activated.
   * Use this to load assets, initialize state, and register event listeners.
   */
  setup(ctx: GameContext): Promise<void>;

  /**
   * Called on each game tick (100ms by default when in TUI mode).
   * Returns updated game state for rendering.
   * @param dt Milliseconds since last tick.
   * @param input Current input state.
   */
  update(dt: number, input: GameInput): Partial<ReadonlyGameState>;

  /**
   * Called when a game event is emitted.
   * Use this to react to receipt submissions, streak events, etc.
   */
  onEvent(event: GameEvent): void;

  /**
   * Optional: teardown when the game mode is deactivated.
   */
  teardown?(): Promise<void>;
}
