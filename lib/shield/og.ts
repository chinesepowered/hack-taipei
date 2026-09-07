/**
 * Scam Shield inference through the 0G Compute Network broker (testnet path).
 *
 * The broker signs each request with the agent's wallet, the provider runs the model inside a TEE (TeeML),
 * and `processResponse` checks the provider's signature over the response. That boolean is the proof the
 * stamp carries as `tee_verified`: not "the router said so", but a signature we verified ourselves.
 *
 * Ledger, provider acknowledgement and the broker object are created once per process and reused:
 * `createZGComputeNetworkBroker` is slow and does contract reads.
 */
import { ethers } from "ethers";
import { createZGComputeNetworkBroker } from "@0gfoundation/0g-compute-ts-sdk";

type Broker = Awaited<ReturnType<typeof createZGComputeNetworkBroker>>;
type Ready = { broker: Broker; provider: string; endpoint: string; model: string; verifiability: string };

let ready: Promise<Ready> | null = null;

async function init(): Promise<Ready> {
  const pk = process.env.OWNER_PRIVATE_KEY;
  if (!pk) throw new Error("OWNER_PRIVATE_KEY is not set");
  const rpc = new ethers.JsonRpcProvider(process.env.OG_RPC_URL ?? "https://evmrpc-testnet.0g.ai");
  const wallet = new ethers.Wallet(pk, rpc);
  const broker = await createZGComputeNetworkBroker(wallet);
  const services = await broker.inference.listService();
  const wanted = process.env.OG_PROVIDER?.toLowerCase();
  const svc =
    (wanted && services.find((s) => s.provider.toLowerCase() === wanted)) ??
    services.find((s) => s.serviceType === "chatbot" && /tee/i.test(String(s.verifiability))) ??
    services.find((s) => s.serviceType === "chatbot");
  if (!svc) throw new Error("no chatbot provider on the 0G compute network");
  try {
    await broker.ledger.getLedger();
  } catch {
    await broker.ledger.addLedger(Number(process.env.OG_LEDGER_0G ?? 1));
  }
  try {
    await broker.inference.acknowledgeProviderSigner(svc.provider);
  } catch {
    /* already acknowledged */
  }
  const { endpoint, model } = await broker.inference.getServiceMetadata(svc.provider, process.env.OG_MODEL || undefined);
  return { broker, provider: svc.provider, endpoint, model, verifiability: String(svc.verifiability) };
}

export function ogReady(): Promise<Ready> {
  if (!ready) ready = init().catch((e) => { ready = null; throw e; });
  return ready;
}

export type OgResult = { content: string; model: string; provider: string; chatID: string | null; verified: boolean | null; verifiability: string; raw: unknown };

/** One chat completion through the broker, then signature verification of the response. */
export async function ogChat(messages: { role: string; content: string }[], opts: { timeoutMs?: number; response_format?: unknown } = {}): Promise<OgResult> {
  const r = await ogReady();
  const body = JSON.stringify({ model: r.model, messages, ...(opts.response_format ? { response_format: opts.response_format } : {}) });
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), opts.timeoutMs ?? 30_000);
  try {
    // The testnet provider rate-limits (10 requests/min) and sheds load with 503. One patient retry before
    // giving up, so a single busy moment does not turn a TEE-verified judgment into a rules-only one.
    let res: Response | null = null;
    for (let attempt = 0; attempt < 2; attempt++) {
      const headers = await r.broker.inference.getRequestHeaders(r.provider, body);
      res = await fetch(`${r.endpoint}/chat/completions`, { method: "POST", headers: { "Content-Type": "application/json", ...headers }, body, signal: ctrl.signal });
      if (res.ok || (res.status !== 429 && res.status !== 503) || attempt === 1) break;
      const wait = Math.min(Number(res.headers.get("retry-after") ?? 0) * 1000 || 7_000, 15_000);
      console.warn(`[0g] provider ${res.status}, retrying in ${wait} ms`);
      await res.text().catch(() => "");
      await new Promise((ok) => setTimeout(ok, wait));
    }
    if (!res) throw new Error("0g provider: no response");
    if (!res.ok) throw new Error(`0g provider ${res.status}: ${(await res.text()).slice(0, 200)}`);
    const data = await res.json();
    const content: string = data.choices?.[0]?.message?.content ?? "";
    const chatID: string | null = res.headers.get("ZG-Res-Key") || (typeof data.id === "string" ? data.id : null);
    let verified: boolean | null = null;
    try {
      verified = chatID ? await r.broker.inference.processResponse(r.provider, chatID) : null;
    } catch (e) {
      console.warn("[0g] processResponse failed:", e instanceof Error ? e.message : e);
      verified = false;
    }
    return { content, model: String(data.model ?? r.model), provider: r.provider, chatID, verified, verifiability: r.verifiability, raw: data };
  } finally {
    clearTimeout(timer);
  }
}
