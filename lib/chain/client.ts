import { createPublicClient, createWalletClient, fallback, http, type Address, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import artifact from "./GuardedWallet.json" with { type: "json" };
import { CHAIN as CFG_CHAIN, CHAIN_KEY, EXPLORER_URL as CFG_EXPLORER, RPC_URLS as CFG_RPCS, USDC_ADDRESS as CFG_USDC } from "./config";

export { CHAIN_KEY };
export const CHAIN = CFG_CHAIN;
export const EXPLORER_URL = CFG_EXPLORER;
export const USDC_ADDRESS = CFG_USDC as Address;
export const WALLET_ADDRESS = (process.env.NEXT_PUBLIC_WALLET_ADDRESS ?? "") as Address;
export const ABI = artifact.abi;

/**
 * RPC endpoints tried in order (see lib/chain/config.ts). On Base Sepolia that is the configured one plus three
 * public mirrors, so a flaky venue connection does not take the demo down. Override with RPC_URLS (comma-separated).
 */
export const RPC_URLS = CFG_RPCS;

const transport = () => fallback(RPC_URLS.map((url) => http(url, { timeout: 8_000, retryCount: 1 })), { rank: false });

export const publicClient = createPublicClient({ chain: CHAIN, transport: transport() });

function walletFor(envKey: string) {
  const pk = process.env[envKey];
  if (!pk) return null;
  return createWalletClient({ account: privateKeyToAccount(pk as Hex), chain: CHAIN, transport: transport() });
}

export function ownerWallet() {
  const w = walletFor("OWNER_PRIVATE_KEY");
  if (!w) throw new Error("OWNER_PRIVATE_KEY is not set");
  return w;
}

export const GUARDIANS = [
  { index: 1, name: process.env.GUARDIAN1_NAME ?? "媽媽", envKey: "GUARDIAN1_PRIVATE_KEY" },
  { index: 2, name: process.env.GUARDIAN2_NAME ?? "孫子小凱", envKey: "GUARDIAN2_PRIVATE_KEY" },
] as const;

export function guardianWallet(index: number) {
  const g = GUARDIANS.find((g) => g.index === index);
  if (!g) throw new Error(`no guardian ${index}`);
  const w = walletFor(g.envKey);
  if (!w) throw new Error(`${g.envKey} is not set`);
  return { wallet: w, name: g.name };
}

export function assertConfigured() {
  if (!WALLET_ADDRESS) throw new Error("NEXT_PUBLIC_WALLET_ADDRESS is not set. Run `pnpm deploy` first.");
}

export const ERC20_ABI = [
  { type: "function", name: "balanceOf", stateMutability: "view", inputs: [{ name: "who", type: "address" }], outputs: [{ type: "uint256" }] },
] as const;
