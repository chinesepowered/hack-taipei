"use client";

/**
 * Browser-side OpenAI Realtime session over WebRTC.
 * Tool calls from the model are executed against our own API routes and the result is sent back
 * over the data channel, so the model never touches keys or the chain directly.
 *
 * Two turn modes:
 *   auto: server VAD decides when Ah-ma finished talking.
 *   ptt:  push-to-talk. The mic track is muted until the button is held; releasing commits the turn.
 *         Immune to background music and to 豆豆 hearing itself through the speakers.
 */
export type AgentState = "idle" | "connecting" | "listening" | "thinking" | "speaking" | "worried" | "happy";
export type TurnMode = "auto" | "ptt";

export type TranscriptLine = { role: "ahma" | "doudou" | "system"; text: string; at: number };

export type Callbacks = {
  onState: (s: AgentState) => void;
  onTranscript: (line: TranscriptLine) => void;
  onAssessment?: (a: { risk_score: number; pattern: string; explanation_zh: string }) => void;
  onPayment?: (p: Record<string, unknown>) => void;
  onError?: (msg: string) => void;
};

type ToolResult = Record<string, unknown>;

export class RealtimeSession {
  private pc: RTCPeerConnection | null = null;
  private dc: RTCDataChannel | null = null;
  private mic: MediaStream | null = null;
  private audio: HTMLAudioElement;
  private pendingText = "";
  private watched = new Set<number>();
  private poll: ReturnType<typeof setInterval> | null = null;
  private holding = false;
  private responding = false;

  constructor(
    private cb: Callbacks,
    public readonly mode: TurnMode = "auto",
  ) {
    this.audio = document.createElement("audio");
    this.audio.autoplay = true;
  }

  async connect() {
    this.cb.onState("connecting");
    const sess = await fetch("/api/realtime/session", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ mode: this.mode }),
    }).then((r) => r.json());
    if (!sess.client_secret) throw new Error(sess.error ?? "no client secret");

    this.pc = new RTCPeerConnection();
    this.pc.ontrack = (e) => {
      this.audio.srcObject = e.streams[0];
    };
    this.mic = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1 },
    });
    for (const track of this.mic.getTracks()) {
      if (this.mode === "ptt") track.enabled = false;
      this.pc.addTrack(track, this.mic);
    }

    this.dc = this.pc.createDataChannel("oai-events");
    this.dc.onmessage = (e) => this.handle(JSON.parse(e.data));
    this.dc.onopen = () => {
      this.cb.onState("listening");
      this.send({ type: "response.create", response: { instructions: "用一句話跟阿嬤打招呼並自我介紹。" } });
      this.poll = setInterval(() => this.checkWatched(), 3000);
    };

    const offer = await this.pc.createOffer();
    await this.pc.setLocalDescription(offer);
    const res = await fetch(`https://api.openai.com/v1/realtime/calls?model=${encodeURIComponent(sess.model)}`, {
      method: "POST",
      body: offer.sdp,
      headers: { authorization: `Bearer ${sess.client_secret}`, "content-type": "application/sdp" },
    });
    if (!res.ok) throw new Error(`realtime call failed: ${res.status} ${await res.text()}`);
    await this.pc.setRemoteDescription({ type: "answer", sdp: await res.text() });
  }

  disconnect() {
    if (this.poll) clearInterval(this.poll);
    this.dc?.close();
    this.pc?.close();
    this.mic?.getTracks().forEach((t) => t.stop());
    this.pc = null;
    this.dc = null;
    this.cb.onState("idle");
  }

  /** Push-to-talk: call on pointer down. Cancels whatever 豆豆 is saying and opens the mic. */
  pttStart() {
    if (this.mode !== "ptt" || this.holding) return;
    this.holding = true;
    if (this.responding) this.send({ type: "response.cancel" });
    this.send({ type: "input_audio_buffer.clear" });
    this.mic?.getAudioTracks().forEach((t) => (t.enabled = true));
    this.cb.onState("listening");
  }

  /** Push-to-talk: call on pointer up. Closes the mic and commits the turn. */
  pttStop() {
    if (this.mode !== "ptt" || !this.holding) return;
    this.holding = false;
    // let the last ~200ms of audio reach the server before committing
    setTimeout(() => {
      this.mic?.getAudioTracks().forEach((t) => (t.enabled = false));
      this.send({ type: "input_audio_buffer.commit" });
      this.send({ type: "response.create" });
      this.cb.onState("thinking");
    }, 200);
  }

  /** Inject a system-style notice and let the model react (used when the family decides). */
  notify(text: string) {
    this.cb.onTranscript({ role: "system", text, at: Date.now() });
    this.send({
      type: "conversation.item.create",
      item: { type: "message", role: "user", content: [{ type: "input_text", text: `（系統通知）${text}` }] },
    });
    this.send({ type: "response.create" });
  }

  private send(ev: unknown) {
    if (this.dc?.readyState === "open") this.dc.send(JSON.stringify(ev));
  }

  private async handle(ev: { type: string } & Record<string, unknown>) {
    switch (ev.type) {
      case "input_audio_buffer.speech_started":
        if (this.mode === "auto") this.cb.onState("listening");
        break;
      case "input_audio_buffer.speech_stopped":
        if (this.mode === "auto") this.cb.onState("thinking");
        break;
      case "response.created":
        this.responding = true;
        this.cb.onState("thinking");
        break;
      case "response.done":
        this.responding = false;
        break;
      case "output_audio_buffer.started":
        this.cb.onState("speaking");
        break;
      case "output_audio_buffer.stopped":
      case "output_audio_buffer.cleared":
        this.cb.onState("listening");
        break;
      case "conversation.item.input_audio_transcription.completed": {
        const t = String(ev.transcript ?? "").trim();
        if (t) this.cb.onTranscript({ role: "ahma", text: t, at: Date.now() });
        break;
      }
      case "response.output_audio_transcript.delta":
      case "response.audio_transcript.delta":
        this.pendingText += String(ev.delta ?? "");
        break;
      case "response.output_audio_transcript.done":
      case "response.audio_transcript.done": {
        const t = (String(ev.transcript ?? "") || this.pendingText).trim();
        this.pendingText = "";
        if (t) this.cb.onTranscript({ role: "doudou", text: t, at: Date.now() });
        break;
      }
      case "response.function_call_arguments.done": {
        const name = String(ev.name);
        const callId = String(ev.call_id);
        let args: Record<string, unknown> = {};
        try {
          args = JSON.parse(String(ev.arguments ?? "{}"));
        } catch {
          /* empty */
        }
        this.cb.onState("thinking");
        const out = await this.runTool(name, args);
        this.send({ type: "conversation.item.create", item: { type: "function_call_output", call_id: callId, output: JSON.stringify(out) } });
        this.send({ type: "response.create" });
        break;
      }
      case "error": {
        const err = ev.error as { code?: string; message?: string } | undefined;
        // committing an empty buffer (tap without speaking) is harmless; don't surface it
        if (err?.code === "input_audio_buffer_commit_empty") break;
        this.cb.onError?.(err?.message ?? JSON.stringify(ev));
        break;
      }
    }
  }

  private async runTool(name: string, args: Record<string, unknown>): Promise<ToolResult> {
    try {
      switch (name) {
        case "check_balance":
          return await fetch("/api/wallet/balance").then((r) => r.json());
        case "assess_payment": {
          const a = await fetch("/api/shield", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(args) }).then((r) =>
            r.json(),
          );
          this.cb.onAssessment?.(a);
          this.cb.onState(a.risk_score >= 40 ? "worried" : "happy");
          return {
            risk_score: a.risk_score,
            pattern: a.pattern,
            explanation_zh: a.explanation_zh,
            question_for_ahma: a.question_for_ahma,
            recommended_action: a.recommended_action,
            recipient_known: a.recipient?.known,
          };
        }
        case "execute_payment": {
          const p = await fetch("/api/wallet/pay", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(args) }).then((r) =>
            r.json(),
          );
          this.cb.onPayment?.(p);
          if (p.status === "needs_family" && typeof p.proposal_id === "number") this.watched.add(p.proposal_id);
          this.cb.onState(p.status === "paid" ? "happy" : "worried");
          return p;
        }
        case "check_proposal":
          return await fetch(`/api/proposals/${Number(args.proposal_id)}`).then((r) => r.json());
        default:
          return { error: `unknown tool ${name}` };
      }
    } catch (e) {
      return { error: e instanceof Error ? e.message : String(e) };
    }
  }

  private async checkWatched() {
    for (const id of [...this.watched]) {
      try {
        const p = await fetch(`/api/proposals/${id}`).then((r) => r.json());
        if (p.status === "executed" || p.status === "rejected") {
          this.watched.delete(id);
          const who = p.meta?.decisions?.at(-1)?.guardian ?? "家人";
          this.cb.onPayment?.({ ...p, status: p.status, proposal_id: id });
          this.cb.onState(p.status === "executed" ? "happy" : "worried");
          this.notify(
            p.status === "executed"
              ? `${who}已經核准了給${p.meta?.recipientName ?? p.to}的 ${p.amountUsdc} 元，錢已經付出去了。`
              : `${who}把給${p.meta?.recipientName ?? p.to}的 ${p.amountUsdc} 元擋下來了，錢沒有動。請安慰阿嬤。`,
          );
        }
      } catch {
        /* retry next tick */
      }
    }
  }
}
