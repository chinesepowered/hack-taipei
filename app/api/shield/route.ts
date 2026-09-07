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
  // If 阿嬤 mentioned a call but the model passed no caller story, the transcript is the story.
  const callerClaims = String(body.caller_claims ?? "").trim() || (/電話|来电|來電|打來|打过来|打過來|對方|对方|他說|他说/.test(spoken) ? spoken : "");
  const result = await assessPayment({
    recipient: recipient.name,
    amount_usdc: amt.amount,
    reason: String(body.reason ?? "") + (spoken && !String(body.reason ?? "").includes(spoken.slice(0, 12)) ? `（阿嬤原話：${spoken.slice(0, 160)}）` : ""),
    caller_claims: callerClaims,
    recipient_known: recipient.known,
    recipient_allowlisted: recipient.allowlisted,
  });
  // Park it server-side so the proof survives the model's short memory (see lib/proof/assessments.ts).
  const assessment_id = rememberAssessment({ ...result, amount_usdc: amt.amount, spoken } as typeof result);
  return NextResponse.json({ ...result, recipient, assessment_id, amount_usdc: amt.amount, amount_note: amt.note, amount_corrected: amt.corrected });
}
