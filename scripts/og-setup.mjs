import { ethers } from "ethers";
import { createZGComputeNetworkBroker } from "@0gfoundation/0g-compute-ts-sdk";
const provider = new ethers.JsonRpcProvider(process.env.OG_RPC_URL ?? "https://evmrpc-testnet.0g.ai");
const wallet = new ethers.Wallet(process.env.OWNER_PRIVATE_KEY, provider);
const broker = await createZGComputeNetworkBroker(wallet);
const services = await broker.inference.listService();
const chat = services.find((s) => s.serviceType === "chatbot") ?? services[0];
console.log("chat provider", chat.provider, chat.model, chat.verifiability);
try { await broker.ledger.getLedger(); console.log("ledger exists"); }
catch { console.log("creating ledger with 2 0G…"); await broker.ledger.addLedger(2); console.log("ledger created"); }
try { await broker.inference.acknowledgeProviderSigner(chat.provider); console.log("provider acknowledged"); } catch (e) { console.log("acknowledge:", e.message?.slice(0, 120)); }
const { endpoint, model } = await broker.inference.getServiceMetadata(chat.provider);
console.log("endpoint", endpoint, "model", model);
const body = JSON.stringify({ model, messages: [{ role: "user", content: "用一句話回答：1+1 等於多少？" }], max_tokens: 30 });
const headers = await broker.inference.getRequestHeaders(chat.provider, body);
const res = await fetch(`${endpoint}/chat/completions`, { method: "POST", headers: { "Content-Type": "application/json", ...headers }, body });
console.log("http", res.status);
const data = await res.json();
const chatID = res.headers.get("ZG-Res-Key") || data.id;
console.log("answer:", data.choices?.[0]?.message?.content?.slice(0, 80), "| chatID", chatID);
const ok = await broker.inference.processResponse(chat.provider, chatID);
console.log("TeeML verified:", ok);
console.log(`\nOG_PROVIDER=${chat.provider}\nOG_MODEL=${model}`);
