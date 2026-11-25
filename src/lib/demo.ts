import { isSupabaseConfigured } from "@/lib/supabase/config";
import {
  clearLocalData,
  ensureLocalDemoUser,
  saveLocalProfile,
  seedLocalDemoData,
} from "@/lib/store/local-db";
import type { UserProfile } from "@/types/user";

/**
 * Guest demo: lets a visitor try the whole app, with a sample wardrobe, before
 * creating an account. It reuses the local-storage persistence that backs
 * Supabase-less setups, switched on at runtime by a flag in the browser. A real
 * account's data never touches local storage, so the two can't collide.
 */

const DEMO_FLAG_KEY = "vastr:demo-session";

export function isDemoSession(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(DEMO_FLAG_KEY) === "1";
  } catch {
    return false;
  }
}

/** True when data should go to Supabase: it's configured and this isn't a guest session. */
export function usesSupabase(): boolean {
  return isSupabaseConfigured && !isDemoSession();
}

/** A guest on a deployment that does have accounts (as opposed to a local-only setup). */
export function isGuestDemo(): boolean {
  return isSupabaseConfigured && isDemoSession();
}

/** Marks the browser as a guest and returns a ready-to-use profile with a seeded wardrobe. */
export function startDemoSession(): UserProfile {
  window.localStorage.setItem(DEMO_FLAG_KEY, "1");
  const existing = ensureLocalDemoUser();
  if (existing.onboardingComplete) return existing;

  const profile: UserProfile = {
    ...existing,
    name: "Guest",
    gender: "Unisex / No preference",
    onboardingComplete: true,
    preferences: {
      preferredStyles: ["minimal", "smart casual"],
      favoriteColors: ["Black", "Navy", "White"],
      dislikedColors: [],
      occasions: ["Work / office", "Casual outings"],
      budget: "Mid-range",
    },
    updatedAt: new Date().toISOString(),
  };
  saveLocalProfile(profile);
  seedLocalDemoData(profile.id);
  return profile;
}

/** Wipes everything the guest did, including the flag itself. */
export function endDemoSession() {
  clearLocalData();
}
