/** Generate fresh throwaway keys for a demo deployment and print the .env lines. Run: pnpm keys */
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
for (const name of ["OWNER_PRIVATE_KEY", "GUARDIAN1_PRIVATE_KEY", "GUARDIAN2_PRIVATE_KEY"]) {
  const pk = generatePrivateKey();
  console.log(`${name}=${pk}   # ${privateKeyToAccount(pk).address}`);
}
console.log("\nFund the OWNER address with testnet gas (0G faucet: https://faucet.0g.ai). Guardians get gas from `pnpm fund`.");
