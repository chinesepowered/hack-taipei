/**
 * Agent proof stamp.
 *
 * One completed Scam Shield judgment is signed into one stamp that hangs under 豆豆's identity.
 * The stamp binds together: which agent judged, which model ran, the hash of what it was asked,
 * the hash of what it answered, whether the inference carried a 0G TEE attestation, and the score.
 *
 * Verification is signature recovery, not a transaction: anyone can check a stamp offline, gas-free,
 * and compare the recovered signer with the agent's address (or the on-chain owner of its Agentic ID).
 */
import { keccak256, recoverMessageAddress, stringToHex, type Address, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { createHash } from "node:crypto";

export type InferenceProof = {
  provider: "0g" | "openai" | "other";
  model: string;
  request_hash: Hex;
  response_hash: Hex;
  tee_verified: boolean | null;
  trust_mode: string | null;
  response_id: string | null;
  at: number;
};

export type StampPayload = {
  v: 1;
  agent: string;
  agent_id_token: string | null;
  agent_id_contract: string | null;
  provider: InferenceProof["provider"];
  model: string;
  request_hash: Hex;
  response_hash: Hex;
  tee_verified: boolean | null;
  score: number;
  pattern_code: string;
  action: string;
  at: number;
};

export type Stamp = { stamp: string; id: Hex; payload: StampPayload; signer: Address };

export function sha256Hex(s: string): Hex {
  return `0x${createHash("sha256").update(s, "utf8").digest("hex")}`;
}

/** Deterministic JSON: sorted keys, no whitespace. Both signer and verifier must agree byte for byte. */
export function canonical(obj: unknown): string {
  if (obj === null || typeof obj !== "object") return JSON.stringify(obj);
  if (Array.isArray(obj)) return `[${obj.map(canonical).join(",")}]`;
  const o = obj as Record<string, unknown>;
  return `{${Object.keys(o)
    .sort()
    .map((k) => `${JSON.stringify(k)}:${canonical(o[k])}`)
    .join(",")}}`;
}

function b64url(s: string) {
  return Buffer.from(s, "utf8").toString("base64url");
}
function unb64url(s: string) {
  return Buffer.from(s, "base64url").toString("utf8");
}

export function agentIdentity() {
  const pk = process.env.OWNER_PRIVATE_KEY as Hex | undefined;
  const address = pk ? privateKeyToAccount(pk).address : null;
  return {
    name: process.env.AGENT_NAME ?? "豆豆",
    address,
    agent_id_token: process.env.AGENT_ID_TOKEN || null,
    agent_id_contract: process.env.AGENT_ID_CONTRACT || null,
    agent_seal: process.env.AGENT_SEAL || null,
    chain: process.env.AGENT_ID_CHAIN ?? "0G Galileo testnet (16602)",
    explorer: process.env.AGENT_ID_TOKEN ? `https://8004scan.io/agent/${process.env.AGENT_ID_TOKEN}` : null,
  };
}

export async function makeStamp(input: {
  proof: InferenceProof;
  score: number;
  pattern_code: string;
  action: string;
}): Promise<Stamp | null> {
  const pk = process.env.OWNER_PRIVATE_KEY as Hex | undefined;
  if (!pk) return null;
  const account = privateKeyToAccount(pk);
  const id = agentIdentity();
  const payload: StampPayload = {
    v: 1,
    agent: account.address,
    agent_id_token: id.agent_id_token,
    agent_id_contract: id.agent_id_contract,
    provider: input.proof.provider,
    model: input.proof.model,
    request_hash: input.proof.request_hash,
    response_hash: input.proof.response_hash,
    tee_verified: input.proof.tee_verified,
    score: input.score,
    pattern_code: input.pattern_code,
    action: input.action,
    at: input.proof.at,
  };
  const body = canonical(payload);
  const signature = await account.signMessage({ message: body });
  const stamp = `${b64url(body)}.${signature}`;
  return { stamp, id: keccak256(stringToHex(stamp)), payload, signer: account.address };
}

export type Verification = {
  ok: boolean;
  reason: string;
  signer: Address | null;
  payload: StampPayload | null;
  id: Hex | null;
};

/** Offline. No RPC, no API. Just math. */
export async function verifyStamp(stamp: string, expectedSigner?: string | null): Promise<Verification> {
  const dot = stamp.lastIndexOf(".");
  if (dot < 0) return { ok: false, reason: "格式不對：找不到簽章", signer: null, payload: null, id: null };
  const body = unb64url(stamp.slice(0, dot));
  const signature = stamp.slice(dot + 1) as Hex;
  let payload: StampPayload;
  try {
    payload = JSON.parse(body);
  } catch {
    return { ok: false, reason: "格式不對：內容不是 JSON", signer: null, payload: null, id: null };
  }
  if (canonical(payload) !== body) return { ok: false, reason: "內容被改過：與正規化格式不符", signer: null, payload, id: null };
  let signer: Address;
  try {
    signer = await recoverMessageAddress({ message: body, signature });
  } catch {
    return { ok: false, reason: "簽章無效", signer: null, payload, id: null };
  }
  const id = keccak256(stringToHex(stamp));
  if (signer.toLowerCase() !== payload.agent.toLowerCase())
    return { ok: false, reason: `簽章者 ${signer} 不是章上寫的 agent ${payload.agent}`, signer, payload, id };
  if (expectedSigner && signer.toLowerCase() !== expectedSigner.toLowerCase())
    return { ok: false, reason: `簽章者 ${signer} 不是預期的 agent ${expectedSigner}`, signer, payload, id };
  return { ok: true, reason: "簽章有效，內容未被竄改", signer, payload, id };
}

/** What goes on-chain in the proposal memo: a short handle to the stamp, so the chain and the stamp point at each other. */
export function memoWithProof(memo: string, stampId: Hex | null) {
  if (!stampId) return memo.slice(0, 120);
  const tag = `proof:${stampId.slice(0, 18)}`;
  return `${tag} | ${memo}`.slice(0, 120);
}
