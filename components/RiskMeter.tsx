"use client";

export function RiskMeter({ score, pattern, explanation }: { score: number | null; pattern?: string; explanation?: string }) {
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
    </div>
  );
}
