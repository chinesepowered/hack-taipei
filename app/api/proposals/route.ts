import { NextResponse } from "next/server";
import { getProposals } from "@/lib/chain/wallet";
import { EXPLORER_URL, GUARDIANS, WALLET_ADDRESS } from "@/lib/chain/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const proposals = await getProposals();
    return NextResponse.json({
      proposals,
      guardians: GUARDIANS.map((g) => ({ index: g.index, name: g.name })),
      explorer: EXPLORER_URL,
      wallet: WALLET_ADDRESS,
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
