import { describe, expect, it } from "vitest";
import { mkdtemp, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { readAgentCalibration } from "../src-ts/calibration.js";

describe("readAgentCalibration", () => {
  it("computes rolling Brier score for matching agent verification outcomes", async () => {
    const root = await mkdtemp(join(tmpdir(), "sr-ts-cal-"));
    const file = join(root, "context-store.jsonl");
    const lines = [
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
      JSON.stringify({
        type: "verification_outcome",
        agent_name: "codex",
        shot_call_confidence: 0.6,
        verification_result: "pass",
      }),
    ];
    await writeFile(file, `${lines.join("\n")}\n`, "utf8");

    const out = await readAgentCalibration("codex", { contextStorePath: file, windowSize: 20 });
    expect(out.predictionsN).toBe(3);
    expect(out.score).toBe(0.27);
    expect(out.warning).toBeUndefined();
  });

  it("returns null calibration and warning when context store is unavailable", async () => {
    const root = await mkdtemp(join(tmpdir(), "sr-ts-cal-missing-"));
    const out = await readAgentCalibration("codex", { contextStorePath: join(root, "does-not-exist.jsonl") });
    expect(out.score).toBeNull();
    expect(out.predictionsN).toBeNull();
    expect(typeof out.warning).toBe("string");
  });

  it("returns warning for empty agent name", async () => {
    const out = await readAgentCalibration("   ");
    expect(out.score).toBeNull();
    expect(out.predictionsN).toBeNull();
    expect(typeof out.warning).toBe("string");
  });

  it("returns null score when no matching agent outcomes exist", async () => {
    const root = await mkdtemp(join(tmpdir(), "sr-ts-cal-nomatch-"));
    const file = join(root, "context-store.jsonl");
    await writeFile(file, `${JSON.stringify({
      type: "verification_outcome",
      agent_name: "rowan",
      shot_call_confidence: 0.9,
      verification_result: "pass",
    })}\n`, "utf8");

    const out = await readAgentCalibration("codex", { contextStorePath: file });
    expect(out.score).toBeNull();
    expect(out.predictionsN).toBeNull();
  });

  it("ignores malformed json lines and computes from valid records", async () => {
    const root = await mkdtemp(join(tmpdir(), "sr-ts-cal-malformed-"));
    const file = join(root, "context-store.jsonl");
    const lines = [
      "{not-json",
      JSON.stringify({
        type: "verification_outcome",
        agent_name: "codex",
        shot_call_confidence: 0.6,
        verification_result: "pass",
      }),
      "}",
      JSON.stringify({
        type: "verification_outcome",
        agent_name: "codex",
        shot_call_confidence: 0.2,
        verification_result: "fail",
      }),
    ];
    await writeFile(file, `${lines.join("\n")}\n`, "utf8");

    const out = await readAgentCalibration("codex", { contextStorePath: file, windowSize: 20 });
    expect(out.predictionsN).toBe(2);
    expect(out.score).toBe(0.1);
  });
});
