import { NextResponse } from "next/server";
import { assessPayment } from "@/lib/shield/assess";
import { resolveRecipient } from "@/lib/contacts";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const recipient = resolveRecipient(String(body.recipient ?? ""));
  const result = await assessPayment({
    recipient: recipient.name,
    amount_usdc: Number(body.amount_usdc ?? 0),
    reason: String(body.reason ?? ""),
    caller_claims: String(body.caller_claims ?? ""),
    recipient_known: recipient.known,
    recipient_allowlisted: recipient.allowlisted,
  });
  return NextResponse.json({ ...result, recipient });
}
