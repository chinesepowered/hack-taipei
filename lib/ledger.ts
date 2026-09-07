/**
 * 阿嬤's money in/out. Direct payments are only on-chain events, so we keep a small local record of them;
 * proposals (and the family's decisions) are read from the chain + proposal metadata. /api/ledger merges both.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

export type Payment = { kind: "paid"; recipient: string; amount_usdc: number; memo: string; hash: string; url: string; at: number };

const DIR = resolve(process.env.DATA_DIR ?? resolve(process.cwd(), ".data"));
const FILE = resolve(DIR, "payments.json");

export function listPayments(): Payment[] {
  try {
    if (!existsSync(FILE)) return [];
    return JSON.parse(readFileSync(FILE, "utf8"));
  } catch {
    return [];
  }
}

export function recordPayment(p: Omit<Payment, "kind" | "at">) {
  try {
    const rows = listPayments();
    rows.push({ kind: "paid", at: Date.now(), ...p });
    mkdirSync(DIR, { recursive: true });
    writeFileSync(FILE, JSON.stringify(rows.slice(-500), null, 2));
  } catch (e) {
    console.warn("[ledger] not persisted:", e instanceof Error ? e.message : e);
  }
}
