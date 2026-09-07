import { NextResponse } from "next/server";
import { getMeta } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** The stamp behind proposal :id, as plain text anyone can copy into the offline verifier. */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const meta = getMeta(Number(id));
  if (!meta?.stamp) return NextResponse.json({ error: "這個提案沒有章" }, { status: 404 });
  return NextResponse.json({ proposal: Number(id), stamp: meta.stamp, stamp_id: meta.stampId, proof: meta.proof, agent: meta.agent, storage_root: meta.storageRoot ?? null, storage_tx: meta.storageTx ?? null });
}
