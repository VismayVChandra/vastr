import type { WardrobeItem } from "@/types/wardrobe";
import type { Outfit, MissingPiece } from "@/types/outfit";
import type { UserProfile } from "@/types/user";
import type { Database } from "@/types/database";

type WardrobeRow = Database["public"]["Tables"]["wardrobe_items"]["Row"];
type OutfitRow = Database["public"]["Tables"]["outfits"]["Row"];
type ProfileRow = Database["public"]["Tables"]["profiles"]["Row"];

export function wardrobeRowToItem(row: WardrobeRow): WardrobeItem {
  return {
    id: row.id,
    userId: row.user_id,
    imageUrl: row.image_url,
    name: row.name,
    category: row.category as WardrobeItem["category"],
    subcategory: row.subcategory,
    primaryColor: row.primary_color,
    secondaryColors: row.secondary_colors ?? [],
    pattern: row.pattern,
    material: row.material,
    brand: row.brand,
    size: row.size,
    fit: row.fit as WardrobeItem["fit"],
    season: (row.season ?? []) as WardrobeItem["season"],
    formality: row.formality as WardrobeItem["formality"],
    styleTags: row.style_tags ?? [],
    timesWorn: row.times_worn,
    lastWornAt: row.last_worn_at,
    favorite: row.favorite,
    archived: row.archived,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function itemToWardrobeRow(
  item: Partial<WardrobeItem> & { userId: string }
): Database["public"]["Tables"]["wardrobe_items"]["Insert"] {
  return {
    user_id: item.userId,
    image_url: item.imageUrl,
    name: item.name ?? "",
    category: item.category ?? "Other",
    subcategory: item.subcategory,
    primary_color: item.primaryColor ?? "",
    secondary_colors: item.secondaryColors,
    pattern: item.pattern,
    material: item.material,
    brand: item.brand,
    size: item.size,
    fit: item.fit,
    season: item.season,
    formality: item.formality,
    style_tags: item.styleTags,
    favorite: item.favorite,
  };
}

export function outfitRowToOutfit(row: OutfitRow): Outfit {
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    itemIds: row.item_ids ?? [],
    reason: row.reason,
    occasion: row.occasion,
    missingItems: (row.missing_items as MissingPiece[]) ?? [],
    saved: row.saved,
    wornAt: row.worn_at ?? [],
    rating: row.rating as Outfit["rating"],
    feedbackReasons: row.feedback_reasons ?? [],
    feedbackNote: row.feedback_note,
    source: row.source as Outfit["source"],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function outfitToOutfitRow(
  outfit: Partial<Outfit> & { userId: string }
): Database["public"]["Tables"]["outfits"]["Insert"] {
  return {
    user_id: outfit.userId,
    name: outfit.name,
    item_ids: outfit.itemIds,
    reason: outfit.reason,
    occasion: outfit.occasion,
    missing_items: outfit.missingItems as unknown as never,
    saved: outfit.saved,
    worn_at: outfit.wornAt,
    rating: outfit.rating ?? undefined,
    feedback_reasons: outfit.feedbackReasons,
    feedback_note: outfit.feedbackNote,
    source: outfit.source,
  };
}

export function profileRowToProfile(row: ProfileRow, email: string | null): UserProfile {
  return {
    id: row.id,
    email,
    name: row.name,
    gender: row.gender,
    avatarUrl: row.avatar_url,
    onboardingComplete: row.onboarding_complete,
    preferences: {
      preferredStyles: row.preferred_styles ?? [],
      favoriteColors: row.favorite_colors ?? [],
      dislikedColors: row.disliked_colors ?? [],
      occasions: row.occasions ?? [],
      budget: row.budget,
    },
    location: row.location,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
