/**
 * Builds the CSFCCA 創作理念 PDF from film/concept.html + film/storyboard.json + film/requests.json.
 * Pulls one frame per clip (t=7s) as an inline thumbnail, then prints with headless Chrome/Edge.
 *   pnpm concept   →  film/out/concept.pdf
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";

const ROOT = resolve(import.meta.dirname, "..");
const FILM = resolve(ROOT, "film");
const OUT = resolve(FILM, "out");
mkdirSync(OUT, { recursive: true });

const sb = JSON.parse(readFileSync(resolve(FILM, "storyboard.json"), "utf8"));
const state = JSON.parse(readFileSync(resolve(FILM, "requests.json"), "utf8"));
const template = readFileSync(resolve(FILM, "concept.html"), "utf8");

const require = createRequire(import.meta.url);
const ffmpeg: string = require("ffmpeg-static");

function frameDataUri(file: string, id: string): string | null {
  if (!file || !existsSync(file)) return null;
  const jpg = resolve(OUT, `thumb_${id}.jpg`);
  const r = spawnSync(ffmpeg, ["-y", "-loglevel", "error", "-ss", "7", "-i", file, "-frames:v", "1", "-vf", "scale=640:-2", "-q:v", "5", jpg]);
  if (r.status !== 0 || !existsSync(jpg)) return null;
  return `data:image/jpeg;base64,${readFileSync(jpg).toString("base64")}`;
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const blocks = sb.shots.map((shot: Record<string, string | number>, i: number) => {
  const e = state[String(shot.id)] ?? {};
  const thumb = frameDataUri(String(e.file ?? ""), String(shot.id));
  const t0 = i * 15;
  const tc = `${String(Math.floor(t0 / 60)).padStart(2, "0")}:${String(t0 % 60).padStart(2, "0")}`;
  const ref = shot.first_frame ? `官方素材裁切（${String(shot.first_frame).split("/").pop()}）` : "無（純文字生成）";
  const versions = Object.entries(state)
    .filter(([k]) => k.startsWith(`${shot.id}_`))
    .map(([k, v]) => `<li><b>${esc(k)}</b>：${esc(String((v as Record<string, string>).note ?? (v as Record<string, string>).status))}</li>`)
    .join("");
  return `
<div class="shot">
  <div style="display:flex;gap:10pt;align-items:flex-start">
    ${thumb ? `<img src="${thumb}" style="width:200pt;border-radius:4pt;flex:none" alt="">` : ""}
    <div style="flex:1">
      <b>鏡頭 ${shot.id}</b> · ${tc} · ${shot.duration ?? 10} 秒 · ${esc(String(e.model ?? sb.model))}${e.request_id ? ` · request ${esc(String(e.request_id)).slice(0, 8)}…` : ""}<br>
      <span class="lyric">${esc(String(shot.lyric ?? ""))}</span><br>
      <span class="small">第一幀：${esc(ref)} · seed ${shot.seed ?? "隨機"}</span>
      ${versions ? `<ul class="small">${versions}</ul>` : ""}
    </div>
  </div>
  <div class="prompt">${esc(String(shot.prompt))}</div>
</div>`;
});

const html = template.replace("<!-- SHOTS -->", blocks.join("\n"));
const filled = resolve(OUT, "concept_filled.html");
writeFileSync(filled, html);

const browsers = [
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
  "C:/Program Files/Microsoft/Edge/Application/msedge.exe",
].filter(existsSync);
if (!browsers.length) throw new Error("no Chrome/Edge found for PDF export");
const pdf = resolve(OUT, "concept.pdf");
const r = spawnSync(browsers[0], ["--headless=new", "--disable-gpu", "--no-pdf-header-footer", `--print-to-pdf=${pdf}`, `file:///${filled.replace(/\\/g, "/")}`], { stdio: "inherit", timeout: 120_000 });
if (r.status !== 0 || !existsSync(pdf)) throw new Error("pdf export failed");
console.log(`→ ${pdf}`);
