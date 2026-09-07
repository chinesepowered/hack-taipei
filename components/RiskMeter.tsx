"use client";

export type ProofView = { provider: string; model: string; tee_verified: boolean | null; trust_mode?: string | null } | null | undefined;

export function ProofChip({ proof, stampId }: { proof: ProofView; stampId?: string | null }) {
  if (!proof) return null;
  const on0g = proof.provider === "0g";
  const tee = proof.tee_verified;
  const tone = on0g && tee ? "ok" : on0g ? "warn" : "muted";
  const label = on0g
    ? tee
      ? "推理在 0G 隔離環境完成 · TEE 已驗證"
      : tee === false
        ? "0G 推理 · 這次沒有拿到 TEE 驗證"
        : "0G 推理 · 等待驗證欄位"
    : `推理由 ${proof.provider} 完成 · 沒有硬體證明`;
  return (
    <div className={`proof-chip ${tone}`} title={`${proof.model}${proof.trust_mode ? ` · ${proof.trust_mode}` : ""}`}>
      <span className="dot" />
      {label}
      <small>{proof.model}</small>
      {stampId && <small>章 {stampId.slice(0, 10)}…</small>}
    </div>
  );
}

export function RiskMeter({ score, pattern, explanation, proof }: { score: number | null; pattern?: string; explanation?: string; proof?: ProofView }) {
  const s = score ?? 0;
  const level = score === null ? "等待中" : s >= 70 ? "很像詐騙" : s >= 40 ? "要問家人" : "看起來正常";
  const color = score === null ? "var(--muted)" : s >= 70 ? "var(--red)" : s >= 40 ? "var(--amber)" : "var(--green)";
  return (
    <div className="risk">
      <div className="risk-head">
        <span>詐騙風險</span>
        <b style={{ color }}>
          {score === null ? "—" : s} · {level}
        </b>
      </div>
      <div className="risk-bar">
        <div className="risk-fill" style={{ width: `${s}%`, background: color }} />
      </div>
      {pattern && score !== null && s >= 40 && <div className="risk-pattern">命中手法：{pattern}</div>}
      {explanation && <div className="risk-explain">{explanation}</div>}
      {score !== null && <ProofChip proof={proof} />}
    </div>
  );
}
