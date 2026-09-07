import { ethers } from "ethers";
import { createZGComputeNetworkBroker } from "@0gfoundation/0g-compute-ts-sdk";
const provider = new ethers.JsonRpcProvider("https://evmrpc-testnet.0g.ai");
const wallet = new ethers.Wallet(process.env.OWNER_PRIVATE_KEY, provider);
const broker = await createZGComputeNetworkBroker(wallet);
const services = await broker.inference.listService();
console.log("services:", services.length);
for (const s of services) {
  const o = { provider: s.provider, model: s.model, type: s.serviceType, url: s.url, verifiability: s.verifiability, inPrice: String(s.inputPrice), outPrice: String(s.outputPrice) };
  console.log(JSON.stringify(o));
}
try { const l = await broker.ledger.getLedger(); console.log("ledger:", JSON.stringify(l, (k, v) => typeof v === "bigint" ? v.toString() : v).slice(0, 300)); } catch (e) { console.log("ledger: none yet (", e.message?.slice(0, 80), ")"); }
