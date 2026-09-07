/** Map the errors a judge could trigger on stage to one plain-Chinese sentence; keep the raw text as detail. */
export function toZh(err: unknown): { message: string; detail: string } {
  const raw = err instanceof Error ? err.message : String(err);
  const first = raw.split("\n")[0];
  const rules: [RegExp, string][] = [
    [/AlreadyDecided/i, "這筆提案已經有人決定過了，不能再改。"],
    [/AlreadyApproved/i, "你已經核准過這筆了，等另一位家人。"],
    [/NotGuardian/i, "只有家人共簽人可以決定這筆付款。"],
    [/GuardiansRequired/i, "這筆超過額度或收款人不在白名單，要家人共簽才能付。"],
    [/TransferFailed|insufficient|exceeds balance/i, "錢包餘額不夠付這筆。"],
    [/NotOwner/i, "只有豆豆的金鑰可以發起付款。"],
    [/nonce too low|replacement transaction/i, "鏈上交易撞在一起了，請再按一次。"],
    [/receipt .* not found|timeout|timed out|ETIMEDOUT|fetch failed|ECONNRESET/i, "鏈上連線慢，請等幾秒再試。"],
    [/insufficient funds for gas|gas required exceeds/i, "這把金鑰的 0G 不夠付 gas。"],
    [/NEXT_PUBLIC_WALLET_ADDRESS is not set|not configured/i, "錢包還沒設定，先跑部署。"],
    [/OWNER_PRIVATE_KEY|GUARDIAN\d_PRIVATE_KEY/i, "缺少金鑰設定。"],
  ];
  for (const [re, zh] of rules) if (re.test(raw)) return { message: zh, detail: first };
  return { message: `出錯了：${first.slice(0, 120)}`, detail: first };
}
