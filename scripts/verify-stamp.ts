/**
 * Offline stamp verifier. No RPC, no API key, no network.
 *   pnpm verify-stamp <stamp>                 verify a stamp string
 *   pnpm verify-stamp --proposal 3            fetch proposal 3's stamp from the running app, then verify
 *   pnpm verify-stamp <stamp> --expect 0x...  also require this signer
 * Exit code 0 = valid, 1 = invalid.
 */
import { verifyStamp } from "../lib/proof/stamp";

async function main() {
  const argv = process.argv.slice(2);
  let stamp = argv.find((a) => !a.startsWith("--")) ?? "";
  const expect = argv.includes("--expect") ? argv[argv.indexOf("--expect") + 1] : null;
  if (argv.includes("--proposal")) {
    const id = argv[argv.indexOf("--proposal") + 1];
    const base = process.env.APP_URL ?? "http://localhost:3000";
    const r = await fetch(`${base}/api/proof/${id}`).then((r) => r.json());
    if (!r.stamp) throw new Error(r.error ?? "no stamp");
    stamp = r.stamp;
    console.log(`proposal #${id} stamp id ${r.stamp_id}`);
  }
  if (!stamp) throw new Error("usage: pnpm verify-stamp <stamp> | --proposal <id>");
  const v = await verifyStamp(stamp, expect);
  console.log(v.ok ? "VALID" : "INVALID", "-", v.reason);
  if (v.payload) {
    const p = v.payload;
    console.log(`  agent          ${p.agent}${p.agent_id_token ? `  (Agentic ID #${p.agent_id_token})` : ""}`);
    console.log(`  model          ${p.model} via ${p.provider}`);
    console.log(`  tee_verified   ${p.tee_verified}`);
    console.log(`  request_hash   ${p.request_hash}`);
    console.log(`  response_hash  ${p.response_hash}`);
    console.log(`  score/action   ${p.score} / ${p.action} (${p.pattern_code})`);
    console.log(`  signed at      ${new Date(p.at).toISOString()}`);
    console.log(`  stamp id       ${v.id}`);
  }
  process.exit(v.ok ? 0 : 1);
}
main().catch((e) => {
  console.error(e.message ?? e);
  process.exit(1);
});
