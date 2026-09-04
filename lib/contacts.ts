import { keccak256, toHex, type Address } from "viem";

/**
 * Ah-ma's address book. Demo recipients get deterministic pseudo-addresses derived from their name,
 * so the same contact always maps to the same account on Base Sepolia.
 * Allowlisted contacts can be paid directly within the daily limit; everyone else needs the family.
 */
export type Contact = {
  name: string;
  aliases: string[];
  address: Address;
  allowlisted: boolean;
  note: string;
};

export function pseudoAddress(seed: string): Address {
  return `0x${keccak256(toHex(`grandmas-wallet:${seed.trim()}`)).slice(-40)}` as Address;
}

export const CONTACTS: Contact[] = [
  { name: "阿明", aliases: ["阿明", "菜販阿明", "賣菜的"], address: pseudoAddress("阿明"), allowlisted: true, note: "市場賣菜的阿明，每週買菜" },
  { name: "水電行", aliases: ["水電行", "水電師傅", "王師傅"], address: pseudoAddress("水電行"), allowlisted: true, note: "巷口水電行" },
  { name: "孫子小凱", aliases: ["小凱", "孫子", "阿凱"], address: pseudoAddress("孫子小凱"), allowlisted: true, note: "孫子，也是家人共簽人之一" },
  { name: "媽媽", aliases: ["媽媽", "女兒", "阿華"], address: pseudoAddress("媽媽"), allowlisted: true, note: "女兒，家人共簽人之一" },
  { name: "藥局", aliases: ["藥局", "康是美", "拿藥"], address: pseudoAddress("藥局"), allowlisted: true, note: "常去的藥局" },
];

export type ResolvedRecipient = { name: string; address: Address; known: boolean; allowlisted: boolean };

/** Map whatever the agent heard (a name, a nickname, an account number, an address) to a recipient. */
export function resolveRecipient(input: string): ResolvedRecipient {
  const q = input.trim();
  const hit = CONTACTS.find((c) => c.name === q || c.aliases.some((a) => q.includes(a)));
  if (hit) return { name: hit.name, address: hit.address, known: true, allowlisted: hit.allowlisted };
  if (/^0x[0-9a-fA-F]{40}$/.test(q)) return { name: q, address: q as Address, known: false, allowlisted: false };
  return { name: q || "不明收款人", address: pseudoAddress(q || "unknown"), known: false, allowlisted: false };
}
