import type { AIVisionResult } from "@/types/wardrobe";

export type BatchResult = { ok: true; result: AIVisionResult; isMock: boolean } | { ok: false };

export type BatchResponse =
  | { kind: "ok"; provider: "gemini" | "anthropic" | "none"; results: BatchResult[] }
  | { kind: "rate-limited"; scope: "minute" | "day" | "unknown"; retryAfterSeconds: number }
  | { kind: "busy"; retryAfterSeconds: number }
  | { kind: "error"; message: string };

export type EstimateReason = "no-provider" | "failed" | "daily-limit";

/** Every job resolves (never rejects). When AI couldn't help, `isMock` is true
 *  and `estimateReason` says why, so the UI can ask the user to double-check. */
export interface JobOutcome {
  result: AIVisionResult;
  isMock: boolean;
  estimateReason?: EstimateReason;
}

export interface SchedulerOptions {
  /** Max provider requests started in any `windowMs` window. */
  requestsPerWindow: number;
  windowMs: number;
  /** Photos packed into one provider request. */
  imagesPerRequest: number;
  maxAttempts: number;
  /** How long a partial batch waits for more photos to join before being sent. */
  gatherMs?: number;
  sendBatch: (items: { dataUrl: string; fileName: string }[]) => Promise<BatchResponse>;
  makeEstimate: (job: { dataUrl: string; fileName: string }) => AIVisionResult;
  now?: () => number;
  setTimer?: (fn: () => void, ms: number) => unknown;
  clearTimer?: (handle: unknown) => void;
}

export type PauseReason = "rate-limit" | "busy" | null;

export interface SchedulerSnapshot {
  /** The scheduler's clock at the moment the snapshot was taken. */
  now: number;
  waiting: number;
  sending: number;
  pausedUntil: number | null;
  pauseReason: PauseReason;
  /** Estimated time until every queued photo is analyzed; null when idle. */
  etaMs: number | null;
  dailyLimitUntil: number | null;
}

const DEFAULT_LATENCY_MS = 7000;
const DAILY_LIMIT_BACKOFF_MS = 30 * 60 * 1000;
const MAX_PAUSE_MS = 60_000;
const BUSY_MAX_PAUSE_MS = 30_000;

const DEFAULT_GATHER_MS = 1200;

interface Job {
  id: string;
  dataUrl: string;
  fileName: string;
  /** Skip the gather delay (a single photo the user is waiting on). */
  urgent: boolean;
  attempts: number;
  resolve: (outcome: JobOutcome) => void;
}

/** Simulates the sliding-window limiter forward to predict when the last
 *  waiting photo will have been sent and answered. */
export function estimateRemainingMs(p: {
  now: number;
  waitingJobs: number;
  inflightJobs: number;
  imagesPerRequest: number;
  limit: number;
  windowMs: number;
  sentTimestamps: number[];
  pausedUntil: number;
  avgLatencyMs: number;
  unlimited: boolean;
}): number {
  const requests = Math.ceil(p.waitingJobs / p.imagesPerRequest);
  const inflightMs = p.inflightJobs > 0 ? p.avgLatencyMs : 0;
  if (requests === 0) return inflightMs;
  if (p.unlimited) return p.avgLatencyMs * Math.ceil(requests / 3);

  let t = Math.max(p.now, p.pausedUntil);
  const active = [...p.sentTimestamps].sort((a, b) => a - b);
  let lastStart = t;
  for (let r = 0; r < requests; r++) {
    for (;;) {
      while (active.length > 0 && active[0] + p.windowMs <= t) active.shift();
      if (active.length < p.limit) {
        active.push(t);
        lastStart = t;
        break;
      }
      t = active[0] + p.windowMs;
    }
  }
  return Math.max(lastStart - p.now + p.avgLatencyMs, inflightMs);
}

export class AnalysisScheduler {
  private opts: SchedulerOptions;
  private now: () => number;
  private setTimer: (fn: () => void, ms: number) => unknown;
  private clearTimer: (handle: unknown) => void;

  private waiting: Job[] = [];
  private inflightJobs = 0;
  private sent: number[] = [];
  private pausedUntil = 0;
  private pauseReason: PauseReason = null;
  private effectiveLimit: number;
  private lastThrottleAt = 0;
  private throttleHits = 0;
  private unlimited = false;
  private dailyLimitUntil = 0;
  private latencies: number[] = [];
  private timer: unknown = null;
  private lastEnqueueAt = 0;
  private listeners = new Set<() => void>();

  constructor(opts: SchedulerOptions) {
    this.opts = opts;
    this.now = opts.now ?? (() => Date.now());
    this.setTimer = opts.setTimer ?? ((fn, ms) => setTimeout(fn, ms));
    this.clearTimer = opts.clearTimer ?? ((h) => clearTimeout(h as ReturnType<typeof setTimeout>));
    this.effectiveLimit = opts.requestsPerWindow;
  }

  enqueue(job: {
    id: string;
    dataUrl: string;
    fileName: string;
    urgent?: boolean;
  }): Promise<JobOutcome> {
    return new Promise((resolve) => {
      const t = this.now();
      if (t < this.dailyLimitUntil) {
        resolve(this.estimate(job, "daily-limit"));
        return;
      }
      this.lastEnqueueAt = t;
      this.waiting.push({
        id: job.id,
        dataUrl: job.dataUrl,
        fileName: job.fileName,
        urgent: job.urgent ?? false,
        attempts: 0,
        resolve,
      });
      this.pump();
    });
  }

  /** Removes a photo that hasn't been sent yet (e.g. the user removed it). */
  cancel(id: string) {
    const index = this.waiting.findIndex((j) => j.id === id);
    if (index === -1) return;
    const [job] = this.waiting.splice(index, 1);
    job.resolve(this.estimate(job, "failed"));
    this.emit();
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  getSnapshot(): SchedulerSnapshot {
    const t = this.now();
    const active = this.waiting.length > 0 || this.inflightJobs > 0;
    return {
      now: t,
      waiting: this.waiting.length,
      sending: this.inflightJobs,
      pausedUntil: t < this.pausedUntil ? this.pausedUntil : null,
      pauseReason: t < this.pausedUntil ? this.pauseReason : null,
      dailyLimitUntil: t < this.dailyLimitUntil ? this.dailyLimitUntil : null,
      etaMs: active
        ? estimateRemainingMs({
            now: t,
            waitingJobs: this.waiting.length,
            inflightJobs: this.inflightJobs,
            imagesPerRequest: this.opts.imagesPerRequest,
            limit: this.unlimited ? Number.POSITIVE_INFINITY : this.effectiveLimit,
            windowMs: this.opts.windowMs,
            sentTimestamps: this.sent.filter((ts) => ts + this.opts.windowMs > t),
            pausedUntil: this.pausedUntil,
            avgLatencyMs: this.averageLatency(),
            unlimited: this.unlimited,
          })
        : null,
    };
  }

  private estimate(job: { dataUrl: string; fileName: string }, reason: EstimateReason): JobOutcome {
    return { result: this.opts.makeEstimate(job), isMock: true, estimateReason: reason };
  }

  private averageLatency(): number {
    if (this.latencies.length === 0) return DEFAULT_LATENCY_MS;
    return this.latencies.reduce((a, b) => a + b, 0) / this.latencies.length;
  }

  private emit() {
    this.listeners.forEach((l) => l());
  }

  private schedule(ms: number) {
    this.timer = this.setTimer(() => {
      this.timer = null;
      this.pump();
    }, ms);
  }

  private pump() {
    if (this.timer !== null) {
      this.clearTimer(this.timer);
      this.timer = null;
    }
    const t = this.now();
    this.sent = this.sent.filter((ts) => ts + this.opts.windowMs > t);

    if (t < this.dailyLimitUntil) {
      this.flushWaiting("daily-limit");
      this.emit();
      return;
    }
    if (t < this.pausedUntil) {
      this.schedule(this.pausedUntil - t);
      this.emit();
      return;
    }
    this.pauseReason = null;

    const limit = this.unlimited ? Number.POSITIVE_INFINITY : this.effectiveLimit;
    const gatherMs = this.opts.gatherMs ?? DEFAULT_GATHER_MS;
    let holdMs = 0;

    while (this.waiting.length > 0 && this.sent.length < limit) {
      const full = this.waiting.length >= this.opts.imagesPerRequest;
      const sendNow =
        full ||
        this.waiting.some((j) => j.urgent || j.attempts > 0) ||
        t - this.lastEnqueueAt >= gatherMs;
      if (!sendNow) {
        // Photos are still arriving; let them join this batch instead of
        // spending a request slot on a single photo.
        holdMs = gatherMs - (t - this.lastEnqueueAt);
        break;
      }
      const batch = this.waiting.splice(0, this.opts.imagesPerRequest);
      this.sent.push(t);
      void this.dispatch(batch, t);
    }

    if (holdMs > 0) {
      this.schedule(holdMs);
    } else if (this.waiting.length > 0 && this.sent.length > 0) {
      this.schedule(Math.max(this.sent[0] + this.opts.windowMs - t, 50));
    }
    this.emit();
  }

  private async dispatch(batch: Job[], startedAt: number) {
    this.inflightJobs += batch.length;
    let response: BatchResponse;
    try {
      response = await this.opts.sendBatch(
        batch.map((j) => ({ dataUrl: j.dataUrl, fileName: j.fileName }))
      );
    } catch (err) {
      response = { kind: "error", message: err instanceof Error ? err.message : String(err) };
    }
    this.inflightJobs -= batch.length;
    this.handle(response, batch, startedAt);
    this.pump();
  }

  private handle(response: BatchResponse, batch: Job[], startedAt: number) {
    const t = this.now();

    switch (response.kind) {
      case "ok": {
        this.latencies = [...this.latencies, t - startedAt].slice(-5);
        this.throttleHits = 0;
        if (
          this.effectiveLimit < this.opts.requestsPerWindow &&
          t - this.lastThrottleAt > this.opts.windowMs
        ) {
          this.effectiveLimit++;
        }
        if (response.provider === "none") this.unlimited = true;
        batch.forEach((job, i) => {
          const r = response.results[i];
          if (r && r.ok) {
            job.resolve({
              result: r.result,
              isMock: r.isMock,
              estimateReason: r.isMock ? "no-provider" : undefined,
            });
          } else {
            this.retryOrGiveUp(job);
          }
        });
        return;
      }

      case "rate-limited": {
        this.forgetRequest(startedAt);
        if (response.scope === "day") {
          this.dailyLimitUntil = t + DAILY_LIMIT_BACKOFF_MS;
          batch.forEach((j) => j.resolve(this.estimate(j, "daily-limit")));
          this.flushWaiting("daily-limit");
          return;
        }
        this.throttleHits++;
        this.effectiveLimit = Math.max(1, Math.floor(this.effectiveLimit / 2));
        this.lastThrottleAt = t;
        const wait =
          Math.min(response.retryAfterSeconds * 1000 * 2 ** (this.throttleHits - 1), MAX_PAUSE_MS) +
          Math.floor(Math.random() * 500);
        this.pausedUntil = Math.max(this.pausedUntil, t + wait);
        this.pauseReason = "rate-limit";
        this.waiting.unshift(...batch);
        return;
      }

      case "busy": {
        this.forgetRequest(startedAt);
        batch.forEach((j) => j.attempts++);
        // Provider overload is temporary, so be more patient than for other errors.
        const patience = this.opts.maxAttempts + 5;
        const exhausted = batch.filter((j) => j.attempts >= patience);
        exhausted.forEach((j) => j.resolve(this.estimate(j, "failed")));
        const retry = batch.filter((j) => j.attempts < patience);
        if (retry.length > 0) {
          const attempts = Math.min(...retry.map((j) => j.attempts));
          const wait = Math.min(response.retryAfterSeconds * 1000 * 2 ** (attempts - 1), BUSY_MAX_PAUSE_MS);
          this.pausedUntil = Math.max(this.pausedUntil, t + wait);
          this.pauseReason = "busy";
          this.waiting.unshift(...retry);
        }
        return;
      }

      case "error": {
        this.forgetRequest(startedAt);
        batch.forEach((j) => this.retryOrGiveUp(j));
        const wait = 1500 * 2 ** Math.max(0, Math.min(...batch.map((j) => j.attempts)) - 1);
        this.pausedUntil = Math.max(this.pausedUntil, t + Math.min(wait, MAX_PAUSE_MS));
        this.pauseReason = "busy";
        return;
      }
    }
  }

  private forgetRequest(startedAt: number) {
    const index = this.sent.indexOf(startedAt);
    if (index >= 0) this.sent.splice(index, 1);
  }

  private retryOrGiveUp(job: Job) {
    job.attempts++;
    if (job.attempts >= this.opts.maxAttempts) {
      job.resolve(this.estimate(job, "failed"));
    } else {
      this.waiting.unshift(job);
    }
  }

  private flushWaiting(reason: EstimateReason) {
    const jobs = this.waiting.splice(0);
    jobs.forEach((j) => j.resolve(this.estimate(j, reason)));
  }
}
