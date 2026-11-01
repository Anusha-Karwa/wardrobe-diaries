import { NextResponse } from "next/server";
import { z } from "zod";
import { runAgent } from "@/lib/agent/run";
import { getThreadMessages, listThreads } from "@/lib/queries";

export const runtime = "nodejs";
export const maxDuration = 300;

const Body = z.object({ threadId: z.string().uuid(), message: z.string().trim().min(1).max(2000) });

/** GET ?threadId=… → messages of a thread; GET without it → recent threads. */
export async function GET(req: Request) {
  const threadId = new URL(req.url).searchParams.get("threadId");
  if (threadId) return NextResponse.json(await getThreadMessages(threadId, 100));
  return NextResponse.json(await listThreads());
}

/**
 * POST {threadId, message} → Server-Sent Events:
 *   event: step   data: {"label": "Checking your wardrobe…"}
 *   event: done   data: {"message": "...", "cards": {...}}
 *   event: error  data: {"error": "..."}
 */
export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Invalid message" }, { status: 400 });
  const { threadId, message } = parsed.data;

  const enc = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) => controller.enqueue(enc.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      // Keep the connection alive while long tools run.
      const ping = setInterval(() => controller.enqueue(enc.encode(`: ping\n\n`)), 15_000);
      try {
        const reply = await runAgent(threadId, message, (label) => send("step", { label }));
        send("done", reply);
      } catch (err) {
        console.error("[agent] failed", err);
        const msg = (err as Error).message ?? "";
        send("error", { error: /429|quota|rate/i.test(msg) ? "I'm being rate-limited by Gemini. Try again in a minute." : "Something went wrong. Try asking again." });
      } finally {
        clearInterval(ping);
        controller.close();
      }
    },
  });
  return new Response(stream, {
    headers: { "Content-Type": "text/event-stream; charset=utf-8", "Cache-Control": "no-cache, no-transform", Connection: "keep-alive" },
  });
}
