/**
 * Fraud patterns distilled from the 165 anti-fraud hotline's public awareness material.
 * The rule layer runs first and never fails; the LLM layer refines the score and writes the explanation.
 */
export type Pattern = {
  code: string;
  name: string;
  weight: number;
  keywords: string[];
  tell: string;
};

export const PATTERNS: Pattern[] = [
  {
    code: "impersonate_family",
    name: "假冒親友（猜猜我是誰）",
    weight: 70,
    keywords: ["我是你孫子", "我是你兒子", "我是你女兒", "猜猜我是誰", "換號碼", "出事了", "被抓", "保釋", "車禍", "住院", "急用", "先不要跟", "不要告訴"],
    tell: "親友突然換號碼、出事急需用錢、要求先不要告訴其他家人",
  },
  {
    code: "impersonate_authority",
    name: "假冒檢警／公務機關",
    weight: 80,
    keywords: ["檢察官", "警察", "刑警", "地檢署", "法院", "涉案", "洗錢", "帳戶被凍結", "監管帳戶", "保密", "偵查不公開", "公文", "健保卡", "健保局"],
    tell: "自稱檢警、說帳戶涉案要把錢轉到「監管帳戶」、要求保密",
  },
  {
    code: "fake_investment",
    name: "假投資",
    weight: 65,
    keywords: ["投資", "穩賺", "保證獲利", "老師", "群組", "飆股", "虛擬貨幣", "入金", "出金", "內線", "翻倍"],
    tell: "群組老師、保證獲利、要先入金才能出金",
  },
  {
    code: "fake_refund_atm",
    name: "解除分期付款／ATM 操作",
    weight: 75,
    keywords: ["分期付款", "解除", "重複扣款", "設定錯誤", "ATM", "操作", "客服", "退款", "驗證碼", "序號"],
    tell: "說系統設定錯誤要去 ATM 操作解除、要求提供驗證碼",
  },
  {
    code: "impersonate_bank",
    name: "假冒銀行／客服",
    weight: 60,
    keywords: ["銀行", "客服", "帳號異常", "升級", "身分驗證", "密碼", "提款卡", "轉到安全帳戶"],
    tell: "要求把錢轉到「安全帳戶」或提供密碼",
  },
  {
    code: "fake_prize",
    name: "假中獎／假退稅",
    weight: 55,
    keywords: ["中獎", "退稅", "補助", "領取", "手續費", "稅金", "先匯"],
    tell: "要先付手續費或稅金才能領獎",
  },
  {
    code: "romance",
    name: "假交友／感情詐騙",
    weight: 60,
    keywords: ["網友", "男朋友", "女朋友", "軍官", "工程師", "海關", "包裹", "卡在", "運費", "結婚"],
    tell: "沒見過面的網友要錢、包裹卡海關要付費",
  },
  {
    code: "urgency",
    name: "催促與保密",
    weight: 35,
    keywords: ["今天一定", "馬上", "立刻", "現在就", "來不及", "不要掛電話", "不能跟別人說", "不要報警", "只有你能"],
    tell: "用時間壓力與保密要求讓人來不及查證",
  },
  {
    code: "unknown_recipient",
    name: "不明收款帳戶",
    weight: 30,
    keywords: [],
    tell: "收款人不在常用名單內",
  },
];

export type RuleHit = { code: string; name: string; weight: number; matched: string[] };

export function runRules(text: string): RuleHit[] {
  const hits: RuleHit[] = [];
  for (const p of PATTERNS) {
    const matched = p.keywords.filter((k) => text.includes(k));
    if (matched.length) hits.push({ code: p.code, name: p.name, weight: p.weight, matched });
  }
  return hits.sort((a, b) => b.weight - a.weight);
}

/** Combine rule hits into a 0-100 score. Strongest hit sets the floor, extra hits add a little. */
export function ruleScore(hits: RuleHit[], extra: { unknownRecipient: boolean; amountUsdc: number }): number {
  let score = hits.length ? hits[0].weight : 0;
  for (const h of hits.slice(1)) score += Math.min(15, h.weight / 4);
  if (extra.unknownRecipient) score += 20;
  if (extra.amountUsdc >= 100) score += 10;
  if (extra.amountUsdc >= 1000) score += 10;
  return Math.max(0, Math.min(100, Math.round(score)));
}
