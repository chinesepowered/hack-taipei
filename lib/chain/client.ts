import { createPublicClient, createWalletClient, fallback, http, type Address, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { baseSepolia } from "viem/chains";
import artifact from "./GuardedWallet.json" with { type: "json" };

export const CHAIN = baseSepolia;
export const EXPLORER_URL = process.env.NEXT_PUBLIC_EXPLORER_URL ?? "https://sepolia.basescan.org";
export const USDC_ADDRESS = (process.env.NEXT_PUBLIC_USDC_ADDRESS ?? "0x036CbD53842c5426634e7929541eC2318f3dCF7e") as Address;
export const WALLET_ADDRESS = (process.env.NEXT_PUBLIC_WALLET_ADDRESS ?? "") as Address;
export const ABI = artifact.abi;

/**
 * Public Base Sepolia RPCs, tried in order. The configured one first, then well-known public mirrors,
 * so a flaky venue connection or one rate-limited endpoint does not take the demo down.
 * Override the whole list with BASE_SEPOLIA_RPC_URLS (comma-separated).
 */
const DEFAULT_RPCS = [
  process.env.BASE_SEPOLIA_RPC_URL ?? "https://sepolia.base.org",
  "https://base-sepolia-rpc.publicnode.com",
  "https://base-sepolia.drpc.org",
  "https://base-sepolia.gateway.tenderly.co",
];
export const RPC_URLS = (process.env.BASE_SEPOLIA_RPC_URLS?.split(",").map((s) => s.trim()).filter(Boolean) ?? DEFAULT_RPCS).filter(
  (u, i, a) => a.indexOf(u) === i,
);

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
