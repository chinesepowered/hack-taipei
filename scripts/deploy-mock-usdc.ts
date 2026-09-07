/**
 * 0G Galileo has no Circle USDC faucet, so the demo deploys its own 6-decimal test token.
 *   pnpm deploy:usdc                          deploy MockUSDC, print the .env line
 *   pnpm deploy:usdc --mint <address> <usdc>  mint test USDC into an address (e.g. the GuardedWallet)
 */
import { createPublicClient, createWalletClient, http, parseUnits, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { CHAIN, CHAIN_KEY, RPC_URLS, USDC_ADDRESS } from "../lib/chain/config";
import artifact from "../lib/chain/MockUSDC.json" with { type: "json" };

const owner = privateKeyToAccount(process.env.OWNER_PRIVATE_KEY as Hex);
const pub = createPublicClient({ chain: CHAIN, transport: http(RPC_URLS[0]) });
const wallet = createWalletClient({ account: owner, chain: CHAIN, transport: http(RPC_URLS[0]) });

async function main() {
  const argv = process.argv.slice(2);
  if (argv[0] === "--mint") {
    const to = argv[1] as Hex;
    const amount = parseUnits(argv[2] ?? "1000", 6);
    const token = (process.env.NEXT_PUBLIC_USDC_ADDRESS || USDC_ADDRESS) as Hex;
    if (!token) throw new Error("NEXT_PUBLIC_USDC_ADDRESS is not set; deploy first");
    const hash = await wallet.writeContract({ address: token, abi: artifact.abi, functionName: "mint", args: [to, amount] });
    await pub.waitForTransactionReceipt({ hash });
    console.log(`minted ${argv[2] ?? "1000"} USDC to ${to} (${hash})`);
    return;
  }
  console.log(`[${CHAIN_KEY}] deploying MockUSDC from ${owner.address}`);
  const hash = await wallet.deployContract({ abi: artifact.abi, bytecode: artifact.bytecode as Hex, args: [] });
  const receipt = await pub.waitForTransactionReceipt({ hash });
  console.log(`MockUSDC deployed at ${receipt.contractAddress}`);
  console.log(`Put this in .env:  NEXT_PUBLIC_USDC_ADDRESS=${receipt.contractAddress}`);
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
