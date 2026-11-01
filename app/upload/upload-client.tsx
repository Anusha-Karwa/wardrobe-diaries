"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import imageCompression from "browser-image-compression";
import { Camera, ImagePlus, Loader2, ScanSearch, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ReviewCard } from "@/components/review-card";
import { browserCutout, switchToCrop } from "@/lib/client/bg-removal";
import type { Item, Upload, UploadedItem } from "@/lib/types";
import { cn, labelize } from "@/lib/utils";

interface Group {
  key: string;
  fileName: string;
  previewUrl: string;
  status: "queued" | "uploading" | "done" | "error";
  error?: string;
  upload?: Upload;
  photoType?: string;
  items: Item[];
  timings?: Record<string, number>;
}

const LOADING_COPY = ["Finding every item…", "Reading the fabric…", "Cutting out your clothes…", "Matching colours to the palette…", "Checking necklines and sleeves…"];

export function UploadClient() {
  const [groups, setGroups] = useState<Group[]>([]);
  const [debug, setDebug] = useState(false);
  const [cutoutStatus, setCutoutStatus] = useState<Record<string, string>>({});
  const [copyIdx, setCopyIdx] = useState(0);
  const [dragging, setDragging] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const cameraInput = useRef<HTMLInputElement>(null);
  const running = useRef(false);
  const cutoutQueue = useRef<Item[]>([]);
  const cutoutRunning = useRef(false);

  const busy = groups.some((g) => g.status === "queued" || g.status === "uploading");
  useEffect(() => {
    if (!busy) return;
    const t = setInterval(() => setCopyIdx((i) => (i + 1) % LOADING_COPY.length), 2200);
    return () => clearInterval(t);
  }, [busy]);

  const patchGroup = (key: string, patch: Partial<Group>) =>
    setGroups((gs) => gs.map((g) => (g.key === key ? { ...g, ...patch } : g)));

  const replaceItem = useCallback((updated: Item) => {
    setGroups((gs) => gs.map((g) => ({ ...g, items: g.items.map((i) => (i.id === updated.id ? updated : i)) })));
  }, []);

  // ---- Stage 5: browser cutouts, one at a time (the model is heavy) ----
  const runCutoutQueue = useCallback(async () => {
    if (cutoutRunning.current) return;
    cutoutRunning.current = true;
    while (cutoutQueue.current.length) {
      const item = cutoutQueue.current.shift()!;
      // The model can emit late progress events after it finishes; ignore them once we're done.
      let finished = false;
      const setStatus = (s: string | null) => {
        if (finished && s) return;
        if (!s) finished = true;
        setCutoutStatus((m) => {
          const n = { ...m };
          if (s) n[item.id] = s;
          else delete n[item.id];
          return n;
        });
      };
      setStatus("Cleaning up background…");
      try {
        replaceItem(await browserCutout(item, setStatus));
      } catch (err) {
        console.warn("browser cutout failed", err);
        try {
          replaceItem(await switchToCrop(item.id));
          toast("Used the photo crop for one item", { description: "Background removal didn't work for it." });
        } catch {
          /* leave as is */
        }
      }
      setStatus(null);
    }
    cutoutRunning.current = false;
  }, [replaceItem]);

  const queueCutout = useCallback(
    (item: Item) => {
      if (!cutoutQueue.current.some((i) => i.id === item.id)) cutoutQueue.current.push(item);
      runCutoutQueue();
    },
    [runCutoutQueue]
  );

  // ---- Stage 0: compress + upload one photo per request ----
  const processQueue = useCallback(
    async (queue: { key: string; file: File }[]) => {
      if (running.current) return;
      running.current = true;
      for (const { key, file } of queue) {
        patchGroup(key, { status: "uploading" });
        try {
          const compressed = await imageCompression(file, {
            maxWidthOrHeight: 1600,
            maxSizeMB: 1,
            useWebWorker: true,
            fileType: "image/jpeg",
            initialQuality: 0.88,
          });
          const form = new FormData();
          form.append("file", compressed, file.name.replace(/\.\w+$/, "") + ".jpg");
          const res = await fetch("/api/upload", { method: "POST", body: form });
          const body = await res.json().catch(() => ({ error: `Server error (${res.status})` }));
          if (!res.ok) throw new Error(body.error ?? "Upload failed");
          const items = body.items as UploadedItem[];
          patchGroup(key, { status: "done", upload: body.upload, photoType: body.photoType, items, timings: body.timings });
          if (!items.length) toast("No clothes found in that photo", { description: file.name });
          items.filter((i) => i.needs_client_cutout).forEach(queueCutout);
        } catch (err) {
          patchGroup(key, { status: "error", error: (err as Error).message });
        }
      }
      running.current = false;
    },
    [queueCutout]
  );

  function addFiles(list: FileList | File[] | null) {
    const files = Array.from(list ?? []).filter((f) => f.type.startsWith("image/") || /\.(heic|heif)$/i.test(f.name));
    if (!files.length) return;
    const fresh = files.map((file) => ({
      key: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      file,
    }));
    setGroups((gs) => [
      ...fresh.map((f) => ({
        key: f.key,
        fileName: f.file.name,
        previewUrl: URL.createObjectURL(f.file),
        status: "queued" as const,
        items: [],
      })),
      ...gs,
    ]);
    // Process in the order picked; if a batch is already running, chain after it.
    const wait = async () => {
      while (running.current) await new Promise((r) => setTimeout(r, 300));
      processQueue(fresh);
    };
    wait();
  }

  const total = groups.length;
  const doneCount = groups.filter((g) => g.status === "done" || g.status === "error").length;
  const current = groups.filter((g) => g.status !== "queued").length;
  const itemCount = groups.reduce((n, g) => n + g.items.length, 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold">Add to your closet</h1>
        <p className="mt-1 text-muted-foreground">Flat lays, hanger shots or mirror selfies. Closet finds every item, cuts it out and tags it.</p>
      </div>

      {/* Stage 0: picker / drop zone */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          addFiles(e.dataTransfer.files);
        }}
        className={cn(
          "flex flex-col items-center gap-4 rounded-2xl border-2 border-dashed bg-white px-4 py-8 text-center transition-colors",
          dragging ? "border-primary bg-accent" : "border-border"
        )}
      >
        <ImagePlus className="size-8 text-primary" />
        <div>
          <p className="font-medium">Drop photos here</p>
          <p className="text-sm text-muted-foreground">or pick several at once</p>
        </div>
        <div className="flex flex-wrap justify-center gap-2">
          <Button onClick={() => fileInput.current?.click()}>
            <ImagePlus /> Choose photos
          </Button>
          <Button variant="outline" onClick={() => cameraInput.current?.click()}>
            <Camera /> Take photo
          </Button>
        </div>
        <input ref={fileInput} type="file" accept="image/*" multiple hidden onChange={(e) => (addFiles(e.target.files), (e.target.value = ""))} />
        <input ref={cameraInput} type="file" accept="image/*" capture="environment" hidden onChange={(e) => (addFiles(e.target.files), (e.target.value = ""))} />
      </div>

      {total > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">
            {busy ? (
              <span className="inline-flex items-center gap-2 text-foreground">
                <Loader2 className="size-4 animate-spin text-primary" />
                Analysing {Math.min(current, total)} of {total}… <span className="text-muted-foreground">{LOADING_COPY[copyIdx]}</span>
              </span>
            ) : (
              <>
                {doneCount} photo{doneCount === 1 ? "" : "s"} · {itemCount} item{itemCount === 1 ? "" : "s"} added. Review them below.
              </>
            )}
          </p>
          <Button variant={debug ? "default" : "outline"} size="sm" onClick={() => setDebug((d) => !d)}>
            <ScanSearch /> Debug boxes
          </Button>
        </div>
      )}

      {groups.map((g) => (
        <section key={g.key} className="space-y-3">
          <div className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={g.previewUrl} alt="" className="size-12 rounded-lg object-cover" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{g.fileName}</p>
              <p className="text-xs text-muted-foreground">
                {g.status === "queued" && "Waiting…"}
                {g.status === "uploading" && "Analysing…"}
                {g.status === "error" && <span className="text-destructive">{g.error}</span>}
                {g.status === "done" &&
                  `${g.items.length} item${g.items.length === 1 ? "" : "s"} · ${labelize(g.photoType)}${g.timings ? ` · ${(g.timings.total / 1000).toFixed(1)}s` : ""}`}
              </p>
            </div>
            {g.status === "error" && (
              <button onClick={() => setGroups((gs) => gs.filter((x) => x.key !== g.key))} aria-label="Dismiss">
                <X className="size-4 text-muted-foreground" />
              </button>
            )}
          </div>

          {debug && g.upload && <DebugBoxes upload={g.upload} items={g.items} timings={g.timings} />}

          {g.status === "uploading" && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {[0, 1].map((i) => (
                <div key={i} className="h-96 animate-pulse rounded-2xl bg-muted" />
              ))}
            </div>
          )}

          {g.items.length > 0 && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {g.items.map((item) => (
                <ReviewCard
                  key={item.id}
                  item={item}
                  cutoutStatus={cutoutStatus[item.id]}
                  onChange={replaceItem}
                  onDeleted={(id) =>
                    setGroups((gs) => gs.map((x) => (x.key === g.key ? { ...x, items: x.items.filter((i) => i.id !== id) } : x)))
                  }
                  onRedoCutout={queueCutout}
                  onUseCrop={async (it) => {
                    try {
                      replaceItem(await switchToCrop(it.id));
                    } catch (err) {
                      toast.error((err as Error).message);
                    }
                  }}
                />
              ))}
            </div>
          )}
        </section>
      ))}
    </div>
  );
}

/** Debug view: detected boxes drawn over the original photo, plus stage timings. */
function DebugBoxes({ upload, items, timings }: { upload: Upload; items: Item[]; timings?: Record<string, number> }) {
  const ratio = upload.width && upload.height ? upload.width / upload.height : 1;
  return (
    <div className="space-y-2 rounded-2xl border bg-white p-3">
      <div className="relative mx-auto w-full max-w-xl" style={{ aspectRatio: ratio }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={upload.original_url} alt="Original upload" className="absolute inset-0 size-full rounded-lg object-cover" />
        {items.map((it, i) =>
          it.bbox ? (
            <div
              key={it.id}
              className="absolute rounded-sm border-2 border-primary"
              style={{ left: `${it.bbox.x * 100}%`, top: `${it.bbox.y * 100}%`, width: `${it.bbox.w * 100}%`, height: `${it.bbox.h * 100}%` }}
            >
              <span className="absolute -top-5 left-0 whitespace-nowrap rounded bg-primary px-1 text-[10px] text-primary-foreground">
                {i + 1}. {labelize(it.subcategory)} · {Math.round((it.confidence ?? 0) * 100)}%
              </span>
            </div>
          ) : null
        )}
      </div>
      {timings && (
        <p className="text-center font-mono text-[11px] text-muted-foreground">
          {Object.entries(timings)
            .map(([k, v]) => `${k} ${(v / 1000).toFixed(1)}s`)
            .join(" · ")}
        </p>
      )}
    </div>
  );
}
