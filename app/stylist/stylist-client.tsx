"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import ReactMarkdown from "react-markdown";
import { ArrowUp, Check, History, Loader2, Plus, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ItemImage } from "@/components/item-image";
import { OutfitCard } from "@/components/outfit-board";
import { BuyCard } from "@/components/buy-card";
import type { AgentCards } from "@/lib/agent/tools";
import type { Item } from "@/lib/types";
import { cn } from "@/lib/utils";

const STARTERS = [
  "I have nothing to wear tomorrow, office then dinner",
  "What should I wear with my black top?",
  "What can I wear with my blue jeans? I don't think I have anything",
  "Do I have a red long-sleeve block-print top?",
  "What's trending in jewellery right now?",
  "Are net and lace tops in? Do I own any?",
  "Plan my outfits for this week",
];

interface Msg {
  id: string;
  role: "user" | "assistant";
  content: string;
  cards?: AgentCards | null;
  steps?: string[];
  pending?: boolean;
  error?: boolean;
}

const THREAD_KEY = "closet:thread";
const storage = {
  get: () => {
    try {
      return localStorage.getItem(THREAD_KEY);
    } catch {
      return null;
    }
  },
  set: (v: string) => {
    try {
      localStorage.setItem(THREAD_KEY, v);
    } catch {
      /* private mode */
    }
  },
};

/** Minimal SSE reader for a fetch() response body. */
async function readSSE(res: Response, on: (event: string, data: unknown) => void) {
  const reader = res.body!.getReader();
  const dec = new TextDecoder();
  let buf = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let i;
    while ((i = buf.indexOf("\n\n")) >= 0) {
      const chunk = buf.slice(0, i);
      buf = buf.slice(i + 2);
      const event = chunk.match(/^event: (.*)$/m)?.[1];
      const data = chunk.match(/^data: (.*)$/m)?.[1];
      if (event && data) on(event, JSON.parse(data));
    }
  }
}

export function StylistClient({ wardrobe }: { wardrobe: Item[] }) {
  const router = useRouter();
  const params = useSearchParams();
  const [threadId, setThreadId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [threads, setThreads] = useState<{ thread_id: string; title: string | null }[]>([]);
  const bottom = useRef<HTMLDivElement>(null);
  const autoSent = useRef(false);

  // Pick up the saved thread (or start one) and load its messages.
  useEffect(() => {
    const prefill = params.get("prompt");
    const saved = storage.get();
    const id = prefill || !saved ? crypto.randomUUID() : saved;
    setThreadId(id);
    storage.set(id);
    if (!prefill && saved) {
      fetch(`/api/agent?threadId=${saved}`)
        .then((r) => (r.ok ? r.json() : []))
        .then((rows: { id: string; role: "user" | "assistant"; content: string; cards: AgentCards | null }[]) =>
          setMessages(rows.map((r) => ({ id: r.id, role: r.role, content: r.content ?? "", cards: r.cards })))
        )
        .catch(() => {});
    }
    fetch("/api/agent").then((r) => (r.ok ? r.json() : [])).then(setThreads).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages]);

  const send = useCallback(
    async (text: string) => {
      const msg = text.trim();
      if (!msg || busy || !threadId) return;
      setInput("");
      setBusy(true);
      const aid = `a${Date.now()}`;
      setMessages((m) => [...m, { id: `u${Date.now()}`, role: "user", content: msg }, { id: aid, role: "assistant", content: "", steps: [], pending: true }]);
      const patch = (p: Partial<Msg> | ((m: Msg) => Partial<Msg>)) =>
        setMessages((ms) => ms.map((m) => (m.id === aid ? { ...m, ...(typeof p === "function" ? p(m) : p) } : m)));
      try {
        const res = await fetch("/api/agent", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ threadId, message: msg }) });
        if (!res.ok || !res.body) throw new Error("Request failed");
        let finished = false;
        await readSSE(res, (event, data) => {
          const d = data as { label?: string; message?: string; cards?: AgentCards; error?: string };
          if (event === "step" && d.label) patch((m) => ({ steps: m.steps?.includes(d.label!) ? m.steps : [...(m.steps ?? []), d.label!] }));
          if (event === "done") {
            finished = true;
            patch({ content: d.message ?? "", cards: d.cards, pending: false });
          }
          if (event === "error") {
            finished = true;
            patch({ content: d.error ?? "Something went wrong.", pending: false, error: true });
          }
        });
        if (!finished) patch({ content: "The connection dropped. Try asking again.", pending: false, error: true });
      } catch {
        patch({ content: "Couldn't reach your stylist. Check your connection and try again.", pending: false, error: true });
      } finally {
        setBusy(false);
      }
    },
    [busy, threadId]
  );

  // "What's missing for this?" from an item page: send the prefilled prompt once.
  useEffect(() => {
    const prefill = params.get("prompt");
    if (prefill && threadId && !autoSent.current) {
      autoSent.current = true;
      router.replace("/stylist");
      send(prefill);
    }
  }, [params, threadId, send, router]);

  function newChat() {
    const id = crypto.randomUUID();
    storage.set(id);
    setThreadId(id);
    setMessages([]);
  }

  async function openThread(id: string) {
    storage.set(id);
    setThreadId(id);
    const rows = await fetch(`/api/agent?threadId=${id}`).then((r) => r.json());
    setMessages(rows.map((r: { id: string; role: "user" | "assistant"; content: string; cards: AgentCards | null }) => ({ id: r.id, role: r.role, content: r.content ?? "", cards: r.cards })));
  }

  return (
    <div className="flex min-h-[calc(100dvh-12rem)] flex-col">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h1 className="font-serif text-5xl font-bold leading-none"><span className="marker">my stylist</span></h1>
          <p className="text-sm text-muted-foreground">Knows your {wardrobe.length} pieces and this week&apos;s trends.</p>
        </div>
        <div className="flex gap-1.5">
          {threads.length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon" aria-label="Past chats">
                  <History />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="max-w-72">
                {threads.map((t) => (
                  <DropdownMenuItem key={t.thread_id} onClick={() => openThread(t.thread_id)}>
                    <span className="truncate">{t.title ?? "Chat"}</span>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          <Button variant="outline" size="sm" onClick={newChat} disabled={busy}>
            <Plus /> New chat
          </Button>
        </div>
      </div>

      <div className="flex-1 space-y-5 py-5">
        {messages.length === 0 && (
          <div className="space-y-4 pt-4">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Sparkles className="size-5 text-primary" /> Ask me anything about what to wear, what&apos;s in, or what to buy.
            </div>
            {wardrobe.length === 0 && (
              <p className="rounded-xl bg-accent/60 p-3 text-sm">
                Your closet is empty, so I can only suggest things to buy. <Link href="/upload" className="font-medium text-primary underline">Upload a few photos</Link> first for outfits from your own clothes.
              </p>
            )}
            <div className="flex flex-wrap gap-2">
              {STARTERS.map((s) => (
                <button key={s} onClick={() => send(s)} className="rounded-2xl border bg-white px-3 py-2 text-left text-sm hover:bg-accent">
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m) =>
          m.role === "user" ? (
            <div key={m.id} className="flex justify-end">
              <p className="max-w-[85%] rounded-2xl rounded-br-md bg-primary px-4 py-2.5 text-sm text-primary-foreground">{m.content}</p>
            </div>
          ) : (
            <AssistantMessage key={m.id} m={m} wardrobe={wardrobe} onChip={send} />
          )
        )}
        <div ref={bottom} />
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
        className="sticky bottom-24 flex items-end gap-2 rounded-2xl border bg-white p-2 shadow-md md:bottom-4"
      >
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send(input);
            }
          }}
          rows={1}
          placeholder="Date night tomorrow, it's raining…"
          className="max-h-32 min-h-10 flex-1 resize-none bg-transparent px-2 py-2 text-base outline-none md:text-sm"
          aria-label="Message your stylist"
        />
        <Button type="submit" size="icon" disabled={busy || !input.trim()} aria-label="Send">
          {busy ? <Loader2 className="animate-spin" /> : <ArrowUp />}
        </Button>
      </form>
    </div>
  );
}

function AssistantMessage({ m, wardrobe, onChip }: { m: Msg; wardrobe: Item[]; onChip: (s: string) => void }) {
  const c = m.cards;
  return (
    <div className="space-y-3">
      {m.steps && m.steps.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {m.steps.map((s, i) => {
            const active = m.pending && i === m.steps!.length - 1;
            return (
              <span key={s} className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs", active ? "bg-trend/30 text-trend-foreground" : "bg-muted text-muted-foreground")}>
                {active ? <Loader2 className="size-3 animate-spin" /> : <Check className="size-3" />} {s}
              </span>
            );
          })}
        </div>
      )}
      {m.pending && !m.steps?.length && (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin text-primary" /> Thinking…
        </p>
      )}

      {m.content && (
        <div className={cn("prose-sm max-w-[95%] rounded-2xl rounded-bl-md bg-card px-4 py-3 text-sm leading-relaxed shadow-sm [&_p]:my-1.5 [&_ul]:my-1.5 [&_ul]:list-disc [&_ul]:pl-5 [&_strong]:font-semibold", m.error && "text-destructive")}>
          <ReactMarkdown>{m.content}</ReactMarkdown>
        </div>
      )}

      {c?.items?.length ? (
        <section className="space-y-2">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">From your wardrobe</h3>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {c.items.map((it) => (
              <Link key={it.id} href={`/item/${it.id}`} className="w-28 shrink-0">
                <ItemImage item={it} sizes="112px" />
                <p className="mt-1 line-clamp-2 text-[11px] leading-snug text-foreground/80">{it.description}</p>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      {c?.outfits?.length ? (
        <section className="space-y-2">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Outfits</h3>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {c.outfits.map((o) => (
              <OutfitCard key={o.key} outfit={o} source="agent" />
            ))}
          </div>
        </section>
      ) : null}

      {c?.buys?.length ? (
        <section className="space-y-2">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">To buy</h3>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {c.buys.map((b, i) => (
              <BuyCard key={i} card={b} wardrobe={wardrobe} />
            ))}
          </div>
        </section>
      ) : null}

      {c?.sources?.length ? (
        <p className="text-[11px] leading-relaxed text-muted-foreground">
          Sources:{" "}
          {c.sources.map((s, i) => (
            <span key={s.url}>
              <a href={s.url} target="_blank" rel="noopener noreferrer" className="underline decoration-dotted underline-offset-2 hover:text-foreground">
                {s.title}
              </a>
              {i < c.sources.length - 1 ? " · " : ""}
            </span>
          ))}
        </p>
      ) : null}

      {c?.chips?.length ? (
        <div className="flex flex-wrap gap-1.5">
          {c.chips.map((chip) => (
            <button key={chip} onClick={() => onChip(chip)} className="rounded-full border border-primary/40 bg-white px-3 py-1 text-xs text-primary hover:bg-accent">
              {chip}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
