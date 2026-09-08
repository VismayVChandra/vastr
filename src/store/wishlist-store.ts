import { create } from "zustand";
import { addToWishlist, listWishlist, removeFromWishlist } from "@/services/shop-service";
import type { Product, WishlistEntry } from "@/types/shop";

interface WishlistState {
  entries: WishlistEntry[];
  loadedForUser: string | null;
  load: (userId: string) => Promise<void>;
  toggle: (userId: string, product: Product) => Promise<void>;
  isWishlisted: (productId: string) => boolean;
}

export const useWishlistStore = create<WishlistState>((set, get) => ({
  entries: [],
  loadedForUser: null,

  load: async (userId) => {
    if (get().loadedForUser === userId) return;
    const entries = await listWishlist(userId);
    set({ entries, loadedForUser: userId });
  },

  toggle: async (userId, product) => {
    const existing = get().entries.find((e) => e.productId === product.id);
    if (existing) {
      await removeFromWishlist(userId, product.id);
      set({ entries: get().entries.filter((e) => e.productId !== product.id) });
    } else {
      await addToWishlist(userId, product);
      set({
        entries: [
          ...get().entries,
          { id: product.id, userId, productId: product.id, createdAt: new Date().toISOString() },
        ],
      });
    }
  },

  isWishlisted: (productId) => get().entries.some((e) => e.productId === productId),
}));
