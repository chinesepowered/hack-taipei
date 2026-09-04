/**
 * End-to-end check against the deployed contract on Base Sepolia:
 * reads balance, creates a risky proposal, guardian 1 rejects it, then an allowlisted micro-payment goes through.
 * Run: pnpm smoke
 */
import { formatUnits, parseUnits } from "viem";
import { getWalletState, proposePayment, guardianDecide, payDirect, resolveRecipient } from "../lib/chain/wallet";

async function main() {
  const state = await getWalletState();
  console.log("wallet", state);

  const scammer = resolveRecipient("0912345678");
  console.log("scammer pseudo-address", scammer);
  const proposal = await proposePayment({ to: scammer.address, amount: parseUnits("300", 6), memo: "smoke: 假冒孫子", riskScore: 92 });
  console.log("proposed", proposal);
  const rej = await guardianDecide({ proposalId: proposal.id, guardianIndex: 1, decision: "reject" });
  console.log("rejected", rej);

  const ming = resolveRecipient("阿明");
  if (state.balance >= parseUnits("1", 6)) {
    const paid = await payDirect({ to: ming.address, amount: parseUnits("1", 6), memo: "smoke: 菜錢" });
    console.log("paid 1 USDC to 阿明", paid);
  } else {
    console.log(`skip direct payment, balance is only ${formatUnits(state.balance, 6)} USDC`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
