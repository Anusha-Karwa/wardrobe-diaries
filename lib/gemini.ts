import { GoogleGenAI, ApiError, type GenerateContentParameters, type GenerateContentResponse } from "@google/genai";
import type { z } from "zod";

/**
 * Every Gemini call goes through here:
 *  - a timeout (AbortSignal)
 *  - one retry with backoff on 429 / 5xx / timeout
 *  - optional zod validation of JSON output (with one retry on bad JSON)
 *  - usageMetadata logging in development
 */

// Google's "gemini-flash-latest" alias always points at the current Flash model.
// Set GEMINI_MODEL to pin a specific version.
export const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-flash-latest";

let client: GoogleGenAI | null = null;
export function gemini() {
  if (!client) {
    if (!process.env.GEMINI_API_KEY) throw new Error("GEMINI_API_KEY is not set");
    client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  }
  return client;
}

type Params = Omit<GenerateContentParameters, "model"> & { model?: string };

export interface CallOptions {
  /** Shown in logs, e.g. "extract", "segment", "agent". */
  label: string;
  timeoutMs?: number;
  /** Try to switch thinking off (better for detection/segmentation). Falls back silently if unsupported. */
  thinkingOff?: boolean;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function isRetryable(err: unknown) {
  if (err instanceof ApiError) return err.status === 429 || err.status >= 500;
  const msg = String((err as Error)?.message ?? err);
  return /abort|timeout|ECONNRESET|fetch failed|503|429/i.test(msg);
}

function isThinkingConfigError(err: unknown) {
  const msg = String((err as Error)?.message ?? err);
  return err instanceof ApiError && err.status === 400 && /thinking/i.test(msg);
}

async function once(params: Params, opts: CallOptions): Promise<GenerateContentResponse> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? 50_000);
  try {
    return await gemini().models.generateContent({
      ...params,
      model: params.model ?? GEMINI_MODEL,
      config: { ...params.config, abortSignal: controller.signal },
    });
  } finally {
    clearTimeout(timer);
  }
}

/** Raw call with timeout + one retry. Returns the full response. */
export async function generate(params: Params, opts: CallOptions): Promise<GenerateContentResponse> {
  const started = Date.now();
  let p = params;
  if (opts.thinkingOff) {
    p = { ...params, config: { ...params.config, thinkingConfig: { thinkingBudget: 0 } } };
  }

  let res: GenerateContentResponse;
  try {
    res = await once(p, opts);
  } catch (err) {
    if (opts.thinkingOff && isThinkingConfigError(err)) {
      // This model doesn't accept thinkingBudget: 0 — use its default instead.
      res = await generate(params, { ...opts, thinkingOff: false });
      return res;
    }
    if (!isRetryable(err)) throw err;
    const wait = 1500 + Math.random() * 1000;
    console.warn(`[gemini:${opts.label}] retrying in ${Math.round(wait)}ms:`, (err as Error).message);
    await sleep(wait);
    res = await once(p, opts);
  }

  if (process.env.NODE_ENV !== "production") {
    const u = res.usageMetadata;
    console.log(
      `[gemini:${opts.label}] ${Date.now() - started}ms · in ${u?.promptTokenCount ?? "?"} · out ${u?.candidatesTokenCount ?? "?"} · thinking ${u?.thoughtsTokenCount ?? 0}`
    );
  }
  return res;
}

/** Strip ```json fences and parse. Also tolerates leading/trailing prose around the JSON. */
export function parseJsonText(text: string | undefined): unknown {
  if (!text) throw new Error("Empty response from Gemini");
  let t = text.trim();
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) t = fence[1].trim();
  try {
    return JSON.parse(t);
  } catch {
    // Grab the outermost {...} or [...]
    const start = t.search(/[\[{]/);
    const end = Math.max(t.lastIndexOf("}"), t.lastIndexOf("]"));
    if (start >= 0 && end > start) return JSON.parse(t.slice(start, end + 1));
    throw new Error("Could not parse JSON from Gemini response");
  }
}

/**
 * Structured-output call: sets responseMimeType JSON (+ responseSchema if given),
 * validates with zod, retries once if the JSON is invalid.
 */
export async function generateJson<T>(
  schema: z.ZodType<T>,
  params: Params & { responseSchema?: unknown },
  opts: CallOptions
): Promise<T> {
  const { responseSchema, ...rest } = params;
  const p: Params = {
    ...rest,
    config: {
      ...rest.config,
      responseMimeType: "application/json",
      ...(responseSchema ? { responseSchema } : {}),
    },
  };

  let lastErr: unknown;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await generate(p, opts);
      const parsed = schema.safeParse(parseJsonText(res.text));
      if (parsed.success) return parsed.data;
      lastErr = new Error(`Invalid JSON shape: ${parsed.error.message.slice(0, 500)}`);
    } catch (err) {
      lastErr = err;
    }
    console.warn(`[gemini:${opts.label}] attempt ${attempt + 1} failed:`, (lastErr as Error)?.message);
  }
  throw lastErr;
}
