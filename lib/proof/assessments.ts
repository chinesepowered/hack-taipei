/**
 * The voice model calls assess_payment, then execute_payment, and only carries the score across in its own memory.
 * The proof must not depend on the model remembering it. So every assessment is parked here under a short id,
 * the browser passes that id into execute_payment, and the server re-attaches the proof from its own record.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { randomBytes } from "node:crypto";
import type { Assessment } from "../shield/assess";

const DIR = resolve(process.env.DATA_DIR ?? resolve(process.cwd(), ".data"));
const FILE = resolve(DIR, "assessments.json");
const KEEP = 200;

type Stored = Assessment & { id: string; at: number; amount_usdc?: number; spoken?: string };

function load(): Stored[] {
  try {
    if (!existsSync(FILE)) return [];
    return JSON.parse(readFileSync(FILE, "utf8"));
  } catch {
    return [];
  }
}
function save(rows: Stored[]) {
  try {
    mkdirSync(DIR, { recursive: true });
    writeFileSync(FILE, JSON.stringify(rows.slice(-KEEP), null, 2));
  } catch (e) {
    console.warn("[assessments] not persisted:", e instanceof Error ? e.message : e);
  }
}

export function rememberAssessment(a: Assessment): string {
  const id = `a_${randomBytes(6).toString("hex")}`;
  const rows = load();
  rows.push({ ...a, id, at: Date.now() });
  save(rows);
  return id;
}

export function recallAssessment(id: string | undefined | null): Stored | null {
  if (!id) return null;
  return load().find((r) => r.id === id) ?? null;
}

/** Most recent assessment, for when the model forgot to pass the id. Only within a short window. */
export function latestAssessment(maxAgeMs = 5 * 60_000): Stored | null {
  const rows = load();
  const last = rows.at(-1);
  if (!last || Date.now() - last.at > maxAgeMs) return null;
  return last;
}
