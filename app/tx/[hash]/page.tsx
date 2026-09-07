"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";

type Tx = { found: boolean; hash: string; status?: "success" | "reverted"; block?: string; at?: number | null; from?: string; to?: string; wallet?: string; gasUsed?: string; events?: { name: string; args: Record<string, string> }[]; explorer: string; error?: string };

const STATUS_ZH = { 0: "等家人決定", 1: "已付款", 2: "已擋下" } as const;

function describe(e: { name: string; args: Record<string, string> }): string {
  const a = e.args;
  switch (e.name) {
    case "ProposalCreated":
      return `豆豆把 ${Number(a.amount_usdc).toLocaleString()} 元的付款交給家人決定（提案 #${a.id}，風險 ${a.riskScore}）。備註：${a.memo}`;
    case "ProposalRejected":
      return `家人擋下了提案 #${a.id}，錢沒有動。`;
    case "ProposalApproved":
      return `一位家人核准了提案 #${a.id}（已核准 ${a.approvals}/2）。`;
    case "ProposalExecuted":
      return `兩位家人都核准，提案 #${a.id} 已付款。`;
    case "PaymentExecuted":
      return `直接付款 ${Number(a.amount_usdc).toLocaleString()} 元（白名單、額度內）。備註：${a.memo}`;
    case "Transfer":
      return `${Number(a.value_usdc ?? 0).toLocaleString()} USDC 從 ${a.from?.slice(0, 8)}… 轉到 ${a.to?.slice(0, 8)}…`;
    case "AllowlistUpdated":
      return `白名單更新：${a.who ?? a[Object.keys(a)[0]]}`;
    default:
      return e.name;
  }
}

export default function TxPage() {
  const { hash } = useParams<{ hash: string }>();
  const [tx, setTx] = useState<Tx | null>(null);
  const [tries, setTries] = useState(0);

  useEffect(() => {
    let alive = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    async function load() {
      try {
        const d: Tx = await fetch(`/api/tx/${hash}`).then((r) => r.json());
        if (!alive) return;
        setTx(d);
        if (!d.found && !d.error && tries < 40) {
          setTries((t) => t + 1);
          timer = setTimeout(load, 2000);
        }
      } catch {
        if (alive) timer = setTimeout(load, 3000);
      }
    }
    load();
    return () => {
      alive = false;
      if (timer) clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hash]);

  const when = tx?.at ? new Date(tx.at).toLocaleTimeString("zh-TW", { hour: "2-digit", minute: "2-digit", second: "2-digit" }) : null;

  return (
    <main className="shell">
      <div className="topbar">
        <div>
          <h1>鏈上紀錄</h1>
          <div className="sub">0G Galileo · 直接從鏈上讀回來，不經過任何人</div>
        </div>
        <nav>
          <Link href="/">阿嬤頁面</Link>
          <Link href="/family">家人頁面</Link>
        </nav>
      </div>

      <section className="card">
        {!tx && <div className="hint">讀取中…</div>}
        {tx?.error && <div className="err">{tx.error}</div>}
        {tx && !tx.found && !tx.error && <div className="hint">交易還在等區塊確認…（{tries} 次查詢）</div>}
        {tx?.found && (
          <>
            <div className={`badge ${tx.status === "success" ? "executed" : "rejected"}`} style={{ fontSize: "1.1rem" }}>
              {tx.status === "success" ? "✓ 已上鏈" : "✗ 交易失敗（revert）"}
            </div>
            <ul className="txlist">
              {(tx.events ?? []).map((e, i) => (
                <li key={i} className="txevent">
                  <b>{e.name}</b>
                  <div>{describe(e)}</div>
                </li>
              ))}
              {(tx.events ?? []).length === 0 && <li className="hint">這筆交易沒有可解讀的事件。</li>}
            </ul>
            <dl className="txmeta">
              <dt>時間</dt>
              <dd>{when ?? "—"}</dd>
              <dt>區塊</dt>
              <dd>{tx.block}</dd>
              <dt>合約</dt>
              <dd className="mono">{tx.to}</dd>
              <dt>發送者</dt>
              <dd className="mono">{tx.from}</dd>
              <dt>Hash</dt>
              <dd className="mono">{tx.hash}</dd>
            </dl>
          </>
        )}
        {tx && (
          <div className="hint" style={{ marginTop: 12 }}>
            <a href={tx.explorer} target="_blank" rel="noreferrer">
              在 0G ChainScan 打開 ↗
            </a>{" "}
            （官方瀏覽器有時載入很慢）
          </div>
        )}
      </section>
    </main>
  );
}

export { STATUS_ZH };
