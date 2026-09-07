import { describe, expect, it } from "vitest";
import { lastSpokenAmount, reconcileAmount, zhNumeral } from "./zhAmount";

describe("spoken Chinese amounts", () => {
  it("reads numerals", () => {
    expect(zhNumeral("十萬")).toBe(100000);
    expect(zhNumeral("三十萬")).toBe(300000);
    expect(zhNumeral("十五萬")).toBe(150000);
    expect(zhNumeral("一百二十萬")).toBe(1200000);
    expect(zhNumeral("兩萬")).toBe(20000);
    expect(zhNumeral("三萬五")).toBe(35000);
    expect(zhNumeral("一千二")).toBe(1200);
    expect(zhNumeral("二十")).toBe(20);
    expect(zhNumeral("一億")).toBe(100000000);
  });
  it("finds the last money amount in speech, simplified or traditional", () => {
    expect(lastSpokenAmount("我收到一个打过来的电话说他要十万块钱,帮我转给他。")).toBe(100000);
    expect(lastSpokenAmount("豆豆，幫我匯 30 萬給我孫子，他報的帳號是 0912345678")).toBe(300000);
    expect(lastSpokenAmount("幫我付 20 元給賣菜的阿明")).toBe(20);
    expect(lastSpokenAmount("先給他兩萬五，剩下的明天再說")).toBe(25000);
    expect(lastSpokenAmount("匯 2.5萬 過去")).toBe(25000);
    expect(lastSpokenAmount("他說十點會來")).toBeNull();
  });
  it("overrides the model when it disagrees with what was said", () => {
    expect(reconcileAmount(20000, "他要十万块钱,帮我转给他")).toMatchObject({ amount: 100000, corrected: true });
    expect(reconcileAmount(100000, "他要十萬元")).toMatchObject({ amount: 100000, corrected: false });
    expect(reconcileAmount(20, "幫我付 20 元給阿明")).toMatchObject({ amount: 20, corrected: false });
    expect(reconcileAmount(0, "匯三十萬")).toMatchObject({ amount: 300000, corrected: true });
    expect(reconcileAmount(500, "沒有講金額")).toMatchObject({ amount: 500, corrected: false });
  });
});
