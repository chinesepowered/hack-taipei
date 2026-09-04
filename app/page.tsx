"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Beagle } from "@/components/Beagle";
import { RiskMeter } from "@/components/RiskMeter";
import { RealtimeSession, type AgentState, type TranscriptLine } from "@/lib/realtime/client";

type Wallet = { balance_usdc: string; daily_limit_usdc: string; remaining_today_usdc: string; explorer: string; error?: string };
type Action = { kind: "paid" | "needs_family" | "executed" | "rejected" | "error"; text: string; url?: string };

const STATE_TEXT: Record<AgentState, string> = {
  idle: "按下按鈕，跟豆豆說話",
  connecting: "豆豆醒來中…",
  listening: "豆豆在聽",
  thinking: "豆豆在想",
  speaking: "豆豆在說話",
  worried: "豆豆覺得怪怪的",
  happy: "豆豆很開心",
};

export default function AhmaPage() {
  const [state, setState] = useState<AgentState>("idle");
  const [lines, setLines] = useState<TranscriptLine[]>([]);
  const [risk, setRisk] = useState<{ score: number | null; pattern?: string; explanation?: string }>({ score: null });
  const [action, setAction] = useState<Action | null>(null);
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [error, setError] = useState("");
  const session = useRef<RealtimeSession | null>(null);
  const bottom = useRef<HTMLDivElement>(null);

  async function loadWallet() {
    try {
      setWallet(await fetch("/api/wallet/balance").then((r) => r.json()));
    } catch {
      /* ignore */
    }
  }

  useEffect(() => {
    loadWallet();
    const t = setInterval(loadWallet, 8000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: "smooth" });
  }, [lines]);

  async function start() {
    setError("");
    setRisk({ score: null });
    setAction(null);
    const s = new RealtimeSession({
      onState: setState,
      onTranscript: (l) => setLines((prev) => [...prev, l]),
      onAssessment: (a) => setRisk({ score: a.risk_score, pattern: a.pattern, explanation: a.explanation_zh }),
      onPayment: (p) => {
        const status = String(p.status);
        if (status === "paid") setAction({ kind: "paid", text: `已付 ${p.amount_usdc} 元給${p.recipient}`, url: String(p.url) });
        else if (status === "needs_family") setAction({ kind: "needs_family", text: `給${p.recipient}的 ${p.amount_usdc} 元已交給家人決定（提案 #${p.proposal_id}）`, url: String(p.url) });
        else if (status === "executed") setAction({ kind: "executed", text: `家人核准了，${p.amountUsdc} 元已付出去`, url: undefined });
        else if (status === "rejected") setAction({ kind: "rejected", text: `家人擋下了這筆 ${p.amountUsdc} 元，錢沒有動`, url: undefined });
        else if (status === "error") setAction({ kind: "error", text: `出錯了：${p.error}` });
        loadWallet();
      },
      onError: (m) => setError(m),
    });
    session.current = s;
    try {
      await s.connect();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setState("idle");
    }
  }

  function stop() {
    session.current?.disconnect();
    session.current = null;
  }

  const live = state !== "idle";

  return (
    <main className="shell">
      <div className="topbar">
        <div>
          <h1>阿嬤的錢包</h1>
          <div className="sub">會對詐騙說「不」的錢包助理 · 豆豆</div>
        </div>
        <nav>
          <Link href="/family">家人頁面</Link>
          {wallet?.explorer && (
            <a href={wallet.explorer} target="_blank" rel="noreferrer">
              鏈上錢包
            </a>
          )}
        </nav>
      </div>

      <div className="grid">
        <section className="card stage">
          <Beagle state={state} />
          <div className="name">豆豆</div>
          <div className="state">{STATE_TEXT[state]}</div>
          {live ? (
            <button className="bigbtn stop" onClick={stop}>
              豆豆休息
            </button>
          ) : (
            <button className="bigbtn" onClick={start}>
              跟豆豆說話
            </button>
          )}
          <div className="hint">開擴音，讓豆豆一起聽電話。</div>
          {error && <div className="err">{error}</div>}
        </section>

        <div style={{ display: "grid", gap: 20 }}>
          <section className="card">
            <h2>錢包</h2>
            {wallet && !wallet.error ? (
              <div className="wallet">
                <div>
                  <b>{Number(wallet.balance_usdc).toLocaleString()}</b>
                  <span>餘額（元）</span>
                </div>
                <div>
                  <b>{Number(wallet.remaining_today_usdc).toLocaleString()}</b>
                  <span>今天還能直接付</span>
                </div>
                <div>
                  <b>{Number(wallet.daily_limit_usdc).toLocaleString()}</b>
                  <span>每日額度</span>
                </div>
              </div>
            ) : (
              <div className="hint">{wallet?.error ?? "讀取中…"}</div>
            )}
          </section>

          <section className="card">
            <h2>豆豆的判斷</h2>
            <RiskMeter score={risk.score} pattern={risk.pattern} explanation={risk.explanation} />
            {action && (
              <div className={`action ${action.kind === "paid" || action.kind === "executed" ? "paid" : action.kind === "rejected" ? "blocked" : ""}`} style={{ marginTop: 14 }}>
                {action.text}
                {action.url && (
                  <>
                    {" "}
                    <a href={action.url} target="_blank" rel="noreferrer">
                      看鏈上紀錄
                    </a>
                  </>
                )}
              </div>
            )}
          </section>
        </div>
      </div>

      <section className="card" style={{ marginTop: 20 }}>
        <h2>對話</h2>
        <div className="transcript">
          {lines.length === 0 && <div className="hint">還沒有對話。</div>}
          {lines.map((l, i) => (
            <div key={i} className={`line ${l.role}`}>
              {l.role !== "system" && <small>{l.role === "ahma" ? "阿嬤／電話" : "豆豆"}</small>}
              {l.text}
            </div>
          ))}
          <div ref={bottom} />
        </div>
      </section>
    </main>
  );
}
