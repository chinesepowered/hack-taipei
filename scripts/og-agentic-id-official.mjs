// Register 豆豆 on the OFFICIAL 0G AgenticID (ERC-8004 identity + ERC-7857 sealed iData), mint-only (no sandbox).
import { AgenticID } from "@0gfoundation/0g-agenticid-sdk";
import { parseEther } from "viem";
import { readFileSync } from "node:fs";
const agentMeta = JSON.parse(readFileSync("lib/proof/agent.json", "utf8"));
const cfg = await fetch("https://agenticid.0g.ai/config").then((r) => r.json());
const ag = await AgenticID.fromAttestor("https://agenticid.0g.ai", { account: process.env.OWNER_PRIVATE_KEY });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// 1) trust-root ack (three components), wait until the chain agrees
let st = await ag.ackStatus();
if (!st.allAcked) {
  const tx = await ag.ack();
  console.log("ack tx", tx);
  if (tx && ag.waitForTransaction) await ag.waitForTransaction(tx).catch(() => {});
  for (let i = 0; i < 60 && !st.allAcked; i++) { await sleep(3000); st = await ag.ackStatus(); }
}
console.log("ackStatus:", JSON.stringify(st));

// 2) prepaid sandbox balance: deploy preflights >= 0.1 OG even for mint-only, top up if needed
let bal = BigInt(await ag.getBalance());
if (bal < parseEther("0.1")) {
  const tx = await ag.deposit({ amountWei: parseEther("0.2") });
  console.log("deposit tx", tx);
  if (tx && ag.waitForTransaction) await ag.waitForTransaction(tx).catch(() => {});
  for (let i = 0; i < 40 && bal < parseEther("0.1"); i++) { await sleep(3000); bal = BigInt(await ag.getBalance()); }
}
console.log("sandbox balance (wei):", bal.toString());

// 3) mint-only deploy
// The attestor client base64-encodes with btoa(), which rejects non-Latin1 text: register with ASCII, keep 中文 in our own metadata.
const params = {
  name: process.env.AGENT_ASCII_NAME ?? "Doudou - Grandma's Wallet guardian",
  description: "Voice guardian agent for elders: listens to calls, scores payment risk against 165 anti-fraud patterns, routes risky payments to a 2-of-N family co-sign wallet. Capabilities: assess_payment, explain_risk_zh, propose_to_guardians.",
  framework: process.env.AGENT_FRAMEWORK ?? cfg.frameworks?.[0]?.name ?? "openclaw",
  inference: { provider: "0g-compute", model: process.env.OG_MODEL ?? "qwen/qwen2.5-omni-7b" },
  sandbox: undefined,
};
console.log("deploying mint-only:", params.name, "framework", params.framework);
const t0 = Date.now();
const r = await ag.agent.deploy(params, { wait: "minted" });
console.log("minted:", JSON.stringify(r, (k, v) => (typeof v === "bigint" ? v.toString() : v)), "in", Math.round((Date.now() - t0) / 1000), "s");
const agentId = r.agentId?.toString();
console.log("owner:", await ag.agent.ownerOf(BigInt(agentId)));
console.log("agentSeal:", await ag.agent.getAgentSeal(BigInt(agentId)));
console.log(`\nOFFICIAL_AGENT_ID=${agentId}\nOFFICIAL_AGENTIC_ID_CONTRACT=${cfg.agentic_id_addr}\nERC8004 explorer: https://8004scan.io/agent/${agentId}`);
