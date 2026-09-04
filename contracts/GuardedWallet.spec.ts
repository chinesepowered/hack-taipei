import { describe, expect, it } from "vitest";
import { createPublicClient, createWalletClient, fallback, http, parseUnits, type Address, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { baseSepolia } from "viem/chains";
import artifact from "../lib/chain/GuardedWallet.json" with { type: "json" };

/**
 * GuardedWallet state machine, exercised against a FRESH deployment on Base Sepolia (no Foundry in this environment).
 * Needs OWNER_PRIVATE_KEY (with test ETH), GUARDIAN1_PRIVATE_KEY, GUARDIAN2_PRIVATE_KEY in .env:
 *   pnpm test:chain
 * Skipped by plain `pnpm test`, so the default suite never touches the network.
 * Funding the fresh wallet with USDC is optional: the approve→execute test needs it and self-skips otherwise.
 */
const HAS_KEYS = !!(process.env.OWNER_PRIVATE_KEY && process.env.GUARDIAN1_PRIVATE_KEY && process.env.GUARDIAN2_PRIVATE_KEY);
const USDC = (process.env.NEXT_PUBLIC_USDC_ADDRESS ?? "0x036CbD53842c5426634e7929541eC2318f3dCF7e") as Address;
const RPCS = [process.env.BASE_SEPOLIA_RPC_URL ?? "https://sepolia.base.org", "https://base-sepolia-rpc.publicnode.com", "https://base-sepolia.drpc.org"];
const transport = () => fallback(RPCS.map((u) => http(u, { timeout: 15_000, retryCount: 1 })), { rank: false });
const abi = artifact.abi;

describe.skipIf(!HAS_KEYS)("GuardedWallet on Base Sepolia (fresh deploy)", () => {
  const pub = createPublicClient({ chain: baseSepolia, transport: transport() });
  const owner = createWalletClient({ account: privateKeyToAccount(process.env.OWNER_PRIVATE_KEY as Hex), chain: baseSepolia, transport: transport() });
  const g1 = createWalletClient({ account: privateKeyToAccount(process.env.GUARDIAN1_PRIVATE_KEY as Hex), chain: baseSepolia, transport: transport() });
  const g2 = createWalletClient({ account: privateKeyToAccount(process.env.GUARDIAN2_PRIVATE_KEY as Hex), chain: baseSepolia, transport: transport() });
  const stranger: Address = "0x000000000000000000000000000000000000dEaD";
  const grocer: Address = "0x00000000000000000000000000000000000000A1";
  let wallet: Address;

  const mined = async (hash: Hex) => {
    const r = await pub.waitForTransactionReceipt({ hash });
    expect(r.status).toBe("success");
    return r;
  };
  const read = (fn: string, args: unknown[] = []) => pub.readContract({ address: wallet, abi, functionName: fn, args }) as Promise<unknown>;
  const revertsWith = async (p: Promise<unknown>, name: string) => {
    await expect(p).rejects.toThrow(new RegExp(name));
  };

  it("deploys with two distinct guardians and a 2-of-2 threshold", async () => {
    const hash = await owner.deployContract({
      abi,
      bytecode: artifact.bytecode as Hex,
      args: [USDC, owner.account.address, [g1.account.address, g2.account.address], 2n, parseUnits("200", 6)],
    });
    const r = await mined(hash);
    wallet = r.contractAddress!;
    expect(await read("threshold")).toBe(2n);
    expect(await read("dailyLimit")).toBe(parseUnits("200", 6));
    expect(await read("owner")).toBe(owner.account.address);
  }, 120_000);

  it("only the owner can allowlist, and an allowlisted small payment is direct-payable", async () => {
    await revertsWith(g1.writeContract({ address: wallet, abi, functionName: "setAllowlist", args: [grocer, true] }), "NotOwner|NotGuardian|revert");
    await mined(await owner.writeContract({ address: wallet, abi, functionName: "setAllowlist", args: [grocer, true] }));
    expect(await read("canPayDirectly", [grocer, parseUnits("20", 6)])).toBe(true);
    expect(await read("canPayDirectly", [stranger, parseUnits("20", 6)])).toBe(false);
    expect(await read("canPayDirectly", [grocer, parseUnits("201", 6)])).toBe(false);
  }, 120_000);

  it("pay() to a stranger reverts GuardiansRequired", async () => {
    await revertsWith(owner.writeContract({ address: wallet, abi, functionName: "pay", args: [stranger, parseUnits("1", 6), "x"] }), "GuardiansRequired");
  }, 60_000);

  it("propose → one approval stays pending → same guardian again reverts AlreadyApproved", async () => {
    await mined(await owner.writeContract({ address: wallet, abi, functionName: "propose", args: [stranger, parseUnits("300", 6), "假冒孫子", 92] }));
    const id = (await read("proposalCount")) as bigint;
    expect(id).toBe(1n);
    await mined(await g1.writeContract({ address: wallet, abi, functionName: "approve", args: [0n] }));
    const p = (await read("getProposal", [0n])) as { approvals: bigint; status: number; riskScore: number };
    expect(p.approvals).toBe(1n);
    expect(p.status).toBe(0);
    expect(p.riskScore).toBe(92);
    await revertsWith(g1.writeContract({ address: wallet, abi, functionName: "approve", args: [0n] }), "AlreadyApproved");
  }, 180_000);

  it("a non-guardian cannot approve or reject", async () => {
    await revertsWith(owner.writeContract({ address: wallet, abi, functionName: "reject", args: [0n] }), "NotGuardian");
  }, 60_000);

  it("one guardian rejects, then approving a decided proposal reverts AlreadyDecided", async () => {
    await mined(await g2.writeContract({ address: wallet, abi, functionName: "reject", args: [0n] }));
    const p = (await read("getProposal", [0n])) as { status: number };
    expect(p.status).toBe(2);
    await revertsWith(g2.writeContract({ address: wallet, abi, functionName: "approve", args: [0n] }), "AlreadyDecided");
    await revertsWith(g1.writeContract({ address: wallet, abi, functionName: "reject", args: [0n] }), "AlreadyDecided");
  }, 180_000);

  it("second approval executes the proposal and moves USDC (needs the fresh wallet funded; self-skips otherwise)", async () => {
    const balance = (await read("balance")) as bigint;
    if (balance < parseUnits("1", 6)) {
      console.warn(`fresh wallet ${wallet} has no USDC; send some from https://faucet.circle.com to run the execute path`);
      return;
    }
    await mined(await owner.writeContract({ address: wallet, abi, functionName: "propose", args: [stranger, parseUnits("1", 6), "執行測試", 50] }));
    await mined(await g1.writeContract({ address: wallet, abi, functionName: "approve", args: [1n] }));
    await mined(await g2.writeContract({ address: wallet, abi, functionName: "approve", args: [1n] }));
    const p = (await read("getProposal", [1n])) as { status: number; approvals: bigint };
    expect(p.status).toBe(1);
    expect(p.approvals).toBe(2n);
    expect((await read("balance")) as bigint).toBe(balance - parseUnits("1", 6));
  }, 240_000);
});
