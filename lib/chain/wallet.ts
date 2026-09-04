import { decodeEventLog, formatUnits, type Address, type Hex } from "viem";
import { ABI, EXPLORER_URL, WALLET_ADDRESS, assertConfigured, guardianWallet, ownerWallet, publicClient } from "./client";
import { getMeta, setMeta, type ProposalMeta } from "../store";
import { isDeterministicRevert } from "../errors";
export { resolveRecipient } from "../contacts";

export const STATUS = ["pending", "executed", "rejected"] as const;
export type ProposalStatus = (typeof STATUS)[number];

export type WalletState = {
  address: Address;
  balance: bigint;
  balanceUsdc: string;
  dailyLimitUsdc: string;
  remainingTodayUsdc: string;
  threshold: number;
  explorer: string;
};

export function txUrl(hash: Hex) {
  return `${EXPLORER_URL}/tx/${hash}`;
}

/**
 * Public RPCs are load-balanced and a replica can lag a block or two behind the one that mined our last tx.
 * That makes gas estimation revert on state that "doesn't exist yet". Retry briefly before giving up.
 */
async function withRetry<T>(label: string, fn: () => Promise<T>, attempts = 5, delayMs = 1500): Promise<T> {
  let last: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (e) {
      last = e;
      const msg = e instanceof Error ? e.message : String(e);
      // A custom error from the contract (AlreadyDecided, GuardiansRequired, ...) or an ERC-20 balance revert
      // will not change on retry; surface it immediately instead of 15 seconds of backoff.
      if (isDeterministicRevert(msg)) break;
      const retryable = /revert|execution reverted|estimateGas|out of bounds|panic|nonce too low|replacement/i.test(msg);
      if (!retryable || i === attempts - 1) break;
      console.warn(`[chain] ${label} attempt ${i + 1} failed, retrying: ${msg.split("\n")[0]}`);
      await new Promise((r) => setTimeout(r, delayMs * (i + 1)));
    }
  }
  throw last;
}

/** A transaction that mined but reverted must not be reported as success with a BaseScan link that says Fail. */
async function waitForSuccess(hash: Hex, label: string) {
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (receipt.status !== "success") throw new Error(`${label} reverted on-chain (tx ${hash})`);
  return receipt;
}

export async function getWalletState(): Promise<WalletState> {
  assertConfigured();
  const [balance, dailyLimit, remaining, threshold] = await Promise.all([
    publicClient.readContract({ address: WALLET_ADDRESS, abi: ABI, functionName: "balance" }) as Promise<bigint>,
    publicClient.readContract({ address: WALLET_ADDRESS, abi: ABI, functionName: "dailyLimit" }) as Promise<bigint>,
    publicClient.readContract({ address: WALLET_ADDRESS, abi: ABI, functionName: "remainingToday" }) as Promise<bigint>,
    publicClient.readContract({ address: WALLET_ADDRESS, abi: ABI, functionName: "threshold" }) as Promise<bigint>,
  ]);
  return {
    address: WALLET_ADDRESS,
    balance,
    balanceUsdc: formatUnits(balance, 6),
    dailyLimitUsdc: formatUnits(dailyLimit, 6),
    remainingTodayUsdc: formatUnits(remaining, 6),
    threshold: Number(threshold),
    explorer: `${EXPLORER_URL}/address/${WALLET_ADDRESS}`,
  };
}

export async function canPayDirectly(to: Address, amount: bigint): Promise<boolean> {
  assertConfigured();
  return (await publicClient.readContract({ address: WALLET_ADDRESS, abi: ABI, functionName: "canPayDirectly", args: [to, amount] })) as boolean;
}

export async function payDirect(p: { to: Address; amount: bigint; memo: string }) {
  assertConfigured();
  const wallet = ownerWallet();
  const hash = await withRetry("pay", () => wallet.writeContract({ address: WALLET_ADDRESS, abi: ABI, functionName: "pay", args: [p.to, p.amount, p.memo] }));
  await waitForSuccess(hash, "pay");
  return { hash, url: txUrl(hash) };
}

export async function proposePayment(p: { to: Address; amount: bigint; memo: string; riskScore: number; meta?: Omit<ProposalMeta, "createdAt"> }) {
  assertConfigured();
  const wallet = ownerWallet();
  const risk = Math.max(0, Math.min(100, Math.round(p.riskScore)));
  const hash = await withRetry("propose", () =>
    wallet.writeContract({ address: WALLET_ADDRESS, abi: ABI, functionName: "propose", args: [p.to, p.amount, p.memo, risk] }),
  );
  const receipt = await waitForSuccess(hash, "propose");
  let id = -1;
  for (const log of receipt.logs) {
    try {
      const ev = decodeEventLog({ abi: ABI, data: log.data, topics: log.topics });
      if (ev.eventName === "ProposalCreated") {
        id = Number((ev.args as unknown as { id: bigint }).id);
        break;
      }
    } catch {
      /* not ours */
    }
  }
  if (id < 0) throw new Error("ProposalCreated event not found");
  if (p.meta) setMeta(id, { ...p.meta, createdAt: Date.now() });
  return { id, hash, url: txUrl(hash) };
}

export async function guardianDecide(p: { proposalId: number; guardianIndex: number; decision: "approve" | "reject" }) {
  assertConfigured();
  const { wallet, name } = guardianWallet(p.guardianIndex);
  const hash = await withRetry(p.decision, () =>
    wallet.writeContract({
      address: WALLET_ADDRESS,
      abi: ABI,
      functionName: p.decision === "approve" ? "approve" : "reject",
      args: [BigInt(p.proposalId)],
    }),
  );
  await waitForSuccess(hash, p.decision);
  const meta = getMeta(p.proposalId);
  setMeta(p.proposalId, {
    ...(meta ?? { recipientName: "", recipientInput: "", reason: "", callerClaims: "", explanation: "", pattern: "", riskScore: 0, createdAt: Date.now() }),
    decisions: [...(meta?.decisions ?? []), { guardian: name, decision: p.decision, hash, at: Date.now() }],
  });
  return { hash, url: txUrl(hash), guardian: name };
}

export type ProposalView = {
  id: number;
  to: Address;
  amountUsdc: string;
  memo: string;
  riskScore: number;
  approvals: number;
  status: ProposalStatus;
  createdAt: number;
  meta: ProposalMeta | null;
};

type RawProposal = {
  to: Address;
  amount: bigint;
  memo: string;
  riskScore: number;
  approvals: bigint;
  status: number;
  createdAt: bigint;
  rejectedBy: Address;
};

export async function getProposal(id: number): Promise<ProposalView> {
  assertConfigured();
  const raw = (await publicClient.readContract({ address: WALLET_ADDRESS, abi: ABI, functionName: "getProposal", args: [BigInt(id)] })) as RawProposal;
  return {
    id,
    to: raw.to,
    amountUsdc: formatUnits(raw.amount, 6),
    memo: raw.memo,
    riskScore: Number(raw.riskScore),
    approvals: Number(raw.approvals),
    status: STATUS[Number(raw.status)] ?? "pending",
    createdAt: Number(raw.createdAt) * 1000,
    meta: getMeta(id),
  };
}

export async function getProposals(): Promise<ProposalView[]> {
  assertConfigured();
  const count = Number(await publicClient.readContract({ address: WALLET_ADDRESS, abi: ABI, functionName: "proposalCount" }));
  const ids = Array.from({ length: count }, (_, i) => i);
  const all = await Promise.all(ids.map(getProposal));
  return all.reverse();
}
