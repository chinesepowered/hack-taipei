import { NextResponse } from "next/server";
import { decodeEventLog, formatUnits, type Hex } from "viem";
import { ABI, EXPLORER_URL, WALLET_ADDRESS, publicClient } from "@/lib/chain/client";
import usdc from "@/lib/chain/MockUSDC.json" with { type: "json" };

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Our own 鏈上紀錄: the receipt straight from the 0G RPC, with the GuardedWallet events decoded.
 * The public explorer renders client-side and is often blank in a popup; this never is.
 */
export async function GET(_req: Request, ctx: { params: Promise<{ hash: string }> }) {
  const { hash } = await ctx.params;
  if (!/^0x[0-9a-fA-F]{64}$/.test(hash)) return NextResponse.json({ error: "不是交易 hash" }, { status: 400 });
  try {
    const r = await publicClient.getTransactionReceipt({ hash: hash as Hex }).catch(() => null);
    if (!r) return NextResponse.json({ found: false, hash, explorer: `${EXPLORER_URL}/tx/${hash}` });
    const events: { name: string; args: Record<string, string> }[] = [];
    for (const log of r.logs) {
      for (const abi of [ABI, usdc.abi]) {
        try {
          const ev = decodeEventLog({ abi, data: log.data, topics: log.topics });
          const args: Record<string, string> = {};
          for (const [k, v] of Object.entries((ev.args ?? {}) as Record<string, unknown>)) args[k] = typeof v === "bigint" ? v.toString() : String(v);
          if (ev.eventName === "Transfer" && args.value) args.value_usdc = formatUnits(BigInt(args.value), 6);
          if (args.amount) args.amount_usdc = formatUnits(BigInt(args.amount), 6);
          events.push({ name: String(ev.eventName), args });
          break;
        } catch {
          /* not this ABI */
        }
      }
    }
    const block = await publicClient.getBlock({ blockNumber: r.blockNumber }).catch(() => null);
    return NextResponse.json({
      found: true,
      hash,
      status: r.status,
      block: r.blockNumber.toString(),
      at: block ? Number(block.timestamp) * 1000 : null,
      from: r.from,
      to: r.to,
      wallet: WALLET_ADDRESS,
      gasUsed: r.gasUsed.toString(),
      events,
      explorer: `${EXPLORER_URL}/tx/${hash}`,
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message.split("\n")[0] : String(e) }, { status: 500 });
  }
}
