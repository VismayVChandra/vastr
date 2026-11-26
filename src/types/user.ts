import type { StyleTag } from "./wardrobe";
import type { FitProfile } from "./fit";

export const STYLE_OPTIONS: StyleTag[] = [
  "casual",
  "streetwear",
  "minimal",
  "formal",
  "smart casual",
  "sporty",
  "traditional",
  "experimental",
];

export const GENDER_OPTIONS = ["Womenswear", "Menswear", "Unisex / No preference"] as const;

export const OCCASION_OPTIONS = [
  "Work / office",
  "College / school",
  "Casual outings",
  "Parties & nightlife",
  "Dates",
  "Fitness & sports",
  "Travel",
  "Formal events",
] as const;

export const BUDGET_OPTIONS = ["Budget-friendly", "Mid-range", "Premium", "Luxury"] as const;

export interface StylePreferences {
  preferredStyles: string[];
  favoriteColors: string[];
  dislikedColors: string[];
  occasions: string[];
  budget: string;
  /** What suits this person (set up on the My Fit page). Optional: most people start without one. */
  fitProfile?: FitProfile | null;
}

export interface UserProfile {
  id: string;
  email: string | null;
  name: string;
  gender: string;
  avatarUrl: string | null;
  onboardingComplete: boolean;
  preferences: StylePreferences;
  location: { lat: number; lon: number; label: string } | null;
  createdAt: string;
  updatedAt: string;
}

export const DEFAULT_PREFERENCES: StylePreferences = {
  preferredStyles: [],
  favoriteColors: [],
  dislikedColors: [],
  occasions: [],
  budget: "Mid-range",
};
