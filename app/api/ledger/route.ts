import { NextResponse } from "next/server";
import { getProposals } from "@/lib/chain/wallet";
import { listPayments } from "@/lib/ledger";
import { EXPLORER_URL } from "@/lib/chain/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export type LedgerEntry = {
  key: string;
  kind: "paid" | "pending" | "executed" | "rejected";
  amount_usdc: number;
  recipient: string;
  at: number;
  by?: string;
  proposal_id?: number;
  hash?: string;
  url?: string;
  risk?: number;
};

/** 阿嬤's 收支紀錄: direct payments plus every proposal and what the family decided. Newest first. */
export async function GET() {
  try {
    const entries: LedgerEntry[] = listPayments().map((p) => ({
      key: `pay:${p.hash}`,
      kind: "paid",
      amount_usdc: p.amount_usdc,
      recipient: p.recipient,
      at: p.at,
      hash: p.hash,
      url: p.url,
    }));
    const proposals = await getProposals();
    for (const p of proposals) {
      const last = p.meta?.decisions?.at(-1);
      entries.push({
        key: `prop:${p.id}`,
        kind: p.status,
        amount_usdc: Number(p.amountUsdc),
        recipient: p.meta?.recipientName || `${p.to.slice(0, 6)}…${p.to.slice(-4)}`,
        at: last?.at ?? p.meta?.createdAt ?? p.createdAt,
        by: last?.guardian,
        proposal_id: p.id,
        hash: last?.hash,
        url: last?.hash ? `${EXPLORER_URL}/tx/${last.hash}` : undefined,
        risk: p.riskScore,
      });
    }
    entries.sort((a, b) => b.at - a.at);
    return NextResponse.json({ entries, explorer: EXPLORER_URL });
  } catch (e) {
    return NextResponse.json({ entries: [], error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
