import { NextResponse } from "next/server";
import { assessPayment } from "@/lib/shield/assess";
import { resolveRecipient } from "@/lib/contacts";
import { rememberAssessment } from "@/lib/proof/assessments";
import { reconcileAmount } from "@/lib/zhAmount";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const recipient = resolveRecipient(String(body.recipient ?? ""));
  const spoken = String(body.spoken ?? "");
  const amt = reconcileAmount(Number(body.amount_usdc ?? 0), spoken, [String(body.reason ?? ""), String(body.caller_claims ?? "")]);
  if (amt.corrected) console.warn(`[shield] amount corrected from ${body.amount_usdc} to ${amt.amount} (spoken: ${spoken.slice(0, 60)})`);
  // What 阿嬤 actually said is the evidence. The model's own summary of the caller can hallucinate details
  // (it once added 「保密」 that nobody said, which flipped the pattern to 假冒檢警), so when we have the transcript
  // the rules and the judge both work from the transcript; the model's summary is only a fallback.
  const modelClaims = String(body.caller_claims ?? "").trim();
  const callerClaims = spoken ? spoken : modelClaims;
  const result = await assessPayment({
    recipient: recipient.name,
    amount_usdc: amt.amount,
    reason: String(body.reason ?? "").slice(0, 120),
    caller_claims: callerClaims,
    recipient_known: recipient.known,
    recipient_allowlisted: recipient.allowlisted,
  });
  // Park it server-side so the proof survives the model's short memory (see lib/proof/assessments.ts).
  const assessment_id = rememberAssessment({ ...result, amount_usdc: amt.amount, spoken } as typeof result);
  return NextResponse.json({ ...result, recipient, assessment_id, amount_usdc: amt.amount, amount_note: amt.note, amount_corrected: amt.corrected });
}
