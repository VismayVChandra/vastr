/** Friendly, deliberately rounded time estimate: "about 40 sec", "about 3 min". */
export function formatEta(ms: number): string {
  const seconds = Math.max(0, Math.round(ms / 1000));
  if (seconds < 8) return "a few seconds";
  if (seconds < 50) return `about ${Math.round(seconds / 5) * 5} sec`;
  const minutes = Math.max(1, Math.round(seconds / 60));
  return `about ${minutes} min`;
}

export function formatCountdown(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}
