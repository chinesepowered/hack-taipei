import { NextResponse } from "next/server";
import { getJson } from "@/lib/storage";
import { verifyStamp } from "@/lib/proof/stamp";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Fetch a stamp document back from 0G Storage by Merkle root and verify it from those bytes, not ours. */
export async function GET(_req: Request, ctx: { params: Promise<{ root: string }> }) {
  const { root } = await ctx.params;
  if (!/^0x[0-9a-fA-F]{64}$/.test(root)) return NextResponse.json({ error: "不是 root hash" }, { status: 400 });
  try {
    const doc = await getJson<{ stamp?: string; proposal?: number }>(root);
    const verification = doc.stamp ? await verifyStamp(doc.stamp) : null;
    return NextResponse.json({ root, doc, verification });
  } catch (e) {
    return NextResponse.json({ error: `0G Storage 下載失敗：${e instanceof Error ? e.message.split("\n")[0] : String(e)}` }, { status: 502 });
  }
}
