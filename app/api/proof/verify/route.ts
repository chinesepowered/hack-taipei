import { NextResponse } from "next/server";
import { verifyStamp } from "@/lib/proof/stamp";
import { checkIdentityOnChain } from "@/lib/proof/onchain";

export const runtime = "nodejs";

/** Offline verification: recovers the signer from the stamp and checks it against the agent. No RPC, no model. */
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const stamp = String(body.stamp ?? "");
  if (!stamp) return NextResponse.json({ ok: false, reason: "沒有章" }, { status: 400 });
  const expected = typeof body.expected_signer === "string" ? body.expected_signer : null;
  const v = await verifyStamp(stamp, expected);
  // Offline result first; the on-chain identity check is an extra, only when asked and only if the signature held.
  const identity = body.onchain && v.ok && v.payload && v.signer ? await checkIdentityOnChain({ agent_id_contract: v.payload.agent_id_contract, agent_id_token: v.payload.agent_id_token, signer: v.signer }) : null;
  return NextResponse.json({ ...v, identity });
}
