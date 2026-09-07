// Serial on-chain setup for the 0G demo (one owner key, one nonce lane): recover the wallet deploy, allowlist contacts,
// mint test USDC, fund guardians, create the compute ledger, deploy + mint 豆豆's Agentic ID. Prints .env lines.
import { createPublicClient, createWalletClient, http, parseUnits, parseEther, formatEther, keccak256, stringToHex, decodeEventLog } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { readFileSync, writeFileSync } from "node:fs";
import { ethers } from "ethers";
import { createZGComputeNetworkBroker } from "@0gfoundation/0g-compute-ts-sdk";
import { ogGalileo } from "../lib/chain/config.ts";
import { CONTACTS } from "../lib/contacts.ts";
import wallet from "../lib/chain/GuardedWallet.json" with { type: "json" };
import usdc from "../lib/chain/MockUSDC.json" with { type: "json" };
import agentic from "../lib/chain/AgenticID.json" with { type: "json" };
import agentMeta from "../lib/proof/agent.json" with { type: "json" };

const RPC = "https://evmrpc-testnet.0g.ai";
const WAIT = { pollingInterval: 1500, retryCount: 40, retryDelay: 1500, timeout: 180000 };
const owner = privateKeyToAccount(process.env.OWNER_PRIVATE_KEY);
const g1 = privateKeyToAccount(process.env.GUARDIAN1_PRIVATE_KEY);
const g2 = privateKeyToAccount(process.env.GUARDIAN2_PRIVATE_KEY);
const pub = createPublicClient({ chain: ogGalileo, transport: http(RPC) });
const w = createWalletClient({ account: owner, chain: ogGalileo, transport: http(RPC) });
const env = {};
const setEnv = (k, v) => { env[k] = v; let s = readFileSync(".env", "utf8"); s = s.match(new RegExp(`^${k}=.*$`, "m")) ? s.replace(new RegExp(`^${k}=.*$`, "m"), `${k}=${v}`) : s + `\n${k}=${v}\n`; writeFileSync(".env", s); };
const wait = async (hash) => { const t0 = Date.now(); for (;;) { try { const r = await pub.getTransactionReceipt({ hash }); if (r) return r; } catch {} if (Date.now() - t0 > 180000) throw new Error("receipt timeout " + hash); await new Promise((r) => setTimeout(r, 1500)); } };
const step = (m) => console.log(`\n▶ ${m}`);

step("GuardedWallet from .env");
const WALLET = process.env.NEXT_PUBLIC_WALLET_ADDRESS;
console.log("GuardedWallet", WALLET, "threshold", String(await pub.readContract({ address: WALLET, abi: wallet.abi, functionName: "threshold" })));
const USDC = process.env.NEXT_PUBLIC_USDC_ADDRESS;

step("allowlist contacts");
for (const c of CONTACTS.filter((c) => c.allowlisted)) {
  const already = await pub.readContract({ address: WALLET, abi: wallet.abi, functionName: "allowlist", args: [c.address] });
  if (already) { console.log("already", c.name); continue; }
  const h = await w.writeContract({ address: WALLET, abi: wallet.abi, functionName: "setAllowlist", args: [c.address, true] });
  await wait(h); console.log("allowlisted", c.name);
}

step("mint 1000 test USDC into the wallet");
const have = await pub.readContract({ address: WALLET, abi: wallet.abi, functionName: "balance" });
if (have >= parseUnits("500", 6)) { console.log("wallet already holds", String(have)); } else {
const h1 = await w.writeContract({ address: USDC, abi: usdc.abi, functionName: "mint", args: [WALLET, parseUnits("1000", 6)] });
await wait(h1); console.log("balance", await pub.readContract({ address: WALLET, abi: wallet.abi, functionName: "balance" })); }

step("fund guardians with gas");
for (const g of [g1, g2]) {
  const bal = await pub.getBalance({ address: g.address });
  if (bal >= parseEther("0.05")) { console.log("ok", g.address, formatEther(bal)); continue; }
  const h = await w.sendTransaction({ to: g.address, value: parseEther("0.1") - bal }); await wait(h); console.log("funded", g.address);
}

step("0G compute ledger (min 3 0G) + provider acknowledgement + verified test inference");
const provider = new ethers.JsonRpcProvider(RPC);
const ew = new ethers.Wallet(process.env.OWNER_PRIVATE_KEY, provider);
const broker = await createZGComputeNetworkBroker(ew);
const services = await broker.inference.listService();
const chat = services.find((s) => s.serviceType === "chatbot");
try { await broker.ledger.getLedger(); console.log("ledger exists"); } catch { await broker.ledger.addLedger(3); console.log("ledger created with 3 0G"); }
try { await broker.inference.acknowledgeProviderSigner(chat.provider); console.log("provider acknowledged"); } catch (e) { console.log("acknowledge:", String(e.message).slice(0, 100)); }
const { endpoint, model } = await broker.inference.getServiceMetadata(chat.provider);
const body = JSON.stringify({ model, messages: [{ role: "user", content: "只回傳 JSON：{\"ok\":true}" }], max_tokens: 20 });
const headers = await broker.inference.getRequestHeaders(chat.provider, body);
const res = await fetch(`${endpoint}/chat/completions`, { method: "POST", headers: { "Content-Type": "application/json", ...headers }, body });
const data = await res.json();
const chatID = res.headers.get("ZG-Res-Key") || data.id;
console.log("http", res.status, "| answer:", String(data.choices?.[0]?.message?.content ?? JSON.stringify(data).slice(0, 120)).slice(0, 80), "| chatID", chatID);
console.log("TeeML verified:", await broker.inference.processResponse(chat.provider, chatID));
setEnv("OG_PROVIDER", chat.provider); setEnv("OG_MODEL", model);

step("deploy AgenticID + mint 豆豆");
if (process.env.AGENT_ID_CONTRACT && process.env.AGENT_ID_TOKEN) { console.log("already minted", process.env.AGENT_ID_CONTRACT, "#", process.env.AGENT_ID_TOKEN); process.exit(0); }
const hd = await w.deployContract({ abi: agentic.abi, bytecode: agentic.bytecode, args: [] });
const rd = await wait(hd); const AID = rd.contractAddress; console.log("AgenticID", AID);
const meta = JSON.stringify(agentMeta);
const uri = `data:application/json;base64,${Buffer.from(meta).toString("base64")}`;
const hm = await w.writeContract({ address: AID, abi: agentic.abi, functionName: "mint", args: [owner.address, owner.address, uri, keccak256(stringToHex(meta))] });
const rm = await wait(hm);
let tokenId = null;
for (const log of rm.logs) { try { const ev = decodeEventLog({ abi: agentic.abi, data: log.data, topics: log.topics }); if (ev.eventName === "Minted") tokenId = String(ev.args.tokenId); } catch {} }
console.log("豆豆 Agentic ID token", tokenId, "tx", hm);
setEnv("AGENT_ID_CONTRACT", AID); setEnv("AGENT_ID_TOKEN", tokenId ?? "1");
console.log("\nowner 0G left:", formatEther(await pub.getBalance({ address: owner.address })));
console.log("\n.env updated:", JSON.stringify(env, null, 1));
