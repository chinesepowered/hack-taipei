"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Beagle } from "@/components/Beagle";
import { RiskMeter } from "@/components/RiskMeter";
import { RealtimeSession, type AgentState, type TranscriptLine, type TurnMode } from "@/lib/realtime/client";
import { captureDemoKey, demoHeaders } from "@/lib/demoClient";
import { toZh, type ZhError } from "@/lib/errors";

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
  const [mode, setMode] = useState<TurnMode>("ptt");
  const [holding, setHolding] = useState(false);
  const [lines, setLines] = useState<TranscriptLine[]>([]);
  const [risk, setRisk] = useState<{ score: number | null; pattern?: string; explanation?: string }>({ score: null });
  const [action, setAction] = useState<Action | null>(null);
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [error, setError] = useState<ZhError | null>(null);
  const [typing, setTyping] = useState(false);
  const [typed, setTyped] = useState({ recipient: "", amount: "", story: "" });
  const [sending, setSending] = useState(false);
  const session = useRef<RealtimeSession | null>(null);
  const bottom = useRef<HTMLDivElement>(null);
  const watcher = useRef<ReturnType<typeof setInterval> | null>(null);

  async function loadWallet() {
    try {
      setWallet(await fetch("/api/wallet/balance").then((r) => r.json()));
    } catch {
      /* ignore */
    }
  }

  useEffect(() => {
    captureDemoKey();
    loadWallet();
    const t = setInterval(loadWallet, 8000);
    try {
      const saved = localStorage.getItem("doudou-mode");
      if (saved === "auto" || saved === "ptt") setMode(saved);
    } catch {
      /* ignore */
    }
    return () => {
      clearInterval(t);
      if (watcher.current) clearInterval(watcher.current);
    };
  }, []);

  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: "smooth" });
  }, [lines]);

  function applyPayment(p: Record<string, unknown>) {
    const status = String(p.status);
    if (status === "paid") setAction({ kind: "paid", text: `已付 ${p.amount_usdc} 元給${p.recipient}`, url: String(p.url) });
    else if (status === "needs_family") setAction({ kind: "needs_family", text: `給${p.recipient}的 ${p.amount_usdc} 元已交給家人決定（提案 #${p.proposal_id}）`, url: String(p.url) });
    else if (status === "executed") setAction({ kind: "executed", text: `家人核准了，${p.amountUsdc} 元已付出去` });
    else if (status === "rejected") setAction({ kind: "rejected", text: `家人擋下了這筆 ${p.amountUsdc} 元，錢沒有動` });
    else if (status === "error") setAction({ kind: "error", text: `${p.error ?? "出了點問題，請再試一次。"}` });
    loadWallet();
  }

  /** Typed fallback watches its own proposal; the voice session watches proposals it created itself. */
  function watchProposal(id: number) {
    if (watcher.current) clearInterval(watcher.current);
    watcher.current = setInterval(async () => {
      try {
        const p = await fetch(`/api/proposals/${id}`).then((r) => r.json());
        if (p.status === "executed" || p.status === "rejected") {
          if (watcher.current) clearInterval(watcher.current);
          watcher.current = null;
          const who = p.meta?.decisions?.at(-1)?.guardian ?? "家人";
          applyPayment({ ...p, status: p.status });
          setLines((prev) => [
            ...prev,
            { role: "doudou", text: p.status === "rejected" ? `${who}把那筆錢擋下來了，錢沒有動，阿嬤不用擔心。` : `${who}核准了，錢已經付出去了。`, at: Date.now() },
          ]);
        }
      } catch {
        /* retry next tick */
      }
    }, 3000);
  }

  /** The same Scam Shield → GuardedWallet path as the voice agent, driven by a form. For when voice fails on stage. */
  async function submitTyped(e: React.FormEvent) {
    e.preventDefault();
    const amount = Number(typed.amount);
    if (!typed.recipient.trim() || !(amount > 0)) {
      setError({ text: "請填收款人和金額。" });
      return;
    }
    setSending(true);
    setError(null);
    setAction(null);
    setLines((prev) => [...prev, { role: "ahma", text: `幫我付 ${amount} 元給${typed.recipient}。${typed.story ? ` 來電者說：${typed.story}` : ""}`, at: Date.now() }]);
    try {
      const a = await fetch("/api/shield", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ recipient: typed.recipient, amount_usdc: amount, reason: typed.story, caller_claims: typed.story }),
      }).then((r) => r.json());
      setRisk({ score: a.risk_score, pattern: a.pattern, explanation: a.explanation_zh });
      setLines((prev) => [...prev, { role: "doudou", text: `${a.explanation_zh} ${a.question_for_ahma ?? ""}`.trim(), at: Date.now() }]);
      const p = await fetch("/api/wallet/pay", {
        method: "POST",
        headers: { "content-type": "application/json", ...demoHeaders() },
        body: JSON.stringify({
          recipient: typed.recipient,
          amount_usdc: amount,
          reason: typed.story,
          caller_claims: typed.story,
          risk_score: a.risk_score,
          pattern: a.pattern,
          explanation_zh: a.explanation_zh,
          memo: typed.story.slice(0, 60),
        }),
      }).then((r) => r.json());
      applyPayment(p);
      if (p.status === "needs_family" && typeof p.proposal_id === "number") watchProposal(p.proposal_id);
      if (p.status === "error") setError({ text: String(p.error), detail: p.detail ? String(p.detail) : undefined });
    } catch (err) {
      setError(toZh(err));
    } finally {
      setSending(false);
    }
  }

  function pickMode(m: TurnMode) {
    setMode(m);
    try {
      localStorage.setItem("doudou-mode", m);
    } catch {
      /* ignore */
    }
  }

  async function start() {
    setError(null);
    setRisk({ score: null });
    setAction(null);
    setTyping(false);
    const s = new RealtimeSession(
      {
        onState: setState,
        onTranscript: (l) => setLines((prev) => [...prev, l]),
        onAssessment: (a) => setRisk({ score: a.risk_score, pattern: a.pattern, explanation: a.explanation_zh }),
        onPayment: applyPayment,
        onError: (m) => setError(toZh(m)),
      },
      mode,
    );
    session.current = s;
    try {
      await s.connect();
    } catch (e) {
      setError(toZh(e));
      setState("idle");
      session.current = null;
    }
  }

  function stop() {
    session.current?.disconnect();
    session.current = null;
    setHolding(false);
  }

  function holdStart(e: React.PointerEvent<HTMLButtonElement>) {
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    setHolding(true);
    session.current?.pttStart();
  }
  function holdEnd(e: React.PointerEvent<HTMLButtonElement>) {
    e.preventDefault();
    setHolding(false);
    session.current?.pttStop();
  }

  const live = state !== "idle";

  // 豆豆 used to be worried for under a second: the tool call set it, the next model event reset it.
  // Keep the concern on his face for as long as the risk is on the table, and let the family's decision resolve it.
  const resolved = action?.kind === "rejected" || action?.kind === "executed" || action?.kind === "paid";
  const concerned = risk.score !== null && risk.score >= 40 && !resolved;
  const shown: AgentState = !live ? state : concerned ? "worried" : action?.kind === "rejected" && state !== "speaking" ? "happy" : state;
  const stateText =
    mode === "ptt" && state === "listening" ? (holding ? "豆豆在聽" : "按住按鈕再說話") : concerned && state !== "speaking" ? STATE_TEXT.worried : STATE_TEXT[state];

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
          <Beagle state={shown} />
          <div className="name">豆豆</div>
          <div className="state" aria-live="polite">
            {stateText}
          </div>

          {!live && (
            <div className="modes">
              <button className={mode === "ptt" ? "on" : ""} onClick={() => pickMode("ptt")}>
                按住說話（吵雜環境）
              </button>
              <button className={mode === "auto" ? "on" : ""} onClick={() => pickMode("auto")}>
                自動聽（安靜環境）
              </button>
            </div>
          )}

          {live ? (
            <>
              {mode === "ptt" && (
                <button
                  className={`holdbtn ${holding ? "held" : ""}`}
                  onPointerDown={holdStart}
                  onPointerUp={holdEnd}
                  onPointerCancel={holdEnd}
                  onPointerLeave={(e) => holding && holdEnd(e)}
                  onContextMenu={(e) => e.preventDefault()}
                >
                  {holding ? "放開就送出" : "按住跟豆豆說話"}
                </button>
              )}
              <button className="bigbtn stop" onClick={stop}>
                豆豆休息
              </button>
            </>
          ) : (
            <button className="bigbtn" onClick={start}>
              跟豆豆說話
            </button>
          )}
          <div className="hint">{mode === "ptt" ? "按住按鈕講話，放開後豆豆才回答。開擴音時也按住讓豆豆聽電話。" : "開擴音，讓豆豆一起聽電話。"}</div>
          {!live && !typing && (
            <button className="linkbtn" onClick={() => setTyping(true)}>
              麥克風不能用？用打字的
            </button>
          )}
          {typing && !live && (
            <form className="typed" onSubmit={submitTyped}>
              <input value={typed.recipient} onChange={(e) => setTyped({ ...typed, recipient: e.target.value })} placeholder="付給誰（例如：阿明、0912345678）" aria-label="收款人" />
              <div className="row2">
                <input value={typed.amount} onChange={(e) => setTyped({ ...typed, amount: e.target.value })} placeholder="金額（元）" inputMode="decimal" aria-label="金額" />
                <button type="submit" disabled={sending}>
                  {sending ? "豆豆在查…" : "請豆豆處理"}
                </button>
              </div>
              <input value={typed.story} onChange={(e) => setTyped({ ...typed, story: e.target.value })} placeholder="來電者說了什麼（例如：我是你孫子，我出事了）" aria-label="來電者的說法" />
            </form>
          )}
          {action?.kind === "needs_family" && (
            <div className="waiting" aria-live="polite">
              <span className="dot" />
              已通知家人，等他們回覆…
            </div>
          )}
          {error && (
            <div className="err" role="alert">
              {error.text}
              {error.detail && <small>{error.detail}</small>}
            </div>
          )}
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
              <div className="hint">{wallet?.error ? "鏈上連線暫時不通，幾秒後會自動再試。" : "讀取中…"}</div>
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
