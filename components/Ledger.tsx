"use client";

import { useEffect, useRef, useState } from "react";

export type Entry = { key: string; kind: "paid" | "pending" | "executed" | "rejected"; amount_usdc: number; recipient: string; at: number; by?: string; proposal_id?: number; url?: string; risk?: number };

const LABEL: Record<Entry["kind"], string> = { paid: "已付", pending: "等家人決定", executed: "家人核准，已付", rejected: "家人擋下，錢沒動" };

function hhmm(t: number) {
  const d = new Date(t);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/**
 * 阿嬤's 收支紀錄 plus the notification that fires the moment the family decides.
 * Polls /api/ledger every 3 s, independent of the voice session, so it works after a reconnect or in typed mode.
 */
export function Ledger({ onChange }: { onChange?: (e: Entry) => void }) {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [notice, setNotice] = useState<{ text: string; tone: "good" | "bad" } | null>(null);
  const seen = useRef<Map<string, Entry["kind"]> | null>(null);

  useEffect(() => {
    let alive = true;
    async function tick() {
      try {
        const d = await fetch("/api/ledger").then((r) => r.json());
        if (!alive || !Array.isArray(d.entries)) return;
        const next: Entry[] = d.entries;
        if (seen.current) {
          for (const e of next) {
            const before = seen.current.get(e.key);
            if (before === "pending" && (e.kind === "executed" || e.kind === "rejected")) {
              const text =
                e.kind === "executed"
                  ? `${e.by ?? "家人"}核准了，給${e.recipient}的 ${e.amount_usdc.toLocaleString()} 元已經付出去了。`
                  : `${e.by ?? "家人"}把給${e.recipient}的 ${e.amount_usdc.toLocaleString()} 元擋下來了，錢沒有動，阿嬤免驚。`;
              setNotice({ text, tone: e.kind === "executed" ? "good" : "bad" });
              onChange?.(e);
            }
          }
        }
        seen.current = new Map(next.map((e) => [e.key, e.kind]));
        setEntries(next);
      } catch {
        /* keep last state */
      }
    }
    tick();
    const t = setInterval(tick, 3000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [onChange]);

  return (
    <>
      {notice && (
        <div className={`notice ${notice.tone}`} role="status" aria-live="assertive">
          <span>{notice.text}</span>
          <button className="ghost" onClick={() => setNotice(null)} aria-label="關閉通知">
            知道了
          </button>
        </div>
      )}
      <section className="card" style={{ marginTop: 20 }}>
        <h2>收支紀錄</h2>
        {entries.length === 0 && <div className="hint">還沒有紀錄。</div>}
        <ul className="ledger">
          {entries.slice(0, 12).map((e) => (
            <li key={e.key} className={`ledger-row ${e.kind}`}>
              <span className="when">{hhmm(e.at)}</span>
              <span className="who">
                給{e.recipient}
                {e.by && <small> · {e.by}</small>}
              </span>
              <span className={`amt ${e.kind === "paid" || e.kind === "executed" ? "out" : ""}`}>
                {e.kind === "paid" || e.kind === "executed" ? "−" : ""}
                {e.amount_usdc.toLocaleString()} 元
              </span>
              <span className={`tag ${e.kind}`}>{LABEL[e.kind]}</span>
              {e.url && (
                <a href={e.url} target="_blank" rel="noreferrer">
                  鏈上
                </a>
              )}
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
