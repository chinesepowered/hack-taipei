/**
 * Deploys GuardedWallet to Base Sepolia and allowlists the contacts marked `allowlisted`.
 * Run: pnpm deploy   (reads .env)
 */
import { createPublicClient, createWalletClient, http, parseUnits, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { baseSepolia } from "viem/chains";
import artifact from "../lib/chain/GuardedWallet.json" with { type: "json" };
import { CONTACTS } from "../lib/contacts";

function need(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`missing ${name} in .env`);
  return v;
}

const rpc = process.env.BASE_SEPOLIA_RPC_URL ?? "https://sepolia.base.org";
const usdc = need("NEXT_PUBLIC_USDC_ADDRESS") as Hex;
const owner = privateKeyToAccount(need("OWNER_PRIVATE_KEY") as Hex);
const g1 = privateKeyToAccount(need("GUARDIAN1_PRIVATE_KEY") as Hex);
const g2 = privateKeyToAccount(need("GUARDIAN2_PRIVATE_KEY") as Hex);
const threshold = BigInt(process.env.GUARDIAN_THRESHOLD ?? "2");
const dailyLimit = parseUnits(process.env.DAILY_LIMIT_USDC ?? "200", 6);

const publicClient = createPublicClient({ chain: baseSepolia, transport: http(rpc) });
const wallet = createWalletClient({ account: owner, chain: baseSepolia, transport: http(rpc) });

async function main() {
  const eth = await publicClient.getBalance({ address: owner.address });
  console.log(`deployer ${owner.address} has ${Number(eth) / 1e18} ETH`);
  if (eth === 0n) throw new Error("deployer has no Base Sepolia ETH. Use the Coinbase faucet first.");

  const hash = await wallet.deployContract({
    abi: artifact.abi,
    bytecode: artifact.bytecode as Hex,
    args: [usdc, owner.address, [g1.address, g2.address], threshold, dailyLimit],
  });
  console.log(`deploy tx ${hash}`);
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  const address = receipt.contractAddress!;
  console.log(`GuardedWallet deployed at ${address}`);

  for (const c of CONTACTS.filter((c) => c.allowlisted)) {
    const tx = await wallet.writeContract({
      address,
      abi: artifact.abi,
      functionName: "setAllowlist",
      args: [c.address, true],
    });
    await publicClient.waitForTransactionReceipt({ hash: tx });
    console.log(`allowlisted ${c.name} ${c.address}`);
  }

  console.log("\nNext steps:");
  console.log(`1. Put this in .env:  NEXT_PUBLIC_WALLET_ADDRESS=${address}`);
  console.log(`2. Send test USDC to ${address} from https://faucet.circle.com (Base Sepolia).`);
  console.log(`3. pnpm dev`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
