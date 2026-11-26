import { create } from "zustand";

/** Which locked feature a guest just tried, so the sign-up prompt can say why. */
export type DemoLockReason = "photos" | "outfit-photo" | "fit-photos" | "inspiration";

interface DemoPromptState {
  reason: DemoLockReason | null;
  show: (reason: DemoLockReason) => void;
  close: () => void;
}

export const useDemoPrompt = create<DemoPromptState>((set) => ({
  reason: null,
  show: (reason) => set({ reason }),
  close: () => set({ reason: null }),
}));
