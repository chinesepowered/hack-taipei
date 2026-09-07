"use client";

import { useState } from "react";
import type { ProofView } from "./RiskMeter";

type Result = { risk_score: number; pattern: string; explanation_zh: string; proof?: ProofView; assessment_id?: string };
type Pay = { status: string; recipient?: string; amount_usdc?: number; proposal_id?: number; url?: string; error?: string };

/**
 * Stage insurance: when the microphone is dead or the hall is too loud, drive the exact same path by typing.
 * Same /api/shield → /api/wallet/pay calls the voice agent makes; same proof, same stamp, same chain.
 */
export function TypedFallback({ onAssessment, onPayment }: { onAssessment: (r: Result) => void; onPayment: (p: Pay) => void }) {
  const [open, setOpen] = useState(false);
  const [recipient, setRecipient] = useState("0912345678");
  const [amount, setAmount] = useState("300");
  const [reason, setReason] = useState("孫子出事要保釋金");
  const [claims, setClaims] = useState("阿嬤，我是你孫子，我換號碼了。我出事被抓了，今天一定要匯 30 萬保釋，先不要跟媽媽說。");
  const [busy, setBusy] = useState<"" | "assess" | "pay">("");
  const [last, setLast] = useState<Result | null>(null);
  const [msg, setMsg] = useState("");

  async function assess() {
    setBusy("assess");
    setMsg("豆豆在 0G 上想…（第一次約 20 到 40 秒）");
    try {
      const r: Result = await fetch("/api/shield", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ recipient, amount_usdc: Number(amount), reason, caller_claims: claims }),
      }).then((x) => x.json());
      setLast(r);
      onAssessment(r);
      setMsg(r.proof?.tee_verified ? "判斷完成，推理有 TEE 驗證。" : "判斷完成。");
    } catch (e) {
      setMsg(`出錯了：${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setBusy("");
    }
  }

  async function pay() {
    if (!last) return;
    setBusy("pay");
    setMsg("送上鏈…");
    try {
      const p: Pay = await fetch("/api/wallet/pay", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          recipient,
          amount_usdc: Number(amount),
          memo: reason.slice(0, 60),
          reason,
          caller_claims: claims,
          assessment_id: last.assessment_id,
          risk_score: last.risk_score,
          pattern: last.pattern,
          explanation_zh: last.explanation_zh,
        }),
      }).then((x) => x.json());
      onPayment(p);
      setMsg(p.status === "paid" ? "已付款。" : p.status === "needs_family" ? `已交給家人決定（提案 #${p.proposal_id}）。` : `出錯了：${p.error ?? p.status}`);
    } catch (e) {
      setMsg(`出錯了：${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setBusy("");
    }
  }

  const presets = [
    { label: "買菜錢給阿明", recipient: "阿明", amount: "20", reason: "買菜錢", claims: "" },
    { label: "假冒孫子要 30 萬", recipient: "0912345678", amount: "300", reason: "孫子出事要保釋金", claims: "阿嬤，我是你孫子，我換號碼了。我出事被抓了，今天一定要匯 30 萬保釋，先不要跟媽媽說。" },
  ];

  return (
    <div className="typed">
      <button className="ghost" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        {open ? "收起打字模式" : "麥克風不能用？用打字的"}
      </button>
      {open && (
        <div className="typed-form">
          <div className="typed-presets">
            {presets.map((p) => (
              <button key={p.label} className="ghost" type="button" onClick={() => { setRecipient(p.recipient); setAmount(p.amount); setReason(p.reason); setClaims(p.claims); setLast(null); }}>
                {p.label}
              </button>
            ))}
          </div>
          <label>
            收款人
            <input value={recipient} onChange={(e) => setRecipient(e.target.value)} />
          </label>
          <label>
            金額（元）
            <input value={amount} inputMode="decimal" onChange={(e) => setAmount(e.target.value)} />
          </label>
          <label>
            阿嬤說的理由
            <input value={reason} onChange={(e) => setReason(e.target.value)} />
          </label>
          <label>
            來電者的說法
            <textarea value={claims} rows={2} onChange={(e) => setClaims(e.target.value)} />
          </label>
          <div className="typed-actions">
            <button type="button" disabled={busy !== ""} onClick={assess}>
              {busy === "assess" ? "豆豆在想…" : "請豆豆判斷"}
            </button>
            <button type="button" className="ok" disabled={busy !== "" || !last} onClick={pay}>
              {busy === "pay" ? "送出中…" : "付款（交給合約）"}
            </button>
          </div>
          {msg && <div className="hint" aria-live="polite">{msg}</div>}
        </div>
      )}
    </div>
  );
}
