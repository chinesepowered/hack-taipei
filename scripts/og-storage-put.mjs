// Put a small JSON document on 0G Storage (testnet turbo indexer). Prints the root hash. Used for the stamp of a proposal.
import { ZgFile, Indexer } from "@0gfoundation/0g-storage-ts-sdk";
import { ethers } from "ethers";
import { writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
const RPC = process.env.OG_RPC_URL ?? "https://evmrpc-testnet.0g.ai";
const INDEXER = process.env.OG_INDEXER ?? "https://indexer-storage-testnet-turbo.0g.ai";
const payload = process.argv[2] ? JSON.parse(process.argv[2]) : { hello: "grandma", at: Date.now() };
const dir = mkdtempSync(join(tmpdir(), "og-"));
const path = join(dir, "doc.json");
writeFileSync(path, JSON.stringify(payload));
const provider = new ethers.JsonRpcProvider(RPC);
const signer = new ethers.Wallet(process.env.OWNER_PRIVATE_KEY, provider);
const indexer = new Indexer(INDEXER);
const file = await ZgFile.fromFilePath(path);
const [tree, terr] = await file.merkleTree();
if (terr) throw terr;
console.log("rootHash", tree.rootHash());
const t0 = Date.now();
const [tx, err] = await indexer.upload(file, RPC, signer);
await file.close();
if (err) { console.error("upload error:", err); process.exit(1); }
console.log("uploaded", typeof tx === "string" ? tx : JSON.stringify(tx), "in", Math.round((Date.now() - t0) / 1000), "s");
