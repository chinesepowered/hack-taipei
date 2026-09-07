/**
 * Deploys GuardedWallet to Base Sepolia and allowlists the contacts marked `allowlisted`.
 * Run: pnpm deploy   (reads .env)
 */
import { createPublicClient, createWalletClient, http, parseUnits, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { CHAIN, CHAIN_KEY, PRESET, RPC_URLS, USDC_ADDRESS } from "../lib/chain/config";
import artifact from "../lib/chain/GuardedWallet.json" with { type: "json" };
import { CONTACTS } from "../lib/contacts";

function need(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`missing ${name} in .env`);
  return v;
}

const rpc = RPC_URLS[0];
const usdc = (USDC_ADDRESS || need("NEXT_PUBLIC_USDC_ADDRESS")) as Hex;
const owner = privateKeyToAccount(need("OWNER_PRIVATE_KEY") as Hex);
const g1 = privateKeyToAccount(need("GUARDIAN1_PRIVATE_KEY") as Hex);
const g2 = privateKeyToAccount(need("GUARDIAN2_PRIVATE_KEY") as Hex);
const threshold = BigInt(process.env.GUARDIAN_THRESHOLD ?? "2");
const dailyLimit = parseUnits(process.env.DAILY_LIMIT_USDC ?? "200", 6);

const publicClient = createPublicClient({ chain: CHAIN, transport: http(rpc) });
const wallet = createWalletClient({ account: owner, chain: CHAIN, transport: http(rpc) });

async function main() {
  const eth = await publicClient.getBalance({ address: owner.address });
  console.log(`[${CHAIN_KEY}] deployer ${owner.address} has ${Number(eth) / 1e18} ${PRESET.gasName}`);
  if (eth === 0n) throw new Error(`deployer has no ${PRESET.gasName} for gas. Faucet: ${PRESET.faucet}`);

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
  console.log(CHAIN_KEY === "0g-galileo" ? `2. Mint test USDC into ${address}:  pnpm deploy:usdc --mint ${address} 1000` : `2. Send test USDC to ${address} from https://faucet.circle.com (Base Sepolia).`);
  console.log(`3. pnpm dev`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
