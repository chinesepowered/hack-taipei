import { NextResponse } from "next/server";
import { INSTRUCTIONS, TOOLS } from "@/lib/agent/instructions";

export const runtime = "nodejs";

/**
 * Mints a short-lived client secret so the browser can open a WebRTC session directly with OpenAI.
 * Body: { mode: "auto" | "ptt" }
 *   auto: server-side voice detection, tuned for a laptop mic in a room (far-field noise reduction, high threshold).
 *   ptt:  no server VAD. The browser gates the mic and commits each turn explicitly. Use this in a loud hall.
 */
export async function POST(req: Request) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "OPENAI_API_KEY is not set" }, { status: 500 });
  const model = process.env.REALTIME_MODEL || "gpt-realtime-2.1-mini";
  const voice = process.env.REALTIME_VOICE || "marin";
  const body = await req.json().catch(() => ({}));
  const mode: "auto" | "ptt" = body.mode === "ptt" ? "ptt" : "auto";

  const turn_detection =
    mode === "ptt"
      ? null
      : {
          type: "server_vad",
          threshold: 0.8,
          prefix_padding_ms: 300,
          silence_duration_ms: 900,
          create_response: true,
          interrupt_response: true,
        };

  const res = await fetch("https://api.openai.com/v1/realtime/client_secrets", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      session: {
        type: "realtime",
        model,
        instructions: INSTRUCTIONS,
        tools: TOOLS,
        tool_choice: "auto",
        audio: {
          input: {
            transcription: { model: "gpt-4o-mini-transcribe", language: "zh" },
            noise_reduction: { type: "far_field" },
            turn_detection,
          },
          output: { voice },
        },
      },
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    return NextResponse.json({ error: `openai ${res.status}: ${text}` }, { status: 502 });
  }
  const data = await res.json();
  return NextResponse.json({ client_secret: data.value, expires_at: data.expires_at, model, mode });
}
