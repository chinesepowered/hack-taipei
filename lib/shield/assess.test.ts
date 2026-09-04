import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { assessPayment } from "./assess";
import { ruleScore, runRules } from "./patterns";

/**
 * The headline resilience claim: when the model is unavailable the Scam Shield still answers from the rules layer.
 * These run without any key, so `pnpm test` never touches the network.
 */
describe("assessPayment without a model", () => {
  const saved = { ...process.env };
  beforeEach(() => {
    delete process.env.OPENAI_API_KEY;
    delete process.env.SHIELD_API_KEY;
  });
  afterEach(() => {
    process.env = { ...saved };
  });

  it("falls back to the rules layer and still pauses the grandson call", async () => {
    const a = await assessPayment({
      recipient: "0912345678",
      amount_usdc: 300000,
      reason: "匯給我孫子",
      caller_claims: "我是你孫子，我出事了被抓了，今天一定要匯三十萬，先不要跟媽媽說",
      recipient_known: false,
      recipient_allowlisted: false,
    });
    expect(a.source).toBe("rules");
    expect(a.risk_score).toBeGreaterThanOrEqual(70);
    expect(a.recommended_action).toBe("block");
    expect(a.pattern_code).toBe("impersonate_family");
    expect(a.explanation_zh).toMatch(/暫停/);
  });

  it("lets the grocery payment through with a plain explanation", async () => {
    const a = await assessPayment({ recipient: "阿明", amount_usdc: 20, reason: "買菜", caller_claims: "", recipient_known: true, recipient_allowlisted: true });
    expect(a.source).toBe("rules");
    expect(a.risk_score).toBeLessThan(40);
    expect(a.recommended_action).toBe("pay");
  });

  it("rejects malformed input instead of guessing", async () => {
    await expect(assessPayment({ amount_usdc: -5 })).rejects.toThrow();
  });
});

describe("server-side risk floor (what /api/wallet/pay enforces)", () => {
  it("a forged risk_score of 0 cannot make a scam story pay directly", () => {
    const story = "匯給我孫子 我是你孫子，我出事了被抓了，今天一定要匯三十萬，先不要跟媽媽說 0912345678";
    const floor = ruleScore(runRules(story), { unknownRecipient: true, amountUsdc: 300000 });
    expect(Math.max(0, floor)).toBeGreaterThanOrEqual(70);
  });
  it("an honest grocery story keeps a low floor", () => {
    const floor = ruleScore(runRules("買菜  阿明"), { unknownRecipient: false, amountUsdc: 20 });
    expect(floor).toBeLessThan(40);
  });
});
