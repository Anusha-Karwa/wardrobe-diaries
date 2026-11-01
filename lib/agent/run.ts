import { FunctionCallingConfigMode, type Content, type Part } from "@google/genai";
import { generate } from "../gemini";
import { AGENT_SYSTEM_PROMPT, fill } from "../prompts";
import { getProfile, getThreadMessages, insertChatMessage, listItems, type ChatMessage } from "../queries";
import type { Item } from "../types";
import { labelize } from "../utils";
import { DECLARATIONS, buildCards, runTool, type AgentCards, type AgentContext } from "./tools";

/**
 * Stylist agent loop (spec 6h):
 * profile + wardrobe summary + last 10 messages → Gemini with function declarations (mode ANY, so it must call a tool
 * every turn) → run tools → repeat (max 6 steps) → finish with respond_to_user. Over the limit, it is forced to respond.
 */
const MAX_STEPS = 6;

export interface AgentReply {
  message: string;
  cards: AgentCards;
}

function wardrobeSummary(items: Item[]) {
  if (!items.length) return "EMPTY (no items uploaded yet)";
  const count = (key: keyof Item) => {
    const m = new Map<string, number>();
    for (const i of items) m.set(String(i[key]), (m.get(String(i[key])) ?? 0) + 1);
    return [...m.entries()].sort((a, b) => b[1] - a[1]).map(([k, n]) => `${labelize(k)} ${n}`).join(", ");
  };
  return `${items.length} items. By category: ${count("category")}. By colour: ${count("primary_color")}.`;
}

/** Previous turns as plain text, with what was shown, so follow-ups ("make it more festive") have context. */
function historyToContents(history: ChatMessage[]): Content[] {
  return history.map((m) => {
    let text = m.content ?? "";
    const c = m.cards as Partial<AgentCards> | null;
    if (m.role === "assistant" && c) {
      const bits: string[] = [];
      if (c.outfits?.length) bits.push(`outfits shown: ${c.outfits.map((o) => `"${o.name}" (${o.item_ids.join(", ")})`).join("; ")}`);
      if (c.items?.length) bits.push(`items shown: ${c.items.map((i) => i.id).join(", ")}`);
      if (c.buys?.length) bits.push(`buy suggestions shown: ${c.buys.map((b) => b.title).join("; ")}`);
      if (bits.length) text += `\n[${bits.join(" | ")}]`;
    }
    return { role: m.role === "assistant" ? "model" : "user", parts: [{ text }] };
  });
}

export async function runAgent(threadId: string, userMessage: string, progress: (label: string) => void): Promise<AgentReply> {
  const [profile, wardrobe, history] = await Promise.all([getProfile(), listItems(), getThreadMessages(threadId, 10)]);
  await insertChatMessage({ thread_id: threadId, role: "user", content: userMessage });

  const ctx: AgentContext = { wardrobe, profile, outfits: new Map(), buys: new Map(), sources: new Map(), progress };
  const today = new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Kolkata" });
  const system = fill(AGENT_SYSTEM_PROMPT, {
    name: profile.name || "there",
    city: profile.city,
    budget_band: profile.budget_band,
    aesthetics: profile.aesthetics.join(", ") || "not set",
    notes: profile.notes || "none",
    wardrobe_summary: wardrobeSummary(wardrobe),
    date: today,
  }) + `\nShops for: ${profile.gender_pref}. Refer to wardrobe items by their exact ids in tool calls. When you show outfits from build_outfits, pass their keys (o1…) in respond_to_user.outfits; pass buy keys (b1…) in buy_suggestions and source keys (s1…) in sources.`;

  const contents: Content[] = [...historyToContents(history), { role: "user", parts: [{ text: userMessage }] }];
  progress("Thinking…");

  for (let step = 0; step <= MAX_STEPS; step++) {
    const last = step === MAX_STEPS;
    const res = await generate(
      {
        contents,
        config: {
          systemInstruction: system,
          tools: [{ functionDeclarations: DECLARATIONS }],
          toolConfig: {
            functionCallingConfig: last
              ? { mode: FunctionCallingConfigMode.ANY, allowedFunctionNames: ["respond_to_user"] }
              : { mode: FunctionCallingConfigMode.ANY },
          },
          temperature: 0.6,
        },
      },
      { label: `agent:step${step}`, timeoutMs: 60_000 }
    );

    const modelContent = res.candidates?.[0]?.content;
    const calls = res.functionCalls ?? [];

    // Plain text instead of a tool call: wrap it as the reply.
    if (!calls.length) {
      return finish({ message: res.text?.trim() || "Sorry, I lost my train of thought. Could you ask that again?" });
    }

    const final = calls.find((c) => c.name === "respond_to_user");
    if (final) return finish((final.args ?? {}) as Record<string, unknown>);

    // Keep the model's turn exactly as returned (Gemini 3 needs its thought signatures back).
    if (modelContent) contents.push(modelContent);
    const results = await Promise.all(
      calls.map(async (c) => {
        let response: unknown;
        try {
          response = await runTool(c.name!, (c.args ?? {}) as Record<string, unknown>, ctx);
        } catch (err) {
          console.error(`[agent] tool ${c.name} failed`, err);
          response = { error: `Tool failed: ${(err as Error).message.slice(0, 200)}` };
        }
        return { functionResponse: { id: c.id, name: c.name, response: { result: response } } } as Part;
      })
    );
    contents.push({ role: "user", parts: results });
  }
  return finish({ message: "Here's what I found so far." });

  async function finish(args: Record<string, unknown>): Promise<AgentReply> {
    const cards = await buildCards(args, ctx);
    const message = String(args.message ?? "").trim() || "Here you go!";
    await insertChatMessage({ thread_id: threadId, role: "assistant", content: message, cards });
    return { message, cards };
  }
}
