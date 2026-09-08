import { create } from "zustand";
import type { Outfit, OutfitInput } from "@/types/outfit";
import {
  listOutfits,
  recordOutfitWorn,
  saveOutfit,
  submitOutfitFeedback,
  updateOutfit,
} from "@/services/outfit-service";
import { useWardrobeStore } from "./wardrobe-store";

interface OutfitState {
  outfits: Outfit[];
  loading: boolean;
  loadedForUser: string | null;
  load: (userId: string, force?: boolean) => Promise<void>;
  save: (userId: string, input: OutfitInput) => Promise<Outfit>;
  createDraft: (userId: string, input: OutfitInput) => Promise<Outfit>;
  markSaved: (id: string) => Promise<void>;
  wearOutfit: (id: string) => Promise<void>;
  giveFeedback: (
    id: string,
    rating: Outfit["rating"],
    reasons: string[],
    note: string | null
  ) => Promise<void>;
}

export const useOutfitStore = create<OutfitState>((set, get) => ({
  outfits: [],
  loading: false,
  loadedForUser: null,

  load: async (userId, force = false) => {
    if (!force && get().loadedForUser === userId) return;
    set({ loading: true });
    const outfits = await listOutfits(userId);
    set({ outfits, loading: false, loadedForUser: userId });
  },

  save: async (userId, input) => {
    const outfit = await saveOutfit(userId, input);
    set({ outfits: [outfit, ...get().outfits] });
    return outfit;
  },

  createDraft: async (userId, input) => {
    const outfit = await saveOutfit(userId, input, false);
    set({ outfits: [outfit, ...get().outfits] });
    return outfit;
  },

  markSaved: async (id) => {
    const updated = await updateOutfit(id, { saved: true });
    if (!updated) return;
    set({ outfits: get().outfits.map((o) => (o.id === id ? updated : o)) });
  },

  wearOutfit: async (id) => {
    const outfit = get().outfits.find((o) => o.id === id);
    if (!outfit) return;
    await recordOutfitWorn(id, outfit);
    const nowIso = new Date().toISOString();
    set({
      outfits: get().outfits.map((o) =>
        o.id === id ? { ...o, wornAt: [...o.wornAt, nowIso] } : o
      ),
    });
    const wearItem = useWardrobeStore.getState().wearItem;
    await Promise.all(outfit.itemIds.map((itemId) => wearItem(itemId)));
  },

  giveFeedback: async (id, rating, reasons, note) => {
    await submitOutfitFeedback(id, rating, reasons, note);
    set({
      outfits: get().outfits.map((o) =>
        o.id === id ? { ...o, rating, feedbackReasons: reasons, feedbackNote: note } : o
      ),
    });
  },
}));
