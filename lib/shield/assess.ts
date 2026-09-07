import { z } from "zod";
import { PATTERNS, ruleScore, runRules, type RuleHit } from "./patterns";
import { sha256Hex, type InferenceProof } from "../proof/stamp";
import { ogChat } from "./og";

export const AssessInput = z.object({
  recipient: z.string().default(""),
  amount_usdc: z.number().nonnegative().default(0),
  reason: z.string().default(""),
  caller_claims: z.string().default(""),
  recipient_known: z.boolean().default(false),
  recipient_allowlisted: z.boolean().default(false),
});
export type AssessInput = z.infer<typeof AssessInput>;

export type Assessment = {
  risk_score: number;
  pattern: string;
  pattern_code: string;
  explanation_zh: string;
  question_for_ahma: string;
  recommended_action: "pay" | "ask_family" | "block";
  rule_hits: RuleHit[];
  source: "llm+rules" | "rules";
  /** Present when the judgment came from a model call. On 0G it carries the TEE attestation flag. */
  proof: InferenceProof | null;
};

/** 0G Compute Router: OpenAI-compatible, plus `verify_tee` in the body and a trust-mode header. */
export function shieldProvider(baseUrl: string): InferenceProof["provider"] {
  if (process.env.SHIELD_PROVIDER === "0g-broker") return "0g";
  if (process.env.SHIELD_PROVIDER === "0g" || /0g\.ai|integratenetwork/i.test(baseUrl)) return "0g";
  if (/openai\.com/i.test(baseUrl)) return "openai";
  return "other";
}

const LlmOut = z.object({
  risk_score: z.number().int().min(0).max(100),
  pattern_code: z.string(),
  explanation_zh: z.string(),
  question_for_ahma: z.string(),
  recommended_action: z.enum(["pay", "ask_family", "block"]),
});

const JSON_SCHEMA = {
  name: "scam_assessment",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      risk_score: { type: "integer", description: "0 = 完全正常, 100 = 幾乎確定是詐騙" },
      pattern_code: { type: "string", enum: [...PATTERNS.map((p) => p.code), "none"] },
      explanation_zh: { type: "string", description: "用阿嬤聽得懂的白話台灣中文，兩句以內，說明為什麼可疑或為什麼沒問題" },
      question_for_ahma: { type: "string", description: "一個幫阿嬤查證的問題或建議，例如「我幫你打給小凱確認好不好？」" },
      recommended_action: { type: "string", enum: ["pay", "ask_family", "block"] },
    },
    required: ["risk_score", "pattern_code", "explanation_zh", "question_for_ahma", "recommended_action"],
  },
} as const;

function actionFor(score: number): Assessment["recommended_action"] {
  if (score >= 70) return "block";
  if (score >= 40) return "ask_family";
  return "pay";
}


function systemPrompt() {
  return `你是「豆豆」背後的詐騙防護盾，服務台灣的長輩。根據 165 反詐騙常見手法評估這筆付款的風險。
規則層已經先掃過關鍵字，結果附在下面，你可以調高或調低分數，但要合理。
判斷重點：收款人是否常用、說法是否符合已知詐騙劇本（假冒親友、假冒檢警、監管帳戶、解除分期、投資群組、催促保密）、金額是否異常。
explanation_zh 要用阿嬤聽得懂的台灣口語中文，不要用「風險評估」這種詞，兩句以內。
已知手法代碼：${PATTERNS.map((p) => `${p.code}=${p.name}（${p.tell}）`).join("；")}`;
}

function userPayload(input: AssessInput, hits: RuleHit[], base: number) {
  return JSON.stringify(
    {
      收款人: input.recipient,
      收款人在常用名單: input.recipient_known,
      收款人在白名單: input.recipient_allowlisted,
      金額_USDC: input.amount_usdc,
      阿嬤說的理由: input.reason,
      來電者的說法: input.caller_claims,
      規則層命中: hits.map((h) => ({ 手法: h.name, 關鍵字: h.matched })),
      規則層分數: base,
    },
    null,
    1,
  );
}

/** Small models sometimes wrap JSON in prose or code fences. Take the outermost {...} block. */
function extractJson(text: string): string {
  const a = text.indexOf("{");
  const b = text.lastIndexOf("}");
  return a >= 0 && b > a ? text.slice(a, b + 1) : text;
}

/** Be forgiving about what a 7B model returns: numbers as strings, unknown pattern codes, missing action. */
function coerceOut(o: unknown, hits: RuleHit[], base: number): unknown {
  if (!o || typeof o !== "object" || Array.isArray(o)) return o;
  const r = { ...(o as Record<string, unknown>) };
  const n = Number(r.risk_score);
  r.risk_score = Number.isFinite(n) ? Math.max(0, Math.min(100, Math.round(n))) : base;
  const codes = new Set<string>([...PATTERNS.map((p) => p.code), "none"]);
  if (typeof r.pattern_code !== "string" || !codes.has(r.pattern_code)) r.pattern_code = hits[0]?.code ?? "none";
  if (!["pay", "ask_family", "block"].includes(String(r.recommended_action))) r.recommended_action = actionFor(r.risk_score as number);
  if (typeof r.explanation_zh !== "string") r.explanation_zh = "";
  if (typeof r.question_for_ahma !== "string") r.question_for_ahma = "";
  return r;
}

export async function assessPayment(raw: unknown): Promise<Assessment> {
  const input = AssessInput.parse(raw);
  const text = `${input.reason} ${input.caller_claims} ${input.recipient}`;
  const hits = runRules(text);
  const base = ruleScore(hits, { unknownRecipient: !input.recipient_known, amountUsdc: input.amount_usdc });
  const fallback: Assessment = {
    risk_score: base,
    pattern: hits[0]?.name ?? (input.recipient_known ? "無" : "不明收款帳戶"),
    pattern_code: hits[0]?.code ?? (input.recipient_known ? "none" : "unknown_recipient"),
    explanation_zh:
      base >= 40
        ? `這筆錢的說法很像 165 常見的「${hits[0]?.name ?? "不明收款帳戶"}」手法，我先幫你暫停。`
        : `收款人是常用的${input.recipient}，金額也在每天的額度內，看起來沒問題。`,
    question_for_ahma: base >= 40 ? "我幫你打給家人確認一下好不好？" : "要現在付嗎？",
    recommended_action: actionFor(base),
    rule_hits: hits,
    source: "rules",
    proof: null,
  };

  const system = systemPrompt();
  const user = userPayload(input, hits, base);

  // 0G Compute Network broker path (testnet): wallet-signed request, TEE provider, response signature verified by us.
  if (process.env.SHIELD_PROVIDER === "0g-broker") {
    try {
      const messages = [
        {
          role: "system",
          content:
            system +
            `\n只回傳一個 JSON 物件，不要加說明、不要加程式碼區塊，欄位固定如下：
{"risk_score": <0 到 100 的整數>, "pattern_code": "<${[...PATTERNS.map((p) => p.code), "none"].join("|")}>", "explanation_zh": "<兩句以內的台灣口語中文>", "question_for_ahma": "<一句幫阿嬤查證的建議>", "recommended_action": "<pay|ask_family|block>"}`,
        },
        { role: "user", content: user },
      ];
      const r = await ogChat(messages, { timeoutMs: Number(process.env.SHIELD_TIMEOUT_MS ?? 45_000) });
      const parsed = LlmOut.parse(coerceOut(JSON.parse(extractJson(r.content)), hits, base));
      const pattern = PATTERNS.find((p) => p.code === parsed.pattern_code);
      const proof: InferenceProof = {
        provider: "0g",
        model: r.model,
        request_hash: sha256Hex(JSON.stringify(messages)),
        response_hash: sha256Hex(r.content),
        tee_verified: r.verified,
        trust_mode: r.verifiability,
        response_id: r.chatID,
        at: Date.now(),
      };
      return {
        risk_score: parsed.risk_score,
        pattern: pattern?.name ?? "無",
        pattern_code: parsed.pattern_code,
        explanation_zh: parsed.explanation_zh,
        question_for_ahma: parsed.question_for_ahma,
        recommended_action: parsed.recommended_action,
        rule_hits: hits,
        source: "llm+rules",
        proof,
      };
    } catch (err) {
      console.warn("[shield] 0g broker failed, falling back to rules:", err instanceof Error ? err.message : err);
      return fallback;
    }
  }

  const apiKey = process.env.SHIELD_API_KEY || process.env.OPENAI_API_KEY;
  if (!apiKey) return fallback;
  const baseUrl = (process.env.SHIELD_BASE_URL || "https://api.openai.com/v1").replace(/\/$/, "");
  const model = process.env.SHIELD_MODEL || "gpt-5-mini";
  const provider = shieldProvider(baseUrl);
  const trustMode = provider === "0g" ? process.env.SHIELD_TRUST_MODE || "verified" : null;

  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), Number(process.env.SHIELD_TIMEOUT_MS ?? 20_000));
    const requestBody = JSON.stringify({
      model,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      response_format: { type: "json_schema", json_schema: JSON_SCHEMA },
      // 0G only: ask the router to attach the enclave attestation to the trace. Ignored by other providers.
      ...(provider === "0g" ? { verify_tee: true } : {}),
    });
    const headers: Record<string, string> = { "content-type": "application/json", authorization: `Bearer ${apiKey}` };
    if (trustMode) headers["X-0G-Provider-Trust-Mode"] = trustMode;
    const res = await fetch(`${baseUrl}/chat/completions`, { method: "POST", headers, signal: ctrl.signal, body: requestBody });
    clearTimeout(timer);
    if (!res.ok) throw new Error(`shield model ${res.status}: ${await res.text()}`);
    const data = await res.json();
    const content: string = data.choices?.[0]?.message?.content ?? "";
    const parsed = LlmOut.parse(JSON.parse(content));
    const pattern = PATTERNS.find((p) => p.code === parsed.pattern_code);
    const teeRaw = data.tee_verified ?? data.verification?.tee_verified ?? res.headers.get("x-0g-tee-verified");
    const proof: InferenceProof = {
      provider,
      model: String(data.model ?? model),
      request_hash: sha256Hex(requestBody),
      response_hash: sha256Hex(content),
      tee_verified: teeRaw === undefined || teeRaw === null ? null : teeRaw === true || teeRaw === "true",
      trust_mode: trustMode,
      response_id: typeof data.id === "string" ? data.id : null,
      at: Date.now(),
    };
    return {
      risk_score: parsed.risk_score,
      pattern: pattern?.name ?? "無",
      pattern_code: parsed.pattern_code,
      explanation_zh: parsed.explanation_zh,
      question_for_ahma: parsed.question_for_ahma,
      recommended_action: parsed.recommended_action,
      rule_hits: hits,
      source: "llm+rules",
      proof,
    };
  } catch (err) {
    console.warn("[shield] falling back to rules:", err instanceof Error ? err.message : err);
    return fallback;
  }
}
