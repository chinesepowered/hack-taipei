/**
 * One switch for which chain the guardian wallet lives on.
 *   CHAIN=base-sepolia  (default)  Base Sepolia + Circle test USDC, four public RPC mirrors
 *   CHAIN=0g-galileo               0G Galileo testnet (16602): the wallet, the proof and the agent's identity all on 0G
 * Everything else (contract, ABI, scripts) is chain-agnostic.
 */
import { defineChain, type Chain } from "viem";
import { baseSepolia } from "viem/chains";

export const ogGalileo: Chain = defineChain({
  id: 16602,
  name: "0G Galileo Testnet",
  nativeCurrency: { name: "0G", symbol: "0G", decimals: 18 },
  rpcUrls: { default: { http: ["https://evmrpc-testnet.0g.ai"] } },
  blockExplorers: { default: { name: "0G Chainscan", url: "https://chainscan-galileo.0g.ai" } },
  testnet: true,
});

export type ChainKey = "base-sepolia" | "0g-galileo";
export const CHAIN_KEY: ChainKey = (process.env.NEXT_PUBLIC_CHAIN ?? process.env.CHAIN) === "0g-galileo" ? "0g-galileo" : "base-sepolia";

const PRESETS: Record<ChainKey, { chain: Chain; rpcs: string[]; explorer: string; usdc: string | null; gasName: string; faucet: string }> = {
  "base-sepolia": {
    chain: baseSepolia,
    rpcs: [
      process.env.BASE_SEPOLIA_RPC_URL ?? "https://sepolia.base.org",
      "https://base-sepolia-rpc.publicnode.com",
      "https://base-sepolia.drpc.org",
      "https://base-sepolia.gateway.tenderly.co",
    ],
    explorer: "https://sepolia.basescan.org",
    usdc: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
    gasName: "ETH",
    faucet: "https://portal.cdp.coinbase.com/products/faucet",
  },
  "0g-galileo": {
    chain: ogGalileo,
    rpcs: [process.env.OG_RPC_URL ?? "https://evmrpc-testnet.0g.ai"],
    explorer: "https://chainscan-galileo.0g.ai",
    usdc: null, // no Circle USDC on 0G testnet: deploy the mock with `pnpm deploy:usdc`
    gasName: "0G",
    faucet: "https://faucet.0g.ai",
  },
};

export const PRESET = PRESETS[CHAIN_KEY];
export const CHAIN = PRESET.chain;
export const RPC_URLS = (process.env.RPC_URLS?.split(",").map((s) => s.trim()).filter(Boolean) ?? PRESET.rpcs).filter((u, i, a) => a.indexOf(u) === i);
export const EXPLORER_URL = process.env.NEXT_PUBLIC_EXPLORER_URL ?? PRESET.explorer;
export const USDC_ADDRESS = process.env.NEXT_PUBLIC_USDC_ADDRESS ?? PRESET.usdc ?? "";
