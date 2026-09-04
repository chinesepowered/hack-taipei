import { describe, expect, it } from "vitest";
import { ruleScore, runRules } from "./patterns";
import { resolveRecipient, pseudoAddress } from "../contacts";

describe("scam shield rules", () => {
  it("flags the classic grandson-in-trouble call", () => {
    const hits = runRules("我是你孫子，我出事了被抓了，今天一定要匯三十萬，先不要跟媽媽說");
    expect(hits[0].code).toBe("impersonate_family");
    const score = ruleScore(hits, { unknownRecipient: true, amountUsdc: 300000 });
    expect(score).toBeGreaterThanOrEqual(70);
  });

  it("flags fake prosecutor with custody account", () => {
    const hits = runRules("檢察官說我的帳戶涉案洗錢，要把錢轉到監管帳戶，而且要保密");
    expect(hits.map((h) => h.code)).toContain("impersonate_authority");
    expect(ruleScore(hits, { unknownRecipient: true, amountUsdc: 5000 })).toBeGreaterThanOrEqual(70);
  });

  it("lets a normal grocery payment through", () => {
    const hits = runRules("跟阿明買菜");
    expect(hits).toHaveLength(0);
    expect(ruleScore(hits, { unknownRecipient: false, amountUsdc: 20 })).toBeLessThan(40);
  });

  it("adds pressure for urgency and secrecy on their own", () => {
    const hits = runRules("現在就要，不要掛電話，不能跟別人說");
    expect(hits[0].code).toBe("urgency");
  });
});

describe("recipients", () => {
  it("resolves contacts by alias", () => {
    const r = resolveRecipient("賣菜的阿明");
    expect(r.name).toBe("阿明");
    expect(r.allowlisted).toBe(true);
    expect(r.address).toBe(pseudoAddress("阿明"));
  });

  it("gives unknown account numbers a stable pseudo-address", () => {
    const a = resolveRecipient("0912345678");
    const b = resolveRecipient("0912345678");
    expect(a.known).toBe(false);
    expect(a.address).toBe(b.address);
  });
});
