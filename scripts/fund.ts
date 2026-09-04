/**
 * Tops up the two guardian wallets with Base Sepolia ETH from the owner/deployer wallet
 * so they can pay gas for approve()/reject(). Also reports the owner's USDC balance.
 * Run: node --env-file=.env --import=tsx scripts/fund.ts
 */
import { createPublicClient, createWalletClient, fallback, formatEther, formatUnits, http, parseEther, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { baseSepolia } from "viem/chains";
import { RPC_URLS } from "../lib/chain/client";

// Same four-endpoint fallback the app uses, so the reproduction path is as resilient as the demo.
const rpc = () => fallback(RPC_URLS.map((u) => http(u, { timeout: 8_000, retryCount: 1 })), { rank: false });
const usdc = process.env.NEXT_PUBLIC_USDC_ADDRESS as Hex;
const owner = privateKeyToAccount(process.env.OWNER_PRIVATE_KEY as Hex);
const guardians = [process.env.GUARDIAN1_PRIVATE_KEY, process.env.GUARDIAN2_PRIVATE_KEY].map((k) => privateKeyToAccount(k as Hex));
const TARGET = parseEther(process.env.GUARDIAN_ETH ?? "0.003");

const pub = createPublicClient({ chain: baseSepolia, transport: rpc() });
const wallet = createWalletClient({ account: owner, chain: baseSepolia, transport: rpc() });
const erc20 = [{ type: "function", name: "balanceOf", stateMutability: "view", inputs: [{ name: "a", type: "address" }], outputs: [{ type: "uint256" }] }] as const;

async function main() {
  const ownerEth = await pub.getBalance({ address: owner.address });
  const ownerUsdc = (await pub.readContract({ address: usdc, abi: erc20, functionName: "balanceOf", args: [owner.address] })) as bigint;
  console.log(`owner ${owner.address}: ${formatEther(ownerEth)} ETH, ${formatUnits(ownerUsdc, 6)} USDC`);
  if (ownerEth < TARGET * 2n + parseEther("0.002")) throw new Error("owner does not have enough Base Sepolia ETH to fund guardians and deploy");

  for (const g of guardians) {
    const bal = await pub.getBalance({ address: g.address });
    if (bal >= TARGET) {
      console.log(`guardian ${g.address} already has ${formatEther(bal)} ETH`);
      continue;
    }
    const hash = await wallet.sendTransaction({ to: g.address, value: TARGET - bal });
    await pub.waitForTransactionReceipt({ hash });
    console.log(`funded guardian ${g.address} with ${formatEther(TARGET - bal)} ETH (${hash})`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
