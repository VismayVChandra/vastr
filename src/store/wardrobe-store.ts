import { create } from "zustand";
import type { WardrobeItem, WardrobeItemInput } from "@/types/wardrobe";
import {
  addWardrobeItem,
  deleteWardrobeItem,
  listWardrobeItems,
  markItemWorn,
  updateWardrobeItem,
} from "@/services/wardrobe-service";

interface WardrobeState {
  items: WardrobeItem[];
  loading: boolean;
  loadedForUser: string | null;
  load: (userId: string, force?: boolean) => Promise<void>;
  addItem: (userId: string, input: WardrobeItemInput) => Promise<WardrobeItem>;
  editItem: (id: string, patch: Partial<WardrobeItem>) => Promise<void>;
  removeItem: (id: string) => Promise<void>;
  wearItem: (id: string) => Promise<void>;
}

export const useWardrobeStore = create<WardrobeState>((set, get) => ({
  items: [],
  loading: false,
  loadedForUser: null,

  load: async (userId, force = false) => {
    if (!force && get().loadedForUser === userId) return;
    set({ loading: true });
    const items = await listWardrobeItems(userId);
    set({ items, loading: false, loadedForUser: userId });
  },

  addItem: async (userId, input) => {
    const item = await addWardrobeItem(userId, input);
    set({ items: [item, ...get().items] });
    return item;
  },

  editItem: async (id, patch) => {
    const updated = await updateWardrobeItem(id, patch);
    if (!updated) return;
    set({ items: get().items.map((i) => (i.id === id ? updated : i)) });
  },

  removeItem: async (id) => {
    await deleteWardrobeItem(id);
    set({ items: get().items.filter((i) => i.id !== id) });
  },

  wearItem: async (id) => {
    const item = get().items.find((i) => i.id === id);
    if (!item) return;
    await markItemWorn(id, item);
    set({
      items: get().items.map((i) =>
        i.id === id
          ? { ...i, timesWorn: i.timesWorn + 1, lastWornAt: new Date().toISOString() }
          : i
      ),
    });
  },
}));
