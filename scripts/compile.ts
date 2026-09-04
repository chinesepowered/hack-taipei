/**
 * Compiles contracts/GuardedWallet.sol with solc-js and writes ABI + bytecode
 * to lib/chain/GuardedWallet.json. No Foundry needed.
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const solc = require("solc");

const root = resolve(import.meta.dirname, "..");
const source = readFileSync(resolve(root, "contracts/GuardedWallet.sol"), "utf8");

const input = {
  language: "Solidity",
  sources: { "GuardedWallet.sol": { content: source } },
  settings: {
    optimizer: { enabled: true, runs: 200 },
    outputSelection: { "*": { "*": ["abi", "evm.bytecode.object"] } },
  },
};

const output = JSON.parse(solc.compile(JSON.stringify(input)));

const errors = (output.errors ?? []).filter((e: { severity: string }) => e.severity === "error");
if (errors.length) {
  for (const e of output.errors) console.error(e.formattedMessage);
  process.exit(1);
}
for (const w of output.errors ?? []) console.warn(w.formattedMessage);

const artifact = output.contracts["GuardedWallet.sol"].GuardedWallet;
const out = {
  abi: artifact.abi,
  bytecode: `0x${artifact.evm.bytecode.object}`,
};

mkdirSync(resolve(root, "lib/chain"), { recursive: true });
writeFileSync(resolve(root, "lib/chain/GuardedWallet.json"), JSON.stringify(out, null, 2));
console.log(`compiled GuardedWallet: ${out.abi.length} ABI entries, ${(out.bytecode.length - 2) / 2} bytes`);
