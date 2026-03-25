import { createHash } from "node:crypto";

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortKeys);
  }
  if (isPlainObject(value)) {
    const out: Record<string, unknown> = {};
    for (const key of Object.keys(value).sort()) {
      out[key] = sortKeys(value[key]);
    }
    return out;
  }
  return value;
}

export function canonicalJson(obj: Record<string, unknown>): string {
  return JSON.stringify(sortKeys(obj));
}

export function computeContentHash(receipt: Record<string, unknown>): string {
  const copy = JSON.parse(JSON.stringify(receipt)) as Record<string, unknown>;
  const meta = isPlainObject(copy.meta) ? { ...copy.meta } : undefined;
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

export function validateContentHash(receipt: Record<string, unknown>): boolean {
  const meta = isPlainObject(receipt.meta) ? receipt.meta : {};
  const claimed = typeof meta.content_hash === "string" ? meta.content_hash : "";
  if (!claimed) return true;
  if (!claimed.startsWith("sha256:")) return false;
  return computeContentHash(receipt) === claimed;
}
