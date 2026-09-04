import { NextResponse } from "next/server";
import { getWalletState } from "@/lib/chain/wallet";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const s = await getWalletState();
    return NextResponse.json({
      address: s.address,
      balance_usdc: s.balanceUsdc,
      daily_limit_usdc: s.dailyLimitUsdc,
      remaining_today_usdc: s.remainingTodayUsdc,
      threshold: s.threshold,
      explorer: s.explorer,
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
