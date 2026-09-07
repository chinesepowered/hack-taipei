// Reject every pending proposal as 媽媽 so the family page starts clean. Each rejection is a real on-chain tx.
const BASE = process.env.APP_URL ?? "http://localhost:3000";
const d = await fetch(BASE + "/api/proposals").then((r) => r.json());
const pending = (d.proposals ?? []).filter((p) => p.status === "pending");
if (!pending.length) { console.log("nothing pending"); process.exit(0); }
for (const p of pending) {
  const r = await fetch(`${BASE}/api/proposals/${p.id}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ guardian: 1, decision: "reject" }) }).then((r) => r.json());
  console.log(`#${p.id} ${p.amountUsdc} → ${r.error ? "error: " + r.error : "rejected " + r.hash}`);
}
