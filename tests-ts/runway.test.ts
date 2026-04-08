import { afterEach, describe, expect, it } from "vitest";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { exportRunwaySite, startRunwayPreviewServer, type ShipReceiptV1, type RunwayPreviewServer } from "../src-ts/runway.js";

function sampleRunwayReceipt(overrides: Partial<ShipReceiptV1> = {}): ShipReceiptV1 {
  return {
    schema: "ship-receipt/v1",
    receipt_id: overrides.receipt_id ?? "rcpt_evt_preview",
    issued_at: overrides.issued_at ?? "2026-04-08T12:00:00Z",
    event: {
      work_id: overrides.event?.work_id ?? "ship-receipts/runway",
      actor: overrides.event?.actor ?? "agent:test-builder",
      summary: overrides.event?.summary ?? "Preview runway locally",
      artifacts: overrides.event?.artifacts ?? ["dist/index.html"],
      pr: overrides.event?.pr ?? "https://github.com/Spitfire-Cowboy/ship-receipts/pull/30",
      commit: overrides.event?.commit ?? "0123456789ab",
    },
    proof: {
      method: "sha256-canonical-json",
      digest: overrides.proof?.digest ?? "sha256:preview-digest",
    },
  };
}

const previewServers: RunwayPreviewServer[] = [];

afterEach(async () => {
  while (previewServers.length > 0) {
    const server = previewServers.pop();
    if (server) {
      await server.close();
    }
  }
});

describe("runway preview server", () => {
  it("serves the generated index and feed over local HTTP", async () => {
    const root = await mkdtemp(join(tmpdir(), "sr-ts-runway-preview-"));
    const outDir = join(root, "runway");
    const receipts = [
      sampleRunwayReceipt(),
      sampleRunwayReceipt({
        receipt_id: "rcpt_evt_preview_two",
        issued_at: "2026-04-09T12:00:00Z",
        event: {
          work_id: "ship-receipts/docs",
          actor: "agent:test-builder",
          summary: "Ship docs polish",
          artifacts: ["README.md"],
          pr: "https://github.com/Spitfire-Cowboy/ship-receipts/pull/29",
          commit: "abcdef012345",
        },
      }),
    ];

    await exportRunwaySite(receipts, outDir);
    const server = await startRunwayPreviewServer(outDir, { host: "127.0.0.1", port: 0 });
    previewServers.push(server);

    const indexResponse = await fetch(server.url);
    expect(indexResponse.status).toBe(200);
    expect(indexResponse.headers.get("content-type")).toContain("text/html");
    expect(await indexResponse.text()).toContain("ship-receipts runway");

    const feedResponse = await fetch(new URL("receipts.json", server.url));
    expect(feedResponse.status).toBe(200);
    expect(feedResponse.headers.get("content-type")).toContain("application/json");
    const payload = await feedResponse.json();
    expect(payload).toHaveLength(2);
    expect(payload.map((entry: ShipReceiptV1) => entry.receipt_id)).toEqual([
      "rcpt_evt_preview",
      "rcpt_evt_preview_two",
    ]);

    const missingResponse = await fetch(new URL("missing.json", server.url));
    expect(missingResponse.status).toBe(404);
  });
});
