import { NextResponse } from "next/server";
import { getProposal, guardianDecide, getWalletState } from "@/lib/chain/wallet";
import { toZh } from "@/lib/errors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  try {
    return NextResponse.json(await getProposal(Number(id)));
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}

/** Body: { guardian: 1 | 2, decision: "approve" | "reject" } */
export async function POST(req: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  try {
    const body = await req.json();
    const decision = body.decision === "approve" ? "approve" : "reject";
    if (decision === "approve") {
      // The second approval executes the transfer; make sure the wallet can actually pay before spending gas on a revert.
      const [p, w] = await Promise.all([getProposal(Number(id)), getWalletState()]);
      if (p.status !== "pending") return NextResponse.json({ error: "這筆提案已經有人決定過了，不能再改。" }, { status: 409 });
      if (p.approvals + 1 >= w.threshold && Number(w.balanceUsdc) < Number(p.amountUsdc))
        return NextResponse.json({ error: `錢包餘額 ${Number(w.balanceUsdc).toLocaleString()} 元，不夠付這筆 ${Number(p.amountUsdc).toLocaleString()} 元。先擋下，或幫錢包補錢。` }, { status: 409 });
    }
    const result = await guardianDecide({ proposalId: Number(id), guardianIndex: Number(body.guardian ?? 1), decision });
    const proposal = await getProposal(Number(id));
    return NextResponse.json({ ...result, proposal });
  } catch (e) {
    const z = toZh(e);
    return NextResponse.json({ error: z.message, detail: z.detail }, { status: 500 });
  }
}
