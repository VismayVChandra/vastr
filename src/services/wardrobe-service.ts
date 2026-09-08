import { isSupabaseConfigured } from "@/lib/supabase/config";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { wardrobeCollection } from "@/lib/store/local-db";
import { uid } from "@/lib/utils";
import type { WardrobeItem, WardrobeItemInput } from "@/types/wardrobe";
import { itemToWardrobeRow, wardrobeRowToItem } from "./mappers";

export async function listWardrobeItems(userId: string): Promise<WardrobeItem[]> {
  if (isSupabaseConfigured) {
    const supabase = getSupabaseBrowserClient()!;
    const { data, error } = await supabase
      .from("wardrobe_items")
      .select("*")
      .eq("user_id", userId)
      .eq("archived", false)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (data ?? []).map(wardrobeRowToItem);
  }
  return wardrobeCollection
    .list()
    .filter((i) => i.userId === userId && !i.archived)
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

export async function addWardrobeItem(
  userId: string,
  input: WardrobeItemInput
): Promise<WardrobeItem> {
  if (isSupabaseConfigured) {
    const supabase = getSupabaseBrowserClient()!;
    const { data, error } = await supabase
      .from("wardrobe_items")
      .insert(itemToWardrobeRow({ ...input, userId }))
      .select("*")
      .single();
    if (error) throw error;
    return wardrobeRowToItem(data);
  }
  const now = new Date().toISOString();
  const item: WardrobeItem = {
    ...input,
    id: uid(),
    userId,
    timesWorn: 0,
    lastWornAt: null,
    favorite: input.favorite ?? false,
    archived: false,
    createdAt: now,
    updatedAt: now,
  };
  return wardrobeCollection.insert(item);
}

export async function updateWardrobeItem(
  id: string,
  patch: Partial<WardrobeItem>
): Promise<WardrobeItem | null> {
  if (isSupabaseConfigured) {
    const supabase = getSupabaseBrowserClient()!;
    const { data, error } = await supabase
      .from("wardrobe_items")
      .update({
        ...itemToWardrobeRow(patch as WardrobeItem),
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select("*")
      .single();
    if (error) throw error;
    return wardrobeRowToItem(data);
  }
  return wardrobeCollection.update(id, { ...patch, updatedAt: new Date().toISOString() });
}

export async function deleteWardrobeItem(id: string): Promise<void> {
  if (isSupabaseConfigured) {
    const supabase = getSupabaseBrowserClient()!;
    const { error } = await supabase.from("wardrobe_items").delete().eq("id", id);
    if (error) throw error;
    return;
  }
  wardrobeCollection.remove(id);
}

export async function markItemWorn(id: string, item: WardrobeItem): Promise<void> {
  await updateWardrobeItem(id, {
    timesWorn: item.timesWorn + 1,
    lastWornAt: new Date().toISOString(),
  });
}
