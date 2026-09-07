import { describe, expect, it, beforeAll } from "vitest";
import { canonical, makeStamp, memoWithProof, verifyStamp, type InferenceProof } from "./stamp";

// A throwaway key. Never funded, never used anywhere else.
const TEST_KEY = "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d";
const OTHER_KEY = "0x8b3a350cf5c34c9194ca85829a2df0ec3153be0318b5e2d3348e872092edffba";

const proof: InferenceProof = {
  provider: "0g",
  model: "0gm-1.0-35b-a3b",
  request_hash: "0x" + "11".repeat(32) as `0x${string}`,
  response_hash: "0x" + "22".repeat(32) as `0x${string}`,
  tee_verified: true,
  trust_mode: "verified",
  response_id: "chatcmpl-test",
  at: 1788800000000,
};

describe("agent proof stamp", () => {
  beforeAll(() => {
    process.env.OWNER_PRIVATE_KEY = TEST_KEY;
    process.env.AGENT_ID_TOKEN = "7";
    process.env.AGENT_ID_CONTRACT = "0x000000000000000000000000000000000000dEaD";
  });

  it("canonical JSON sorts keys and is stable", () => {
    expect(canonical({ b: 1, a: { d: [2, { z: 1, y: 2 }], c: null } })).toBe('{"a":{"c":null,"d":[2,{"y":2,"z":1}]},"b":1}');
  });

  it("signs a judgment and verifies it offline", async () => {
    const s = await makeStamp({ proof, score: 92, pattern_code: "impersonate_family", action: "ask_family" });
    expect(s).not.toBeNull();
    const v = await verifyStamp(s!.stamp);
    expect(v.ok).toBe(true);
    expect(v.signer?.toLowerCase()).toBe(s!.signer.toLowerCase());
    expect(v.payload?.score).toBe(92);
    expect(v.payload?.tee_verified).toBe(true);
    expect(v.payload?.agent_id_token).toBe("7");
    expect(v.id).toBe(s!.id);
  });

  it("rejects a stamp whose score was edited after signing", async () => {
    const s = await makeStamp({ proof, score: 92, pattern_code: "impersonate_family", action: "ask_family" });
    const [body, sig] = s!.stamp.split(".");
    const edited = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    edited.score = 5;
    const forged = `${Buffer.from(canonical(edited), "utf8").toString("base64url")}.${sig}`;
    const v = await verifyStamp(forged);
    expect(v.ok).toBe(false);
  });

  it("rejects a stamp signed by a different key claiming to be 豆豆", async () => {
    const s = await makeStamp({ proof, score: 92, pattern_code: "impersonate_family", action: "ask_family" });
    process.env.OWNER_PRIVATE_KEY = OTHER_KEY;
    const other = await makeStamp({ proof, score: 92, pattern_code: "impersonate_family", action: "ask_family" });
    process.env.OWNER_PRIVATE_KEY = TEST_KEY;
    const v = await verifyStamp(other!.stamp, s!.signer);
    expect(v.ok).toBe(false);
    expect(v.reason).toMatch(/不是預期的 agent/);
  });

  it("puts a short proof handle at the front of the on-chain memo, within 120 chars", () => {
    const m = memoWithProof("假冒孫子，要匯 30 萬保釋", "0x" + "ab".repeat(32) as `0x${string}`);
    expect(m.startsWith("proof:0xabababababababab")).toBe(true);
    expect(m.length).toBeLessThanOrEqual(120);
    expect(memoWithProof("x".repeat(300), null).length).toBe(120);
  });
});
