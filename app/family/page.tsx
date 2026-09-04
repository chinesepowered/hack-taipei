"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { captureDemoKey, demoHeaders } from "@/lib/demoClient";
import { toZh, type ZhError } from "@/lib/errors";

type Decision = { guardian: string; decision: "approve" | "reject"; hash: string; at: number };
type Proposal = {
  id: number;
  to: string;
  amountUsdc: string;
  memo: string;
  riskScore: number;
  approvals: number;
  status: "pending" | "executed" | "rejected";
  createdAt: number;
  meta: { recipientName: string; reason: string; callerClaims: string; explanation: string; pattern: string; decisions?: Decision[] } | null;
};
type Data = { proposals?: Proposal[]; guardians?: { index: number; name: string }[]; explorer?: string; wallet?: string; error?: string; detail?: string };

const STATUS_ZH = { pending: "等你決定", executed: "已付款", rejected: "已擋下" } as const;
const DEFAULT_GUARDIANS = [
  { index: 1, name: "媽媽" },
  { index: 2, name: "孫子小凱" },
];

export default function FamilyPage() {
  const [data, setData] = useState<Data | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [me, setMe] = useState(1);
  const [busy, setBusy] = useState<number | null>(null);
  const [err, setErr] = useState<ZhError | null>(null);

  async function load() {
    try {
      const d: Data = await fetch("/api/proposals").then((r) => r.json());
      setData(d);
    } catch (e) {
      setData({ error: toZh(e).text, detail: toZh(e).detail });
    } finally {
      setLoaded(true);
    }
  }

  useEffect(() => {
    captureDemoKey();
    load();
    const t = setInterval(load, 3000);
    return () => clearInterval(t);
  }, []);

  async function decide(id: number, decision: "approve" | "reject") {
    setBusy(id);
    setErr(null);
    try {
      const r = await fetch(`/api/proposals/${id}`, {
        method: "POST",
        headers: { "content-type": "application/json", ...demoHeaders() },
        body: JSON.stringify({ guardian: me, decision }),
      }).then((r) => r.json());
      if (r.error) setErr({ text: r.error, detail: r.detail });
      await load();
    } catch (e) {
      setErr(toZh(e));
    } finally {
      setBusy(null);
    }
  }

  // The API answers { error } on any chain hiccup. That must never take the page down on the judges' phone.
  const proposals = Array.isArray(data?.proposals) ? data!.proposals! : [];
  const guardians = data?.guardians?.length ? data.guardians : DEFAULT_GUARDIANS;
  const explorer = data?.explorer ?? "https://sepolia.basescan.org";
  const pending = proposals.filter((p) => p.status === "pending");
  const done = proposals.filter((p) => p.status !== "pending");
  const apiError = data?.error ? toZh(data.error) : null;

  return (
    <main className="shell">
      <div className="topbar">
        <div>
          <h1>家人共簽</h1>
          <div className="sub">阿嬤的錢包 · 豆豆攔下來的付款，由你決定</div>
        </div>
        <nav>
          <Link href="/">阿嬤頁面</Link>
          {data?.wallet && (
            <a href={`${explorer}/address/${data.wallet}`} target="_blank" rel="noreferrer">
              鏈上錢包
            </a>
          )}
        </nav>
      </div>

      <section className="card" style={{ marginBottom: 20 }}>
        <div className="persona">
          <span>我是：</span>
          {guardians.map((g) => (
            <button key={g.index} className={me === g.index ? "on" : ""} onClick={() => setMe(g.index)} aria-pressed={me === g.index}>
              {g.name}
            </button>
          ))}
          <span className="hint" style={{ marginLeft: "auto" }}>
            核准需要兩位家人，擋下只要一位。
          </span>
        </div>
        {err && (
          <div className="err" style={{ marginTop: 10 }} role="alert">
            {err.text}
            {err.detail && <small>{err.detail}</small>}
          </div>
        )}
        {apiError && (
          <div className="err" style={{ marginTop: 10 }} role="alert">
            {apiError.text}
            {apiError.detail && <small>{apiError.detail}</small>}
          </div>
        )}
        <div className="notice">
          Demo 說明：兩位家人的簽章是兩個獨立的鏈上地址、兩筆真的交易；為了現場穩定，金鑰暫時由伺服器代簽。正式版由家人自己的錢包或 passkey 簽。
        </div>
      </section>

      <section className="card" style={{ marginBottom: 20 }}>
        <h2>等待決定</h2>
        {!loaded && <div className="loading">讀取中…</div>}
        {loaded && pending.length === 0 && <div className="empty">目前沒有需要你決定的付款。</div>}
        {pending.map((p) => (
          <ProposalCard key={p.id} p={p} explorer={explorer} busy={busy === p.id} onDecide={decide} />
        ))}
      </section>

      <section className="card">
        <h2>紀錄</h2>
        {!loaded && <div className="loading">讀取中…</div>}
        {loaded && done.length === 0 && <div className="empty">還沒有紀錄。</div>}
        {done.map((p) => (
          <ProposalCard key={p.id} p={p} explorer={explorer} busy={false} onDecide={decide} />
        ))}
      </section>
    </main>
  );
}

function ProposalCard({ p, explorer, busy, onDecide }: { p: Proposal; explorer: string; busy: boolean; onDecide: (id: number, d: "approve" | "reject") => void }) {
  const who = p.meta?.recipientName || `${p.to.slice(0, 6)}…${p.to.slice(-4)}`;
  return (
    <div className={`proposal ${p.status}`}>
      <div className="row">
        <div>
          <span className="amt">{Number(p.amountUsdc).toLocaleString()} 元</span> <span className="to">給 {who}</span>
        </div>
        <span className={`badge ${p.status}`}>
          {STATUS_ZH[p.status]}
          {p.status === "pending" && ` · 已核准 ${p.approvals}/2`}
        </span>
      </div>
      <div className="why">
        <b>豆豆的判斷 · 風險 {p.riskScore}</b>
        {p.meta?.pattern && <> · {p.meta.pattern}</>}
        <div>{p.meta?.explanation || p.memo}</div>
      </div>
      {p.meta?.callerClaims && <div className="claims">來電者說：{p.meta.callerClaims}</div>}
      {p.meta?.reason && <div className="claims">阿嬤說：{p.meta.reason}</div>}
      {p.status === "pending" && (
        <div className="btns">
          <button className="no" disabled={busy} onClick={() => onDecide(p.id, "reject")}>
            {busy ? "處理中…" : "擋下"}
          </button>
          <button className="ok" disabled={busy} onClick={() => onDecide(p.id, "approve")}>
            {busy ? "處理中…" : "核准"}
          </button>
        </div>
      )}
      {p.meta?.decisions?.map((d, i) => (
        <div key={i} className="tx">
          {d.guardian} {d.decision === "approve" ? "核准" : "擋下"} ·{" "}
          <a href={`${explorer}/tx/${d.hash}`} target="_blank" rel="noreferrer">
            {d.hash.slice(0, 10)}…
          </a>
        </div>
      ))}
    </div>
  );
}
