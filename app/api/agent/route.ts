import { NextResponse } from "next/server";
import { agentIdentity } from "@/lib/proof/stamp";
import agent from "@/lib/proof/agent.json" with { type: "json" };

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Who 豆豆 is: its signing address, its Agentic ID (if minted), and its declared capabilities. */
export async function GET() {
  const id = agentIdentity();
  return NextResponse.json({
    ...id,
    metadata: agent,
    shield:
      process.env.SHIELD_PROVIDER === "0g-broker"
        ? { mode: "0g-compute-network (broker, testnet)", provider: process.env.OG_PROVIDER ?? null, model: process.env.OG_MODEL ?? null, verifiability: "TeeML" }
        : { mode: "openai-compatible", base_url: process.env.SHIELD_BASE_URL || "https://api.openai.com/v1", model: process.env.SHIELD_MODEL || "gpt-5-mini", trust_mode: process.env.SHIELD_TRUST_MODE || "verified" },
  });
}
