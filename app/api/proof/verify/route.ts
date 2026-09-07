import { NextResponse } from "next/server";
import { verifyStamp } from "@/lib/proof/stamp";

export const runtime = "nodejs";

/** Offline verification: recovers the signer from the stamp and checks it against the agent. No RPC, no model. */
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const stamp = String(body.stamp ?? "");
  if (!stamp) return NextResponse.json({ ok: false, reason: "沒有章" }, { status: 400 });
  const expected = typeof body.expected_signer === "string" ? body.expected_signer : null;
  return NextResponse.json(await verifyStamp(stamp, expected));
}
