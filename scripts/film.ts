/**
 * Track 04 film pipeline on GMI Cloud (Wan video models).
 *
 *   pnpm film dry-run          print every payload (image data URIs abbreviated), spend nothing
 *   pnpm film submit-one 01    submit a single shot, then poll it. Use this first to validate image input.
 *   pnpm film submit           submit shots that have no request_id yet (never re-submits), then poll + download
 *   pnpm film poll             poll existing requests, download finished clips
 *   pnpm film stitch           normalize clips, concat, mix music/narration → film/out/final.mp4
 *   pnpm film status           show the state file
 *
 * Storyboard: film/storyboard.json   State (request ids, urls): film/requests.json
 * Every request id is saved to disk the moment it is returned, so a crash or Ctrl-C never bills twice.
 * `first_frame` / `last_frame` may be a URL or a local image path; local files are sent as base64 data URIs.
 * If the primary model rejects an image-conditioned request (4xx), the shot is retried once on `fallback_i2v_model`.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { extname, resolve } from "node:path";
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
  lyric?: string;
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
  fallback_i2v_model?: string;
  resolution: "720P" | "1080P";
  ratio: "16:9" | "9:16" | "1:1" | "4:3" | "3:4";
  style: string;
  negative_prompt: string;
  narration?: string;
  music?: string;
  shots: Shot[];
};
type Entry = { request_id?: string; model?: string; status?: string; video_url?: string; file?: string; error?: string; submitted_at?: string };
type State = Record<string, Entry>;

const [, , cmd = "dry-run", arg] = process.argv;
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

function imageRef(ref: string): string {
  if (/^(https?:|data:)/.test(ref)) return ref;
  const p = resolve(ROOT, ref);
  if (!existsSync(p)) throw new Error(`reference image not found: ${ref}`);
  const mime = extname(p).toLowerCase() === ".png" ? "image/png" : "image/jpeg";
  return `data:${mime};base64,${readFileSync(p).toString("base64")}`;
}

function payloadFor(sb: Storyboard, shot: Shot, model = shot.model ?? sb.model) {
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
  if (shot.first_frame) payload.first_frame = imageRef(shot.first_frame);
  if (shot.last_frame) payload.last_frame = imageRef(shot.last_frame);
  return { model, payload };
}

async function post(body: unknown) {
  const res = await fetch(API, { method: "POST", headers: { authorization: `Bearer ${key}`, "content-type": "application/json" }, body: JSON.stringify(body) });
  return { ok: res.ok, status: res.status, text: await res.text() };
}

async function submitShot(sb: Storyboard, state: State, shot: Shot) {
  const e = state[shot.id] ?? {};
  if (e.request_id) {
    console.log(`[${shot.id}] already submitted (${e.request_id}), skipping`);
    return;
  }
  let body = payloadFor(sb, shot);
  let r = await post(body);
  if (!r.ok && r.status >= 400 && r.status < 500 && shot.first_frame && sb.fallback_i2v_model && body.model !== sb.fallback_i2v_model) {
    console.warn(`[${shot.id}] ${body.model} rejected image input (${r.status}): ${r.text.slice(0, 200)}\n   → retrying on ${sb.fallback_i2v_model}`);
    body = payloadFor(sb, shot, sb.fallback_i2v_model);
    r = await post(body);
  }
  if (!r.ok) {
    state[shot.id] = { ...e, error: `${r.status} ${r.text.slice(0, 300)}` };
    saveState(state);
    console.error(`[${shot.id}] submit failed: ${r.status} ${r.text.slice(0, 300)}`);
    return;
  }
  const data = JSON.parse(r.text);
  state[shot.id] = { request_id: data.request_id, model: body.model, status: data.status ?? "queued", submitted_at: new Date().toISOString() };
  saveState(state);
  console.log(`[${shot.id}] queued ${data.request_id} on ${body.model}`);
}

async function poll(sb: Storyboard, state: State, only?: string) {
  if (!key) throw new Error("GMI_API_KEY not set");
  mkdirSync(CLIPS, { recursive: true });
  const shots = only ? sb.shots.filter((s) => s.id === only) : sb.shots;
  const pending = () => shots.filter((s) => state[s.id]?.request_id && !state[s.id]?.file && state[s.id]?.status !== "failed" && state[s.id]?.status !== "cancelled");
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
        const url: string | undefined = data.outcome?.media_urls?.[0]?.url ?? data.outcome?.video_url;
        if (!url) throw new Error(`[${shot.id}] success but no media url: ${JSON.stringify(data.outcome).slice(0, 300)}`);
        e.video_url = url;
        const file = resolve(CLIPS, `${shot.id}.mp4`);
        const bin = Buffer.from(await (await fetch(url)).arrayBuffer());
        writeFileSync(file, bin);
        e.file = file;
        console.log(`\n[${shot.id}] success → ${file} (${(bin.length / 1e6).toFixed(1)} MB)`);
      } else if (data.status === "failed" || data.status === "cancelled") {
        e.error = JSON.stringify(data).slice(0, 400);
        console.error(`\n[${shot.id}] ${data.status}: ${e.error}`);
      } else {
        process.stdout.write(`[${shot.id}] ${data.status}  `);
      }
      saveState(state);
    }
    if (pending().length) {
      process.stdout.write("\n");
      await new Promise((r) => setTimeout(r, 15_000));
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
    // uniform size/fps, video only. Audio is added at the end from the storyboard's music/narration.
    ffmpeg(["-i", src, "-an", "-vf", `scale=${size}:force_original_aspect_ratio=decrease,pad=${size}:(ow-iw)/2:(oh-ih)/2,fps=24,format=yuv420p`, "-c:v", "libx264", "-preset", "medium", "-crf", "18", dst]);
    norm.push(dst);
  }
  if (!norm.length) throw new Error("nothing to stitch");
  const list = resolve(OUT, "concat.txt");
  writeFileSync(list, norm.map((f) => `file '${f.replace(/\\/g, "/")}'`).join("\n"));
  const joined = resolve(OUT, "joined.mp4");
  ffmpeg(["-f", "concat", "-safe", "0", "-i", list, "-c", "copy", joined]);

  const tracks = [sb.narration, sb.music].filter((t): t is string => !!t && existsSync(resolve(ROOT, t))).map((t) => resolve(ROOT, t));
  const final = resolve(OUT, "final.mp4");
  if (tracks.length) {
    const inputs = tracks.flatMap((t) => ["-i", t]);
    const mix =
      tracks.length === 1
        ? "[1:a]afade=t=out:st=131:d=3[a]"
        : "[1:a]anull[t0];[2:a]volume=0.3[t1];[t0][t1]amix=inputs=2:duration=first:dropout_transition=2[a]";
    ffmpeg(["-i", joined, ...inputs, "-filter_complex", mix, "-map", "0:v", "-map", "[a]", "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-shortest", final]);
  } else {
    ffmpeg(["-i", joined, "-c", "copy", final]);
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
      for (const s of sb.shots) {
        const p = payloadFor(sb, s);
        const shown = { ...p, payload: { ...p.payload, first_frame: p.payload.first_frame ? `${String(p.payload.first_frame).slice(0, 40)}… (${String(p.payload.first_frame).length} chars)` : undefined } };
        console.log(JSON.stringify(shown, null, 1));
      }
      console.log(`\nwould submit ${sb.shots.filter((s) => !state[s.id]?.request_id).length} new requests`);
      break;
    case "submit-one": {
      if (!key) throw new Error("GMI_API_KEY not set");
      const shot = sb.shots.find((s) => s.id === arg);
      if (!shot) throw new Error(`no shot ${arg}`);
      await submitShot(sb, state, shot);
      await poll(sb, state, shot.id);
      break;
    }
    case "submit":
      if (!key) throw new Error("GMI_API_KEY not set");
      for (const shot of sb.shots) await submitShot(sb, state, shot);
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
