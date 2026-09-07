/**
 * Proposals that 豆豆 has decided to send but that are not yet mined. The family page shows these within a
 * second of the voice command, so the audience sees the card appear while the chain is still confirming.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { randomBytes } from "node:crypto";

export type Inflight = { key: string; recipientName: string; amount_usdc: number; riskScore: number; pattern: string; explanation: string; callerClaims: string; reason: string; at: number };

const DIR = resolve(process.env.DATA_DIR ?? resolve(process.cwd(), ".data"));
const FILE = resolve(DIR, "inflight.json");
const STALE_MS = 3 * 60_000;

function load(): Inflight[] {
  try {
    if (!existsSync(FILE)) return [];
    const rows: Inflight[] = JSON.parse(readFileSync(FILE, "utf8"));
    return rows.filter((r) => Date.now() - r.at < STALE_MS);
  } catch {
    return [];
  }
}
function save(rows: Inflight[]) {
  try {
    mkdirSync(DIR, { recursive: true });
    writeFileSync(FILE, JSON.stringify(rows, null, 2));
  } catch {
    /* best effort */
  }
}
export function startInflight(p: Omit<Inflight, "key" | "at">): string {
  const key = `inflight_${randomBytes(4).toString("hex")}`;
  save([...load(), { ...p, key, at: Date.now() }]);
  return key;
}
export function endInflight(key: string) {
  save(load().filter((r) => r.key !== key));
}
export function listInflight(): Inflight[] {
  return load();
}
