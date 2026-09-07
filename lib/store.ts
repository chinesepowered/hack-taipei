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
  /** The agent's signed stamp for the judgment behind this proposal, and the inference proof it wraps. */
  stamp?: string;
  stampId?: string;
  proof?: {
    provider: string;
    model: string;
    request_hash: string;
    response_hash: string;
    tee_verified: boolean | null;
    trust_mode: string | null;
    response_id: string | null;
    at: number;
  } | null;
  agent?: { address: string | null; agent_id_token: string | null; agent_id_contract: string | null } | null;
  /** Where the stamp document lives on 0G Storage (Merkle root), once uploaded. */
  storageRoot?: string;
  storageTx?: string | null;
  storageError?: string;
};

const DIR = resolve(process.env.DATA_DIR ?? resolve(process.cwd(), ".data"));
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
  try {
    mkdirSync(DIR, { recursive: true });
    writeFileSync(FILE, JSON.stringify(data, null, 2));
  } catch (e) {
    console.warn("[store] not persisted:", e instanceof Error ? e.message : e);
  }
}

export function getMeta(id: number): ProposalMeta | null {
  return load()[String(id)] ?? null;
}

export function setMeta(id: number, meta: ProposalMeta) {
  const data = load();
  data[String(id)] = meta;
  save(data);
}
