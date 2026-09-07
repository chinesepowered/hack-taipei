import type { Hex, PublicClient, TransactionReceipt } from "viem";

/**
 * Galileo's public RPC answers `eth_getTransactionReceipt` with null for several seconds after a tx is mined,
 * which makes viem's built-in waiter give up. Poll ourselves, patiently, and treat "not found" as "not yet".
 */
export async function waitReceipt(client: PublicClient, hash: Hex, timeoutMs = 180_000, everyMs = 1_500): Promise<TransactionReceipt> {
  const started = Date.now();
  let lastErr: unknown;
  while (Date.now() - started < timeoutMs) {
    try {
      const r = await client.getTransactionReceipt({ hash });
      if (r) return r;
    } catch (e) {
      lastErr = e;
    }
    await new Promise((res) => setTimeout(res, everyMs));
  }
  throw new Error(`receipt for ${hash} not found after ${Math.round(timeoutMs / 1000)}s: ${lastErr instanceof Error ? lastErr.message.split("\n")[0] : ""}`);
}
