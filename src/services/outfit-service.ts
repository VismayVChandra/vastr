import { usesSupabase } from "@/lib/demo";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { outfitCollection } from "@/lib/store/local-db";
import { uid } from "@/lib/utils";
import type { Outfit, OutfitInput } from "@/types/outfit";
import { outfitRowToOutfit, outfitToOutfitRow } from "./mappers";

export async function listOutfits(userId: string): Promise<Outfit[]> {
  if (usesSupabase()) {
    const supabase = getSupabaseBrowserClient()!;
    const { data, error } = await supabase
      .from("outfits")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (data ?? []).map(outfitRowToOutfit);
  }
  return outfitCollection
    .list()
    .filter((o) => o.userId === userId)
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

export async function saveOutfit(
  userId: string,
  input: OutfitInput,
  saved = true
): Promise<Outfit> {
  if (usesSupabase()) {
    const supabase = getSupabaseBrowserClient()!;
    const { data, error } = await supabase
      .from("outfits")
      .insert({
        ...outfitToOutfitRow({ ...input, userId, saved, wornAt: [], feedbackReasons: [] }),
        saved,
      })
      .select("*")
      .single();
    if (error) throw error;
    return outfitRowToOutfit(data);
  }
  const now = new Date().toISOString();
  const outfit: Outfit = {
    ...input,
    id: uid(),
    userId,
    saved,
    wornAt: [],
    rating: null,
    feedbackReasons: [],
    feedbackNote: null,
    createdAt: now,
    updatedAt: now,
  };
  return outfitCollection.insert(outfit);
}

export async function recordOutfitWorn(id: string, outfit: Outfit): Promise<void> {
  await updateOutfit(id, { wornAt: [...outfit.wornAt, new Date().toISOString()] });
}

export async function updateOutfit(id: string, patch: Partial<Outfit>): Promise<Outfit | null> {
  if (usesSupabase()) {
    const supabase = getSupabaseBrowserClient()!;
    const { data, error } = await supabase
      .from("outfits")
      .update({
        ...outfitToOutfitRow(patch as Outfit),
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select("*")
      .single();
    if (error) throw error;
    return outfitRowToOutfit(data);
  }
  return outfitCollection.update(id, { ...patch, updatedAt: new Date().toISOString() });
}

export async function submitOutfitFeedback(
  id: string,
  rating: Outfit["rating"],
  reasons: string[],
  note: string | null
): Promise<Outfit | null> {
  return updateOutfit(id, { rating, feedbackReasons: reasons, feedbackNote: note });
}
