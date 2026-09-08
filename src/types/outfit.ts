export interface OutfitItemRef {
  itemId: string;
}

export interface MissingPiece {
  category: string;
  description: string;
  reason: string;
}

export interface Outfit {
  id: string;
  userId: string;
  name: string;
  itemIds: string[];
  reason: string;
  occasion: string | null;
  missingItems: MissingPiece[];
  saved: boolean;
  wornAt: string[];
  rating: "loved" | "okay" | "not-for-me" | null;
  feedbackReasons: string[];
  feedbackNote: string | null;
  source: "home" | "style-me" | "stylist-chat" | "manual";
  createdAt: string;
  updatedAt: string;
}

export type OutfitInput = Pick<
  Outfit,
  "name" | "itemIds" | "reason" | "occasion" | "missingItems" | "source"
>;

export const FEEDBACK_REASONS = [
  "Too formal",
  "Too casual",
  "Didn't like colours",
  "Uncomfortable",
  "Didn't like the combination",
  "Other",
] as const;

export interface WearHistoryEntry {
  id: string;
  outfitId: string;
  date: string;
  occasion: string | null;
  rating: Outfit["rating"];
}
