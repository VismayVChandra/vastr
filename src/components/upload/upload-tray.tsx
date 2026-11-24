"use client";

import { useEffect } from "react";
import { AlertCircle, CheckCircle2, ChevronDown, ChevronUp, Clock, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { formatCountdown, formatEta } from "@/lib/upload/format";
import { useSchedulerSnapshot, useUploadStore, type UploadItem } from "@/lib/upload/upload-store";

const FINISHED = ["ready", "failed", "saving", "saved"];

export function UploadTray() {
  const items = useUploadStore((s) => s.items);
  const expanded = useUploadStore((s) => s.expanded);
  const setExpanded = useUploadStore((s) => s.setExpanded);
  const setReviewOpen = useUploadStore((s) => s.setReviewOpen);
  const removeItem = useUploadStore((s) => s.removeItem);
  const clearAll = useUploadStore((s) => s.clearAll);

  const total = items.length;
  const analyzed = items.filter((i) => FINISHED.includes(i.status)).length;
  const preparing = items.filter((i) => i.status === "preparing").length;
  const active = items.some((i) => i.status === "preparing" || i.status === "analyzing");
  const saving = items.some((i) => i.status === "saving");
  const readyItems = items.filter((i) => i.status === "ready");
  const needCheck = readyItems.filter((i) => i.estimated).length;
  const hitDailyLimit = items.some((i) => i.estimateReason === "daily-limit");

  const snapshot = useSchedulerSnapshot(active);

  useEffect(() => {
    if (!active) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [active]);

  if (total === 0) return null;

  const paused =
    snapshot?.pausedUntil && snapshot.pauseReason ? snapshot.pausedUntil - snapshot.now : null;
  const etaMs = snapshot?.etaMs != null ? snapshot.etaMs + preparing * 500 : null;

  let title: string;
  let subtitle: string;
  if (active) {
    title = `Analyzing ${analyzed} of ${total}`;
    const left = etaMs != null ? `${formatEta(etaMs)} left` : "Getting started…";
    subtitle = paused
      ? `Waiting for AI capacity · continuing in ${formatCountdown(paused)} · ${left}`
      : left;
  } else if (saving) {
    title = "Adding to your wardrobe…";
    subtitle = "Almost there";
  } else {
    title = `${readyItems.length} photo${readyItems.length === 1 ? "" : "s"} ready`;
    subtitle =
      needCheck > 0
        ? `${needCheck} need${needCheck === 1 ? "s" : ""} a quick check`
        : "Review and add them to your wardrobe";
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-x-3 bottom-[4.75rem] z-40 rounded-2xl border border-border bg-card shadow-xl sm:left-auto sm:w-96 lg:bottom-6 lg:right-6"
    >
      <div className="flex items-center gap-3 px-4 py-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{title}</p>
          <p className="truncate text-xs text-muted-foreground">{subtitle}</p>
        </div>
        <button
          onClick={() => setExpanded(!expanded)}
          className="rounded-full p-1.5 text-muted-foreground hover:bg-secondary"
          aria-label={expanded ? "Collapse" : "Expand"}
        >
          {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
        </button>
        {!active && !saving && (
          <button
            onClick={() => {
              if (readyItems.length === 0 || window.confirm("Discard these photos without adding them?")) {
                clearAll();
              }
            }}
            className="rounded-full p-1.5 text-muted-foreground hover:bg-secondary"
            aria-label="Discard"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      <div className="px-4 pb-3">
        <Progress value={total ? (analyzed / total) * 100 : 0} className="h-1.5" />
      </div>

      {expanded && (
        <>
          {hitDailyLimit && (
            <p className="mx-4 mb-3 rounded-lg bg-accent/10 px-3 py-2 text-xs text-foreground">
              Today&apos;s free AI limit is used up, so some photos got offline estimates. Please
              check those in the review step.
            </p>
          )}
          <ul className="max-h-60 space-y-1 overflow-y-auto px-2 pb-2">
            {items.map((item) => (
              <TrayRow
                key={item.id}
                item={item}
                paused={Boolean(paused)}
                onRemove={() => removeItem(item.id)}
              />
            ))}
          </ul>
          {!active && !saving && readyItems.length > 0 && (
            <div className="border-t border-border p-3">
              <Button className="w-full" onClick={() => setReviewOpen(true)}>
                Review &amp; add {readyItems.length}
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function TrayRow({
  item,
  paused,
  onRemove,
}: {
  item: UploadItem;
  paused: boolean;
  onRemove: () => void;
}) {
  const label = (() => {
    switch (item.status) {
      case "preparing":
        return "Preparing…";
      case "analyzing":
        return paused ? "Waiting for AI capacity" : "Analyzing…";
      case "ready":
        return item.estimated ? "Estimated, please check" : "Ready";
      case "saving":
        return "Adding…";
      case "saved":
        return "Added";
      case "failed":
        return item.error ?? "Couldn't read this photo";
    }
  })();

  return (
    <li className="group flex items-center gap-3 rounded-xl px-2 py-1.5 hover:bg-secondary/60">
      <div className="h-10 w-10 shrink-0 overflow-hidden rounded-lg bg-secondary">
        {item.previewUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={item.previewUrl} alt="" className="h-full w-full object-cover" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm">{item.form?.name || item.fileName}</p>
        <p className={cn("truncate text-xs", item.status === "failed" ? "text-destructive" : "text-muted-foreground")}>
          {label}
        </p>
      </div>
      <StatusIcon item={item} paused={paused} />
      {item.status !== "saving" && item.status !== "saved" && (
        <button
          onClick={onRemove}
          className="rounded-full p-1 text-muted-foreground opacity-0 transition-opacity hover:bg-secondary group-hover:opacity-100 focus:opacity-100"
          aria-label={`Remove ${item.fileName}`}
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </li>
  );
}

function StatusIcon({ item, paused }: { item: UploadItem; paused: boolean }) {
  if (item.status === "preparing" || item.status === "saving") {
    return <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />;
  }
  if (item.status === "analyzing") {
    return paused ? (
      <Clock className="h-4 w-4 text-muted-foreground" />
    ) : (
      <Loader2 className="h-4 w-4 animate-spin text-accent" />
    );
  }
  if (item.status === "failed") return <AlertCircle className="h-4 w-4 text-destructive" />;
  if (item.status === "ready" && item.estimated) return <AlertCircle className="h-4 w-4 text-accent" />;
  return <CheckCircle2 className="h-4 w-4 text-success" />;
}
