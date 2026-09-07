/**
 * 0G Storage for the stamps: the signed judgment lives outside our server, addressed by its Merkle root,
 * so anyone can fetch the exact bytes back from the network and re-verify. Testnet turbo indexer.
 */
import { Indexer, ZgFile } from "@0gfoundation/0g-storage-ts-sdk";
import { ethers } from "ethers";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const RPC = process.env.OG_RPC_URL ?? "https://evmrpc-testnet.0g.ai";
const INDEXER = process.env.OG_INDEXER ?? "https://indexer-storage-testnet-turbo.0g.ai";

export async function putJson(obj: unknown): Promise<{ rootHash: string; txHash: string | null }> {
  const pk = process.env.OWNER_PRIVATE_KEY;
  if (!pk) throw new Error("OWNER_PRIVATE_KEY is not set");
  const dir = mkdtempSync(join(tmpdir(), "og-put-"));
  const path = join(dir, "doc.json");
  writeFileSync(path, JSON.stringify(obj));
  const file = await ZgFile.fromFilePath(path);
  try {
    const [tree, terr] = await file.merkleTree();
    if (terr || !tree) throw terr ?? new Error("merkle tree failed");
    const rootHash = tree.rootHash() as string;
    const signer = new ethers.Wallet(pk, new ethers.JsonRpcProvider(RPC));
    const [tx, err] = await new Indexer(INDEXER).upload(file, RPC, signer);
    if (err) throw err;
    const txHash = typeof tx === "string" ? tx : ((tx as { txHash?: string })?.txHash ?? null);
    return { rootHash, txHash };
  } finally {
    await file.close().catch(() => {});
    rmSync(dir, { recursive: true, force: true });
  }
}

export async function getJson<T = unknown>(rootHash: string): Promise<T> {
  const dir = mkdtempSync(join(tmpdir(), "og-get-"));
  const path = join(dir, "doc.json");
  try {
    const err = await new Indexer(INDEXER).download(rootHash, path, true);
    if (err) throw err;
    return JSON.parse(readFileSync(path, "utf8")) as T;
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
