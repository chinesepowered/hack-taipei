import { NextResponse } from "next/server";
import { INSTRUCTIONS, TOOLS } from "@/lib/agent/instructions";

export const runtime = "nodejs";

/** Mints a short-lived client secret so the browser can open a WebRTC session directly with OpenAI. */
export async function POST() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "OPENAI_API_KEY is not set" }, { status: 500 });
  const model = process.env.REALTIME_MODEL || "gpt-realtime";
  const voice = process.env.REALTIME_VOICE || "marin";

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
            turn_detection: { type: "server_vad", silence_duration_ms: 700, create_response: true },
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
  return NextResponse.json({ client_secret: data.value, expires_at: data.expires_at, model });
}
