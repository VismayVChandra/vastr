import type { DetectedPerson } from "@/types/outfit-photo";

export type DetectOutcome =
  | { status: "ok"; people: DetectedPerson[] }
  | { status: "no-ai" }
  | { status: "daily-limit" }
  | { status: "failed"; message: string };

const MAX_ATTEMPTS = 6;

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener("abort", () => {
      clearTimeout(timer);
      resolve();
    });
  });
}

/** Counts down out loud so the UI can say "continuing in 12s" while we wait. */
async function waitWithCountdown(
  ms: number,
  onWait: (secondsLeft: number | null) => void,
  signal?: AbortSignal
) {
  const end = Date.now() + ms;
  while (Date.now() < end && !signal?.aborted) {
    onWait(Math.ceil((end - Date.now()) / 1000));
    await sleep(Math.min(1000, end - Date.now()), signal);
  }
  onWait(null);
}

/** Asks the server to find each person and their garments in a photo. Rate
 *  limits and overload are waited out automatically; callers never have to
 *  tell the user to "try again". */
export async function detectOutfitInPhoto(
  dataUrl: string,
  onWait: (secondsLeft: number | null) => void,
  signal?: AbortSignal
): Promise<DetectOutcome> {
  let lastError = "Couldn't read this photo";

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    if (signal?.aborted) return { status: "failed", message: "Cancelled" };

    let res: Response;
    try {
      res = await fetch("/api/detect-outfit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dataUrl }),
        signal,
      });
    } catch (err) {
      if (signal?.aborted) return { status: "failed", message: "Cancelled" };
      lastError = err instanceof Error ? err.message : "Network error";
      await waitWithCountdown(2000 * attempt, onWait, signal);
      continue;
    }

    const data = await res.json().catch(() => null);

    if (res.ok) {
      if (data?.provider !== "gemini") return { status: "no-ai" };
      return { status: "ok", people: data.people ?? [] };
    }

    const retryAfter = Number(data?.retryAfterSeconds) || Number(res.headers.get("retry-after")) || 8;
    if (res.status === 429) {
      if (data?.scope === "day") return { status: "daily-limit" };
      await waitWithCountdown(
        Math.min(retryAfter * 1000 * 2 ** (attempt - 1), 40_000) + Math.random() * 500,
        onWait,
        signal
      );
      continue;
    }
    if (res.status === 503) {
      await waitWithCountdown(Math.min(retryAfter * 1000 * 2 ** (attempt - 1), 20_000), onWait, signal);
      continue;
    }

    lastError = data?.error ?? `HTTP ${res.status}`;
    if (res.status === 400 || res.status === 413) break;
    await waitWithCountdown(2000 * attempt, onWait, signal);
  }

  return { status: "failed", message: lastError };
}
