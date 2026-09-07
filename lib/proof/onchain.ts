/**
 * Optional on-chain identity check for a stamp: the address that signed it must be the executor of the
 * Agentic ID the stamp names. Offline verification proves the signature; this proves the signer *is* 豆豆.
 */
import { createPublicClient, http, type Address } from "viem";
import { ogGalileo } from "../chain/config";
import agentic from "../chain/AgenticID.json" with { type: "json" };

export type IdentityCheck = { checked: boolean; ok: boolean; reason: string; owner?: Address; executor?: Address; explorer?: string };

export async function checkIdentityOnChain(p: { agent_id_contract: string | null; agent_id_token: string | null; signer: Address }): Promise<IdentityCheck> {
  if (!p.agent_id_contract || !p.agent_id_token) return { checked: false, ok: false, reason: "章上沒有 Agentic ID" };
  const client = createPublicClient({ chain: ogGalileo, transport: http(process.env.OG_RPC_URL ?? "https://evmrpc-testnet.0g.ai", { timeout: 10_000 }) });
  try {
    // Our demo AgenticID exposes agentOf(); the official 0G AgenticID (ERC-8004/ERC-7857) exposes ownerOf() only.
    let owner: Address;
    let executor: Address;
    let kind = "demo";
    try {
      const a = (await client.readContract({ address: p.agent_id_contract as Address, abi: agentic.abi, functionName: "agentOf", args: [BigInt(p.agent_id_token)] })) as { owner: Address; executor: Address };
      owner = a.owner;
      executor = a.executor;
    } catch {
      const ERC721 = [{ type: "function", name: "ownerOf", stateMutability: "view", inputs: [{ name: "tokenId", type: "uint256" }], outputs: [{ type: "address" }] }] as const;
      owner = (await client.readContract({ address: p.agent_id_contract as Address, abi: ERC721, functionName: "ownerOf", args: [BigInt(p.agent_id_token)] })) as Address;
      executor = owner;
      kind = "official";
    }
    const ok = executor.toLowerCase() === p.signer.toLowerCase();
    const who = kind === "official" ? "owner" : "executor";
    return {
      checked: true,
      ok,
      reason: ok ? `簽章者就是 Agentic ID #${p.agent_id_token} 的 ${who}` : `簽章者 ${p.signer} 不是 Agentic ID #${p.agent_id_token} 的 ${who}（鏈上是 ${executor}）`,
      owner,
      executor,
      explorer: kind === "official" ? `https://8004scan.io/agent/${p.agent_id_token}` : `https://chainscan-galileo.0g.ai/address/${p.agent_id_contract}`,
    };
  } catch (e) {
    return { checked: false, ok: false, reason: `鏈上查詢失敗：${e instanceof Error ? e.message.split("\n")[0] : e}` };
  }
}
