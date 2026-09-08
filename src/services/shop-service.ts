import { isSupabaseConfigured } from "@/lib/supabase/config";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { wishlistCollection } from "@/lib/store/local-db";
import { fetchMockProducts } from "@/lib/store/products";
import { uid } from "@/lib/utils";
import type { Product, WishlistEntry } from "@/types/shop";

/** Swap this for a real e-commerce/affiliate integration later — every
 *  caller already depends on this function, not the mock catalog directly. */
export async function fetchProducts(): Promise<Product[]> {
  return fetchMockProducts();
}

export async function fetchRecommendedProducts(
  categories: string[],
  styleTags: string[],
  limit = 5
): Promise<Product[]> {
  const all = await fetchProducts();
  const scored = all.map((p) => {
    let score = 0;
    if (categories.some((c) => c.toLowerCase() === p.category.toLowerCase())) score += 3;
    score += p.tags.filter((t) => styleTags.includes(t)).length;
    return { p, score };
  });
  scored.sort((a, b) => b.score - a.score || b.p.rating - a.p.rating);
  return scored.slice(0, limit).map((s) => s.p);
}

export async function listWishlist(userId: string): Promise<WishlistEntry[]> {
  if (isSupabaseConfigured) {
    const supabase = getSupabaseBrowserClient()!;
    const { data, error } = await supabase
      .from("wishlist")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (data ?? []).map((r) => ({
      id: r.id,
      userId: r.user_id,
      productId: (r.product as { id: string }).id,
      createdAt: r.created_at,
    }));
  }
  return wishlistCollection.list().filter((w) => w.userId === userId);
}

export async function addToWishlist(userId: string, product: Product): Promise<void> {
  if (isSupabaseConfigured) {
    const supabase = getSupabaseBrowserClient()!;
    const { error } = await supabase.from("wishlist").insert({ user_id: userId, product });
    if (error) throw error;
    return;
  }
  wishlistCollection.insert({
    id: uid(),
    userId,
    productId: product.id,
    createdAt: new Date().toISOString(),
  });
}

export async function removeFromWishlist(userId: string, productId: string): Promise<void> {
  if (isSupabaseConfigured) {
    const supabase = getSupabaseBrowserClient()!;
    const { error } = await supabase
      .from("wishlist")
      .delete()
      .eq("user_id", userId)
      .contains("product", { id: productId });
    if (error) throw error;
    return;
  }
  const entry = wishlistCollection.list().find((w) => w.userId === userId && w.productId === productId);
  if (entry) wishlistCollection.remove(entry.id);
}
