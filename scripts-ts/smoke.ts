import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { main } from "../dist/cli.js";

async function run(): Promise<number> {
  const root = await mkdtemp(join(tmpdir(), "ship-receipts-ts-smoke-"));
  const old = process.cwd();

  try {
    process.chdir(root);

    const receipt = {
      version: "0.1",
      subject: {
        name: "SmokeTest",
        profiles: [{ kind: "github", url: "https://github.com/smoketest" }],
      },
      meta: { created_at: "2026-03-02T00:00:00Z" },
      artifacts: [
        {
          kind: "repo",
          name: "smoke-app",
          url: "https://github.com/smoketest/smoke-app",
          immutable_ref: "abc123",
        },
      ],
    };

    const receiptPath = join(root, "receipt.json");
    const envelopePath = join(root, "receipt.envelope.json");
    await writeFile(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`, "utf8");

    const validateCode = await main(["validate", receiptPath]);
    if (validateCode !== 0) {
      console.error(`FAIL: validate returned ${validateCode}`);
      return 1;
    }

    const scoreCode = await main(["score", receiptPath]);
    if (scoreCode !== 0) {
      console.error(`FAIL: score returned ${scoreCode}`);
      return 1;
    }

    const exportCode = await main(["export", receiptPath, "--output", envelopePath]);
    if (exportCode !== 0) {
      console.error(`FAIL: export returned ${exportCode}`);
      return 1;
    }

    const streakCode = await main(["streak"]);
    if (streakCode !== 0) {
      console.error(`FAIL: streak returned ${streakCode}`);
      return 1;
    }

    const rawEnvelope = await readFile(envelopePath, "utf8");
    const envelope = JSON.parse(rawEnvelope);
    if (envelope.envelope_version !== "1.0") {
      console.error("FAIL: envelope_version mismatch");
      return 1;
    }

    console.log("PASS: TypeScript smoke flow");
    return 0;
  } finally {
    process.chdir(old);
  }
}

run()
  .then((code) => process.exit(code))
  .catch((err) => {
    console.error(`FAIL: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  });
