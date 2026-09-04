import { NextResponse } from "next/server";
import { getProposal, guardianDecide } from "@/lib/chain/wallet";
import { requireDemoKey } from "@/lib/demoKey";
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
  const denied = requireDemoKey(req);
  if (denied) return denied;
  const { id } = await ctx.params;
  try {
    const body = await req.json();
    const decision = body.decision === "approve" ? "approve" : "reject";
    const guardianIndex = Number(body.guardian ?? 1);
    if (guardianIndex !== 1 && guardianIndex !== 2) return NextResponse.json({ error: "只有家人可以做這個決定。" }, { status: 400 });
    if (!Number.isInteger(Number(id)) || Number(id) < 0) return NextResponse.json({ error: "沒有這筆提案。" }, { status: 400 });
    const result = await guardianDecide({ proposalId: Number(id), guardianIndex, decision });
    const proposal = await getProposal(Number(id));
    return NextResponse.json({ ...result, proposal });
  } catch (e) {
    const zh = toZh(e);
    return NextResponse.json({ error: zh.text, detail: zh.detail }, { status: 500 });
  }
}
