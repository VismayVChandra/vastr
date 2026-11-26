/**
 * A person's "fit profile": the few traits that decide what suits them, so the
 * stylist can judge a look on them rather than on whoever modelled it.
 * Everything is editable by the user, and none of it is a judgement of the person.
 */

export const UNDERTONES = ["warm", "cool", "neutral"] as const;
export type Undertone = (typeof UNDERTONES)[number];

/** How strongly skin, hair and eyes contrast with one another. */
export const CONTRASTS = ["low", "medium", "high"] as const;
export type Contrast = (typeof CONTRASTS)[number];

export const BUILDS = ["slim", "average", "athletic", "broad", "curvy", "fuller"] as const;
export type Build = (typeof BUILDS)[number];

export const SHOULDERS = ["narrow", "average", "broad"] as const;
export const TORSOS = ["short", "average", "long"] as const;
export const LEGS = ["short", "average", "long"] as const;

export interface FitProfile {
  heightCm: number | null;
  build: Build | null;
  shoulders: (typeof SHOULDERS)[number] | null;
  torso: (typeof TORSOS)[number] | null;
  legs: (typeof LEGS)[number] | null;
  undertone: Undertone | null;
  contrast: Contrast | null;
  /** Cuts and silhouettes that tend to work, e.g. "straight-leg trousers". */
  suits: string[];
  /** Cuts that tend to fight their proportions, e.g. "cropped boxy tops". */
  avoid: string[];
  /** Colours from the app palette that flatter them. */
  bestColors: string[];
  avoidColors: string[];
  /** One or two plain sentences summing it up. */
  summary: string;
  source: "photos" | "manual";
  updatedAt: string;
}

export const EMPTY_FIT_PROFILE: FitProfile = {
  heightCm: null,
  build: null,
  shoulders: null,
  torso: null,
  legs: null,
  undertone: null,
  contrast: null,
  suits: [],
  avoid: [],
  bestColors: [],
  avoidColors: [],
  summary: "",
  source: "manual",
  updatedAt: "",
};

/** Whether a profile has anything in it worth sending to the stylist. */
export function hasFitSignal(fit: FitProfile | null | undefined): fit is FitProfile {
  if (!fit) return false;
  return Boolean(
    fit.build ||
      fit.undertone ||
      fit.shoulders ||
      fit.torso ||
      fit.legs ||
      fit.heightCm ||
      fit.suits.length ||
      fit.avoid.length ||
      fit.bestColors.length ||
      fit.avoidColors.length
  );
}
