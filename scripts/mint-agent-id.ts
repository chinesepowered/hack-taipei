/**
 * Mint 豆豆's Agentic ID (ERC-7857) on 0G Galileo and print the .env lines the stamp uses.
 * Needs AGENT_ID_CONTRACT (an ERC-7857 contract whose `mint(to, encryptedURI, metadataHash)` the owner may call;
 * the event's testnet toolkit or your own deployment). Metadata is lib/proof/agent.json; on-chain we commit its hash.
 *   pnpm mint-agent
 * If the contract exposes a different mint signature, set AGENT_ID_MINT_ABI to a JSON ABI fragment.
 */
import { createPublicClient, createWalletClient, decodeEventLog, http, keccak256, stringToHex, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { ogGalileo } from "../lib/chain/config";
import agent from "../lib/proof/agent.json" with { type: "json" };

const DEFAULT_ABI = [
  {
    type: "function",
    name: "mint",
    stateMutability: "nonpayable",
    inputs: [
      { name: "to", type: "address" },
      { name: "encryptedURI", type: "string" },
      { name: "metadataHash", type: "bytes32" },
    ],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "event",
    name: "Transfer",
    inputs: [
      { name: "from", type: "address", indexed: true },
      { name: "to", type: "address", indexed: true },
      { name: "tokenId", type: "uint256", indexed: true },
    ],
  },
] as const;

async function main() {
  const contract = process.env.AGENT_ID_CONTRACT as Hex | undefined;
  if (!contract) throw new Error("AGENT_ID_CONTRACT is not set (the ERC-7857 contract address from the 0G testnet toolkit)");
  const owner = privateKeyToAccount(process.env.OWNER_PRIVATE_KEY as Hex);
  const rpc = process.env.OG_RPC_URL ?? "https://evmrpc-testnet.0g.ai";
  const pub = createPublicClient({ chain: ogGalileo, transport: http(rpc) });
  const wallet = createWalletClient({ account: owner, chain: ogGalileo, transport: http(rpc) });
  const abi = process.env.AGENT_ID_MINT_ABI ? JSON.parse(process.env.AGENT_ID_MINT_ABI) : DEFAULT_ABI;

  const metadata = JSON.stringify(agent);
  const metadataHash = keccak256(stringToHex(metadata));
  const uri = process.env.AGENT_ID_URI ?? `data:application/json;base64,${Buffer.from(metadata).toString("base64")}`;
  console.log(`minting Agentic ID for ${agent.name} to ${owner.address} on 0G Galileo`);
  console.log(`metadataHash ${metadataHash}`);
  const hash = await wallet.writeContract({ address: contract, abi, functionName: "mint", args: [owner.address, uri, metadataHash] });
  const receipt = await pub.waitForTransactionReceipt({ hash });
  let tokenId: string | null = null;
  for (const log of receipt.logs) {
    try {
      const ev = decodeEventLog({ abi: DEFAULT_ABI, data: log.data, topics: log.topics });
      if (ev.eventName === "Transfer") tokenId = String((ev.args as { tokenId: bigint }).tokenId);
    } catch {
      /* not ours */
    }
  }
  console.log(`tx ${hash}`);
  console.log(`\nPut this in .env:\nAGENT_ID_CONTRACT=${contract}\nAGENT_ID_TOKEN=${tokenId ?? "<tokenId from the explorer>"}`);
  console.log(`explorer https://chainscan-galileo.0g.ai/tx/${hash}`);
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
