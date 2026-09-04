/**
 * Track 04 film pipeline on GMI Cloud (Wan video models).
 *
 *   pnpm film dry-run     print every payload, spend nothing
 *   pnpm film submit      submit shots that have no request_id yet (never re-submits), then poll + download
 *   pnpm film poll        poll existing requests, download finished clips
 *   pnpm film stitch      normalize clips, concat, mix narration if present → film/out/final.mp4
 *   pnpm film status      show the state file
 *
 * Storyboard: film/storyboard.json   State (request ids, urls): film/requests.json
 * Every request id is saved to disk the moment it is returned, so a crash or Ctrl-C never bills twice.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";

const API = "https://console.gmicloud.ai/api/v1/ie/requestqueue/apikey/requests";
const ROOT = resolve(import.meta.dirname, "..");
const FILM = resolve(ROOT, "film");
const STORYBOARD = resolve(FILM, "storyboard.json");
const STATE = resolve(FILM, "requests.json");
const CLIPS = resolve(FILM, "clips");
const OUT = resolve(FILM, "out");

type Shot = {
  id: string;
  prompt: string;
  negative_prompt?: string;
  duration?: number;
  seed?: number;
  first_frame?: string;
  last_frame?: string;
  model?: string;
};
type Storyboard = {
  title: string;
  model: string;
  resolution: "720P" | "1080P";
  ratio: "16:9" | "9:16" | "1:1" | "4:3" | "3:4";
  style: string;
  negative_prompt: string;
  narration?: string;
  music?: string;
  shots: Shot[];
};
type Entry = { request_id?: string; status?: string; video_url?: string; file?: string; error?: string; submitted_at?: string };
type State = Record<string, Entry>;

const cmd = process.argv[2] ?? "dry-run";
const key = process.env.GMI_API_KEY;

function loadStoryboard(): Storyboard {
  if (!existsSync(STORYBOARD)) throw new Error(`missing ${STORYBOARD}. Copy film/storyboard.example.json and fill it in.`);
  return JSON.parse(readFileSync(STORYBOARD, "utf8"));
}
function loadState(): State {
  return existsSync(STATE) ? JSON.parse(readFileSync(STATE, "utf8")) : {};
}
function saveState(s: State) {
  mkdirSync(FILM, { recursive: true });
  writeFileSync(STATE, JSON.stringify(s, null, 2));
}

function payloadFor(sb: Storyboard, shot: Shot) {
  const prompt = `${shot.prompt}\n\n${sb.style}`.trim().slice(0, 1500);
  const payload: Record<string, unknown> = {
    prompt,
    negative_prompt: (shot.negative_prompt ?? sb.negative_prompt).slice(0, 500),
    resolution: sb.resolution,
    ratio: sb.ratio,
    duration: shot.duration ?? 10,
    prompt_extend: true,
    watermark: false,
  };
  if (shot.seed !== undefined) payload.seed = shot.seed;
  if (shot.first_frame) payload.first_frame = shot.first_frame;
  if (shot.last_frame) payload.last_frame = shot.last_frame;
  return { model: shot.model ?? sb.model, payload };
}

async function submit(sb: Storyboard, state: State) {
  if (!key) throw new Error("GMI_API_KEY not set");
  for (const shot of sb.shots) {
    const e = state[shot.id] ?? {};
    if (e.request_id) {
      console.log(`[${shot.id}] already submitted (${e.request_id}), skipping`);
      continue;
    }
    const body = payloadFor(sb, shot);
    const res = await fetch(API, { method: "POST", headers: { authorization: `Bearer ${key}`, "content-type": "application/json" }, body: JSON.stringify(body) });
    const text = await res.text();
    if (!res.ok) {
      state[shot.id] = { ...e, error: `${res.status} ${text.slice(0, 300)}` };
      saveState(state);
      console.error(`[${shot.id}] submit failed: ${res.status} ${text.slice(0, 300)}`);
      continue;
    }
    const data = JSON.parse(text);
    state[shot.id] = { request_id: data.request_id, status: data.status ?? "queued", submitted_at: new Date().toISOString() };
    saveState(state);
    console.log(`[${shot.id}] queued ${data.request_id}`);
  }
}

async function poll(sb: Storyboard, state: State) {
  if (!key) throw new Error("GMI_API_KEY not set");
  mkdirSync(CLIPS, { recursive: true });
  const pending = () => sb.shots.filter((s) => state[s.id]?.request_id && !state[s.id]?.file && state[s.id]?.status !== "failed" && state[s.id]?.status !== "cancelled");
  while (pending().length) {
    for (const shot of pending()) {
      const e = state[shot.id];
      const res = await fetch(`${API}/${e.request_id}`, { headers: { authorization: `Bearer ${key}` } });
      if (!res.ok) {
        console.warn(`[${shot.id}] poll ${res.status}`);
        continue;
      }
      const data = await res.json();
      e.status = data.status;
      if (data.status === "success") {
        const url: string = data.outcome?.video_url;
        e.video_url = url;
        const file = resolve(CLIPS, `${shot.id}.mp4`);
        const bin = Buffer.from(await (await fetch(url)).arrayBuffer());
        writeFileSync(file, bin);
        e.file = file;
        console.log(`[${shot.id}] success → ${file} (${(bin.length / 1e6).toFixed(1)} MB)`);
      } else if (data.status === "failed" || data.status === "cancelled") {
        e.error = JSON.stringify(data).slice(0, 300);
        console.error(`[${shot.id}] ${data.status}: ${e.error}`);
      } else {
        process.stdout.write(`[${shot.id}] ${data.status}  `);
      }
      saveState(state);
    }
    if (pending().length) {
      process.stdout.write("\n");
      await new Promise((r) => setTimeout(r, 10_000));
    }
  }
  console.log("all requests settled");
}

function ffmpeg(args: string[]) {
  const require = createRequire(import.meta.url);
  const bin: string = require("ffmpeg-static");
  const r = spawnSync(bin, ["-y", "-hide_banner", "-loglevel", "error", ...args], { stdio: "inherit" });
  if (r.status !== 0) throw new Error(`ffmpeg failed: ${args.join(" ")}`);
}

function stitch(sb: Storyboard, state: State) {
  mkdirSync(OUT, { recursive: true });
  const size = sb.ratio === "9:16" ? "1080:1920" : sb.ratio === "1:1" ? "1080:1080" : "1920:1080";
  const norm: string[] = [];
  for (const shot of sb.shots) {
    const src = state[shot.id]?.file;
    if (!src || !existsSync(src)) {
      console.warn(`[${shot.id}] no clip, skipping`);
      continue;
    }
    const dst = resolve(OUT, `norm_${shot.id}.mp4`);
    // uniform size/fps, guarantee an audio track so concat never breaks on a silent clip
    ffmpeg([
      "-i", src, "-f", "lavfi", "-i", "anullsrc=r=48000:cl=stereo",
      "-filter_complex", `[0:v]scale=${size}:force_original_aspect_ratio=decrease,pad=${size}:(ow-iw)/2:(oh-ih)/2,fps=24,format=yuv420p[v];[0:a]anull[a0]`,
      "-map", "[v]", "-map", "[a0]?", "-map", "1:a", "-shortest", "-c:v", "libx264", "-preset", "medium", "-crf", "18", "-c:a", "aac", dst,
    ]);
    norm.push(dst);
  }
  if (!norm.length) throw new Error("nothing to stitch");
  const list = resolve(OUT, "concat.txt");
  writeFileSync(list, norm.map((f) => `file '${f.replace(/\\/g, "/")}'`).join("\n"));
  const joined = resolve(OUT, "joined.mp4");
  ffmpeg(["-f", "concat", "-safe", "0", "-i", list, "-c", "copy", joined]);

  let final = joined;
  const tracks: string[] = [];
  if (sb.narration && existsSync(resolve(ROOT, sb.narration))) tracks.push(resolve(ROOT, sb.narration));
  if (sb.music && existsSync(resolve(ROOT, sb.music))) tracks.push(resolve(ROOT, sb.music));
  if (tracks.length) {
    final = resolve(OUT, "final.mp4");
    const inputs = tracks.flatMap((t) => ["-i", t]);
    const mix = tracks.map((_, i) => `[${i + 1}:a]${i === 1 ? "volume=0.25" : "anull"}[t${i}]`).join(";") + ";" + tracks.map((_, i) => `[t${i}]`).join("") + `amix=inputs=${tracks.length}:duration=first:dropout_transition=2[a]`;
    ffmpeg(["-i", joined, ...inputs, "-filter_complex", mix, "-map", "0:v", "-map", "[a]", "-c:v", "copy", "-c:a", "aac", "-shortest", final]);
  }
  console.log(`done → ${final}`);
}

async function main() {
  const sb = loadStoryboard();
  const state = loadState();
  const total = sb.shots.reduce((a, s) => a + (s.duration ?? 10), 0);
  console.log(`${sb.title}: ${sb.shots.length} shots, ${total}s total, model ${sb.model}, ${sb.resolution} ${sb.ratio}`);
  switch (cmd) {
    case "dry-run":
      for (const s of sb.shots) console.log(JSON.stringify(payloadFor(sb, s), null, 1));
      console.log(`\nwould submit ${sb.shots.filter((s) => !state[s.id]?.request_id).length} new requests`);
      break;
    case "submit":
      await submit(sb, state);
      await poll(sb, state);
      break;
    case "poll":
      await poll(sb, state);
      break;
    case "stitch":
      stitch(sb, state);
      break;
    case "status":
      console.log(JSON.stringify(state, null, 2));
      break;
    default:
      throw new Error(`unknown command ${cmd}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
