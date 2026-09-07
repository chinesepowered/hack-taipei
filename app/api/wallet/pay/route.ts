import { NextResponse } from "next/server";
import { parseUnits } from "viem";
import { canPayDirectly, payDirect, proposePayment } from "@/lib/chain/wallet";
import { resolveRecipient } from "@/lib/contacts";
import { latestAssessment, recallAssessment } from "@/lib/proof/assessments";
import { agentIdentity, makeStamp, memoWithProof } from "@/lib/proof/stamp";

export const runtime = "nodejs";

/**
 * The agent's execute_payment tool lands here.
 * Direct payment only when the contract says so AND the Scam Shield score is low.
 * Everything else becomes an on-chain proposal for the family, carrying the agent's signed stamp
 * for the judgment that parked it (0G TEE-attested inference, hashed, signed by 豆豆's key).
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const recipient = resolveRecipient(String(body.recipient ?? ""));
    const amountUsdc = Number(body.amount_usdc ?? 0);
    if (!(amountUsdc > 0)) return NextResponse.json({ status: "error", error: "金額必須大於 0" }, { status: 400 });
    const amount = parseUnits(amountUsdc.toFixed(6), 6);

    // The judgment of record is the server's own copy, not what the model repeats back.
    const assessment = recallAssessment(body.assessment_id) ?? latestAssessment();
    const riskScore = Math.max(Number(body.risk_score ?? 100), assessment?.risk_score ?? 0);
    const rawMemo = String(body.memo ?? "").slice(0, 120);

    const direct = (await canPayDirectly(recipient.address, amount)) && riskScore < 40;
    if (direct) {
      const tx = await payDirect({ to: recipient.address, amount, memo: rawMemo });
      return NextResponse.json({ status: "paid", recipient: recipient.name, amount_usdc: amountUsdc, tx: tx.hash, url: tx.url });
    }

    const stamp = assessment?.proof
      ? await makeStamp({
          proof: assessment.proof,
          score: assessment.risk_score,
          pattern_code: assessment.pattern_code,
          action: assessment.recommended_action,
        })
      : null;
    const memo = memoWithProof(rawMemo || `${assessment?.pattern ?? "可疑付款"}`, stamp?.id ?? null);

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
        // The server's own assessment is the record; the model's repetition is only a fallback.
        explanation: String(assessment?.explanation_zh || body.explanation_zh || ""),
        pattern: String(assessment?.pattern || body.pattern || ""),
        riskScore,
        stamp: stamp?.stamp,
        stampId: stamp?.id,
        proof: assessment?.proof ?? null,
        agent: (() => {
          const a = agentIdentity();
          return { address: a.address, agent_id_token: a.agent_id_token, agent_id_contract: a.agent_id_contract };
        })(),
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
      stamp_id: stamp?.id ?? null,
      tee_verified: assessment?.proof?.tee_verified ?? null,
      message: "已經通知家人，錢先不會動。",
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ status: "error", error: msg }, { status: 500 });
  }
}
