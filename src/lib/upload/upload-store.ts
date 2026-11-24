"use client";

import { useEffect, useState } from "react";
import { create } from "zustand";
import { toast } from "sonner";
import { compressImage } from "@/lib/image/compress";
import { mockAnalyzeImage } from "@/lib/ai/mock-vision";
import { persistWardrobeImage } from "@/services/storage-service";
import { useWardrobeStore } from "@/store/wardrobe-store";
import { uid } from "@/lib/utils";
import {
  AnalysisScheduler,
  type BatchResponse,
  type EstimateReason,
  type JobOutcome,
  type SchedulerSnapshot,
} from "./analysis-scheduler";
import { visionToForm } from "./vision-to-form";
import type { WardrobeItemInput } from "@/types/wardrobe";

// Gemini's free tier allows 5 requests/min per model; stay under it and let
// each request carry several photos. Both can be tuned without code changes.
const REQUESTS_PER_MINUTE = Number(process.env.NEXT_PUBLIC_AI_REQUESTS_PER_MINUTE) || 4;
const IMAGES_PER_REQUEST = Number(process.env.NEXT_PUBLIC_AI_IMAGES_PER_REQUEST) || 4;
const MAX_PHOTOS_PER_DROP = 60;
const PREPARE_CONCURRENCY = 3;

async function sendBatchToApi(items: { dataUrl: string; fileName: string }[]): Promise<BatchResponse> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 75_000);
  try {
    const res = await fetch("/api/analyze-image", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ images: items }),
      signal: controller.signal,
    });
    const data = await res.json().catch(() => null);
    const retryHeader = Number(res.headers.get("retry-after"));
    const retryAfterSeconds = data?.retryAfterSeconds ?? (retryHeader || 10);

    if (res.status === 429) {
      return { kind: "rate-limited", scope: data?.scope ?? "unknown", retryAfterSeconds };
    }
    if (res.status === 503) return { kind: "busy", retryAfterSeconds };
    if (!res.ok || !data) return { kind: "error", message: data?.error ?? `HTTP ${res.status}` };
    return { kind: "ok", provider: data.provider, results: data.results };
  } catch (err) {
    return { kind: "error", message: err instanceof Error ? err.message : "Network error" };
  } finally {
    clearTimeout(timeout);
  }
}

let scheduler: AnalysisScheduler | null = null;

export function getScheduler(): AnalysisScheduler {
  if (!scheduler) {
    scheduler = new AnalysisScheduler({
      requestsPerWindow: REQUESTS_PER_MINUTE,
      windowMs: 60_000,
      imagesPerRequest: IMAGES_PER_REQUEST,
      maxAttempts: 3,
      sendBatch: sendBatchToApi,
      makeEstimate: ({ fileName, dataUrl }) =>
        mockAnalyzeImage(fileName, Math.floor(dataUrl.length * 0.75)),
    });
  }
  return scheduler;
}

/** Single-photo analysis (the Add item dialog) shares the same queue, so it
 *  respects the same limits and simply waits its turn instead of failing. */
export function analyzeSingle(dataUrl: string, fileName: string): Promise<JobOutcome> {
  return getScheduler().enqueue({ id: uid(), dataUrl, fileName, urgent: true });
}

export function useSchedulerSnapshot(active: boolean): SchedulerSnapshot | null {
  const [snapshot, setSnapshot] = useState<SchedulerSnapshot | null>(null);
  useEffect(() => {
    const s = getScheduler();
    const update = () => setSnapshot(s.getSnapshot());
    update();
    const unsubscribe = s.subscribe(update);
    const interval = active ? setInterval(update, 1000) : null;
    return () => {
      unsubscribe();
      if (interval) clearInterval(interval);
    };
  }, [active]);
  return snapshot;
}

export type UploadStatus = "preparing" | "analyzing" | "ready" | "failed" | "saving" | "saved";

export interface UploadItem {
  id: string;
  fileName: string;
  previewUrl: string | null;
  status: UploadStatus;
  form: WardrobeItemInput | null;
  /** True when AI couldn't analyze the photo and the details are a rough guess. */
  estimated: boolean;
  estimateReason?: EstimateReason;
  error?: string;
}

interface UploadState {
  items: UploadItem[];
  expanded: boolean;
  reviewOpen: boolean;
  addFiles: (files: File[]) => void;
  updateForm: (id: string, patch: Partial<WardrobeItemInput>) => void;
  removeItem: (id: string) => void;
  setExpanded: (expanded: boolean) => void;
  setReviewOpen: (open: boolean) => void;
  saveAll: (userId: string) => Promise<void>;
  clearAll: () => void;
}

export const useUploadStore = create<UploadState>((set, get) => {
  const patchItem = (id: string, patch: Partial<UploadItem>) =>
    set({ items: get().items.map((i) => (i.id === id ? { ...i, ...patch } : i)) });

  async function prepare(id: string, file: File) {
    let dataUrl: string;
    try {
      dataUrl = await compressImage(file);
    } catch {
      patchItem(id, {
        status: "failed",
        error: "Couldn't read this photo. HEIC files may need to be converted to JPEG first.",
      });
      return;
    }
    if (!get().items.some((i) => i.id === id)) return;
    patchItem(id, { previewUrl: dataUrl, status: "analyzing" });

    void getScheduler()
      .enqueue({ id, dataUrl, fileName: file.name })
      .then((outcome) => {
        if (!get().items.some((i) => i.id === id)) return;
        patchItem(id, {
          status: "ready",
          form: visionToForm(outcome.result, dataUrl),
          estimated: outcome.isMock,
          estimateReason: outcome.estimateReason,
        });
      });
  }

  return {
    items: [],
    expanded: true,
    reviewOpen: false,
    addFiles: (files) => {
      const images = files.filter((f) => f.type.startsWith("image/"));
      if (images.length === 0) {
        toast.error("Those files aren't images.");
        return;
      }
      const accepted = images.slice(0, MAX_PHOTOS_PER_DROP);
      if (images.length > accepted.length) {
        toast.info(`Added the first ${MAX_PHOTOS_PER_DROP} photos. You can add more afterwards.`);
      }

      const entries = accepted.map((file) => ({ id: uid(), file }));
      set({
        expanded: true,
        items: [
          ...get().items,
          ...entries.map(
            ({ id, file }): UploadItem => ({
              id,
              fileName: file.name,
              previewUrl: null,
              status: "preparing",
              form: null,
              estimated: false,
            })
          ),
        ],
      });

      const queue = [...entries];
      const worker = async () => {
        for (let next = queue.shift(); next; next = queue.shift()) {
          await prepare(next.id, next.file);
        }
      };
      void Promise.all(Array.from({ length: PREPARE_CONCURRENCY }, worker));
    },

    updateForm: (id, patch) =>
      set({
        items: get().items.map((i) =>
          i.id === id && i.form ? { ...i, form: { ...i.form, ...patch } } : i
        ),
      }),

    removeItem: (id) => {
      getScheduler().cancel(id);
      set({ items: get().items.filter((i) => i.id !== id) });
    },

    setExpanded: (expanded) => set({ expanded }),
    setReviewOpen: (open) => set({ reviewOpen: open }),

    saveAll: async (userId) => {
      const targets = get().items.filter((i) => i.status === "ready" && i.form);
      if (targets.length === 0) return;
      targets.forEach((t) => patchItem(t.id, { status: "saving" }));

      let saved = 0;
      let failed = 0;
      const queue = [...targets];
      const worker = async () => {
        for (let next = queue.shift(); next; next = queue.shift()) {
          try {
            const imageUrl = next.previewUrl
              ? await persistWardrobeImage(userId, next.previewUrl)
              : null;
            await useWardrobeStore.getState().addItem(userId, { ...next.form!, imageUrl });
            patchItem(next.id, { status: "saved" });
            saved++;
          } catch (err) {
            console.error("[upload] failed to save item", err);
            patchItem(next.id, { status: "ready", error: "Couldn't save this one. Try again." });
            failed++;
          }
        }
      };
      await Promise.all(Array.from({ length: 3 }, worker));

      if (saved > 0) toast.success(`Added ${saved} item${saved === 1 ? "" : "s"} to your wardrobe`);
      if (failed > 0) toast.error(`${failed} item${failed === 1 ? "" : "s"} couldn't be saved.`);
      if (get().items.every((i) => i.status === "saved")) {
        set({ items: [], reviewOpen: false });
      } else {
        set({ items: get().items.filter((i) => i.status !== "saved") });
      }
    },

    clearAll: () => {
      get().items.forEach((i) => getScheduler().cancel(i.id));
      set({ items: [], reviewOpen: false });
    },
  };
});
