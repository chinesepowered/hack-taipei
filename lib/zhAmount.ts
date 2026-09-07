/**
 * Deterministic money-amount parsing from spoken Chinese, so the amount 阿嬤 said never depends on the
 * voice model's arithmetic ("十萬" must be 100,000, not whatever the model felt like passing).
 * Understands 一二三…九十百千萬億, 兩/两, 零, digit+萬 forms (30萬, 2.5萬, 3萬5), and money words 元/塊/块/圓/台幣/NT.
 * Returns the LAST money amount mentioned (the most recent thing said wins), or null.
 */
const DIG: Record<string, number> = { 零: 0, 〇: 0, 一: 1, 壹: 1, 二: 2, 兩: 2, 两: 2, 貳: 2, 三: 3, 參: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9 };
const UNIT: Record<string, number> = { 十: 10, 百: 100, 千: 1000, 萬: 10000, 万: 10000, 億: 100000000, 亿: 100000000 };

/** "三十萬" → 300000, "十五萬" → 150000, "一百二十萬" → 1200000, "三萬五" → 35000, "一千二" → 1200, "兩萬" → 20000 */
export function zhNumeral(s: string): number | null {
  if (!s) return null;
  let total = 0, section = 0, num = 0, lastUnit = 0, any = false;
  for (const ch of s) {
    if (ch in DIG) { num = DIG[ch]; any = true; continue; }
    if (ch in UNIT) {
      const u = UNIT[ch];
      any = true;
      if (u >= 10000) { section = (section + (num || (section === 0 && num === 0 ? 1 : 0))) * u; total += section; section = 0; num = 0; lastUnit = u; }
      else { section += (num || 1) * u; num = 0; lastUnit = u; }
      continue;
    }
    return null; // unexpected character inside a numeral
  }
  // trailing bare digit after a unit means the next smaller unit: 三萬五 → 35,000; 一千二 → 1,200; 兩百五 → 250
  if (num) section += lastUnit ? num * (lastUnit / 10) : num;
  total += section;
  return any ? total : null;
}

const NUM_CHARS = "零〇一壹二兩两貳三參四五六七八九十百千萬万億亿";
const MONEY = "(?:元|塊錢|块钱|塊|块|圓|台幣|新台幣|NT\\$?|USDC|USD)?";
const RE_ZH = new RegExp(`([${NUM_CHARS}]+)\\s*${MONEY}`, "g");
const RE_DIGIT = new RegExp(`(\\d[\\d,]*(?:\\.\\d+)?)\\s*(萬|万|千)?\\s*([${NUM_CHARS}])?\\s*${MONEY}`, "g");

export function parseZhAmounts(text: string): number[] {
  const out: { i: number; v: number }[] = [];
  let t = text ?? "";
  // Digit forms first ("30 萬", "2.5萬"); blank them out so the bare "萬" is not re-read as 一萬 by the numeral pass.
  for (const m of t.matchAll(RE_DIGIT)) {
    let v = Number(m[1].replace(/,/g, ""));
    if (!Number.isFinite(v)) continue;
    if (m[2] === "萬" || m[2] === "万") { v *= 10000; if (m[3] && m[3] in DIG) v += DIG[m[3]] * 1000; }
    else if (m[2] === "千") { v *= 1000; if (m[3] && m[3] in DIG) v += DIG[m[3]] * 100; }
    const hasMoneyWord = /(元|塊|块|圓|台幣|NT|USD)/.test(m[0]);
    if ((hasMoneyWord || m[2]) && v >= 1 && !/^\d{9,}$/.test(m[1])) {
      out.push({ i: m.index ?? 0, v });
      t = t.slice(0, m.index ?? 0) + " ".repeat(m[0].length) + t.slice((m.index ?? 0) + m[0].length);
    }
  }
  for (const m of t.matchAll(RE_ZH)) {
    const v = zhNumeral(m[1]);
    // a bare "十" or "一" with no money word is not an amount ("十點", "一下")
    const hasMoneyWord = m[0].length > m[1].length;
    if (v !== null && v >= 10 && (hasMoneyWord || /[萬万千百億亿]/.test(m[1]))) out.push({ i: m.index ?? 0, v });
  }
  return out.sort((a, b) => a.i - b.i).map((x) => x.v);
}

export function lastSpokenAmount(text: string): number | null {
  const all = parseZhAmounts(text);
  return all.length ? all[all.length - 1] : null;
}

/** Pick the amount of record: the spoken numeral wins when it clearly disagrees with what the model passed. */
export function reconcileAmount(modelAmount: number, spoken: string): { amount: number; note: string | null; corrected: boolean } {
  const heard = lastSpokenAmount(spoken);
  if (heard === null) return { amount: modelAmount, note: null, corrected: false };
  const disagree = !(modelAmount > 0) || Math.abs(heard - modelAmount) / Math.max(heard, modelAmount) > 0.2;
  if (!disagree) return { amount: modelAmount, note: null, corrected: false };
  return { amount: heard, note: `豆豆聽到的金額是 ${heard.toLocaleString()} 元（阿嬤說的話：「${spoken.slice(0, 40)}」），已以此為準。`, corrected: true };
}
