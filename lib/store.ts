import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Off-chain metadata for proposals: the Scam Shield explanation, what the caller claimed, and guardian decisions.
 * The money and the decision live on-chain. This is only the human-readable context the family sees.
 */
export type ProposalMeta = {
  recipientName: string;
  recipientInput: string;
  reason: string;
  callerClaims: string;
  explanation: string;
  pattern: string;
  riskScore: number;
  createdAt: number;
  decisions?: { guardian: string; decision: "approve" | "reject"; hash: string; at: number }[];
};

const DIR = resolve(process.cwd(), ".data");
const FILE = resolve(DIR, "proposals.json");

function load(): Record<string, ProposalMeta> {
  try {
    if (!existsSync(FILE)) return {};
    return JSON.parse(readFileSync(FILE, "utf8"));
  } catch {
    return {};
  }
}

function save(data: Record<string, ProposalMeta>) {
  mkdirSync(DIR, { recursive: true });
  writeFileSync(FILE, JSON.stringify(data, null, 2));
}

export function getMeta(id: number): ProposalMeta | null {
  return load()[String(id)] ?? null;
}

export function setMeta(id: number, meta: ProposalMeta) {
  const data = load();
  data[String(id)] = meta;
  save(data);
}
