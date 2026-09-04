import { NextResponse } from "next/server";
import { getProposal, guardianDecide } from "@/lib/chain/wallet";

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
    const result = await guardianDecide({ proposalId: Number(id), guardianIndex: Number(body.guardian ?? 1), decision });
    const proposal = await getProposal(Number(id));
    return NextResponse.json({ ...result, proposal });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
