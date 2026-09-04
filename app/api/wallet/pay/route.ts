import { NextResponse } from "next/server";
import { parseUnits } from "viem";
import { canPayDirectly, payDirect, proposePayment } from "@/lib/chain/wallet";
import { resolveRecipient } from "@/lib/contacts";

export const runtime = "nodejs";

/**
 * The agent's execute_payment tool lands here.
 * Direct payment only when the contract says so AND the Scam Shield score is low.
 * Everything else becomes an on-chain proposal for the family.
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const recipient = resolveRecipient(String(body.recipient ?? ""));
    const amountUsdc = Number(body.amount_usdc ?? 0);
    if (!(amountUsdc > 0)) return NextResponse.json({ status: "error", error: "金額必須大於 0" }, { status: 400 });
    const amount = parseUnits(amountUsdc.toFixed(6), 6);
    const riskScore = Number(body.risk_score ?? 100);
    const memo = String(body.memo ?? "").slice(0, 120);

    const direct = (await canPayDirectly(recipient.address, amount)) && riskScore < 40;
    if (direct) {
      const tx = await payDirect({ to: recipient.address, amount, memo });
      return NextResponse.json({ status: "paid", recipient: recipient.name, amount_usdc: amountUsdc, tx: tx.hash, url: tx.url });
    }

    const proposal = await proposePayment({
      to: recipient.address,
      amount,
      memo,
      riskScore,
      meta: {
        recipientName: recipient.name,
        recipientInput: String(body.recipient ?? ""),
        reason: String(body.reason ?? ""),
        callerClaims: String(body.caller_claims ?? ""),
        explanation: String(body.explanation_zh ?? ""),
        pattern: String(body.pattern ?? ""),
        riskScore,
      },
    });
    return NextResponse.json({
      status: "needs_family",
      proposal_id: proposal.id,
      recipient: recipient.name,
      amount_usdc: amountUsdc,
      risk_score: riskScore,
      tx: proposal.hash,
      url: proposal.url,
      message: "已經通知家人，錢先不會動。",
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ status: "error", error: msg }, { status: 500 });
  }
}
