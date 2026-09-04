/**
 * One place that turns raw viem / OpenAI / browser errors into a sentence Ah-ma (or a judge) can read.
 * The original message is kept as `detail` so nothing is hidden, it is just not the headline.
 */
export type ZhError = { text: string; detail?: string };

const DETERMINISTIC = /AlreadyDecided|AlreadyApproved|NotGuardian|NotOwner|GuardiansRequired|TransferFailed|BadConfig|transfer amount exceeds balance|insufficient funds/i;

/** A revert that will not change on retry. Retrying it only buys 15 seconds of silence. */
export function isDeterministicRevert(msg: string): boolean {
  return DETERMINISTIC.test(msg);
}

export function toZh(raw: unknown): ZhError {
  const msg = raw instanceof Error ? raw.message : String(raw ?? "");
  const first = msg.split("\n")[0].slice(0, 200);
  const has = (re: RegExp) => re.test(msg);

  if (has(/NotAllowedError|Permission denied|permission dismissed/i)) return { text: "麥克風被擋住了。請按網址列左邊的鎖頭，允許使用麥克風，再按一次。", detail: first };
  if (has(/mediaDevices|getUserMedia/i)) return { text: "這個網址開不了麥克風。請用 localhost 或 https 開阿嬤頁面。", detail: first };
  if (has(/OPENAI_API_KEY is not set|no client secret/i)) return { text: "豆豆現在連不上（伺服器沒有設定語音金鑰）。", detail: first };
  if (has(/realtime call failed|openai \d{3}/i)) return { text: "豆豆現在連不上，請等幾秒再按一次。", detail: first };
  if (has(/AlreadyDecided|AlreadyApproved/)) return { text: "這筆已經有人決定過了。", detail: first };
  if (has(/NotGuardian/)) return { text: "只有家人可以做這個決定。", detail: first };
  if (has(/GuardiansRequired/)) return { text: "這筆要家人一起看，不能直接付。", detail: first };
  if (has(/TransferFailed|transfer amount exceeds balance/i)) return { text: "錢包裡的錢不夠付這筆。", detail: first };
  if (has(/insufficient funds/i)) return { text: "錢包的手續費（測試 ETH）不夠了，請先補。", detail: first };
  if (has(/NEXT_PUBLIC_WALLET_ADDRESS/)) return { text: "還沒有設定錢包合約地址。", detail: first };
  if (has(/EROFS|read-only file system/i)) return { text: "交易已經上鏈，但伺服器暫時存不了說明文字。", detail: first };
  if (has(/timeout|timed out|ECONN|fetch failed|429|rate limit|Failed to fetch|network/i)) return { text: "鏈上連線暫時不通，幾秒後會自動再試。", detail: first };
  if (has(/demo key|DEMO_KEY|401|unauthorized/i)) return { text: "這個頁面需要 Demo 鑰匙：請用 ?key=… 重新開一次。", detail: first };
  return { text: "出了點問題，請再試一次。", detail: first };
}
