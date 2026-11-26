import { usesSupabase } from "@/lib/demo";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { getLocalProfile, saveLocalProfile } from "@/lib/store/local-db";
import type { UserProfile } from "@/types/user";
import type { FitProfile } from "@/types/fit";
import { profileRowToProfile } from "./mappers";

export async function fetchProfile(userId: string): Promise<UserProfile | null> {
  if (usesSupabase()) {
    const supabase = getSupabaseBrowserClient()!;
    const [{ data: userData }, { data, error }] = await Promise.all([
      supabase.auth.getUser(),
      supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
    ]);
    if (error) throw error;
    if (!data) return null;
    return profileRowToProfile(data, userData.user?.email ?? null);
  }
  return getLocalProfile();
}

export async function saveProfile(profile: UserProfile): Promise<UserProfile> {
  if (usesSupabase()) {
    const supabase = getSupabaseBrowserClient()!;
    const { error } = await supabase
      .from("profiles")
      .update({
        name: profile.name,
        gender: profile.gender,
        avatar_url: profile.avatarUrl,
        onboarding_complete: profile.onboardingComplete,
        preferred_styles: profile.preferences.preferredStyles,
        favorite_colors: profile.preferences.favoriteColors,
        disliked_colors: profile.preferences.dislikedColors,
        occasions: profile.preferences.occasions,
        budget: profile.preferences.budget,
        location: profile.location,
        updated_at: new Date().toISOString(),
      })
      .eq("id", profile.id);
    if (error) throw error;
    return profile;
  }
  saveLocalProfile(profile);
  return profile;
}

/** Thrown when the database doesn't have the fit_profile column yet. */
export class FitProfileNotMigratedError extends Error {
  constructor() {
    super("The fit_profile column is missing. Run the latest migration in supabase/schema.sql.");
  }
}

/**
 * Saves the fit profile on its own, apart from saveProfile, so a database that hasn't had
 * the fit_profile migration yet can never break saving ordinary preferences.
 * In local and demo mode the profile is saved whole by saveProfile, so there's nothing to do here.
 */
export async function saveFitProfile(userId: string, fit: FitProfile | null): Promise<void> {
  if (!usesSupabase()) return;
  const supabase = getSupabaseBrowserClient()!;
  const { error } = await supabase
    .from("profiles")
    .update({ fit_profile: fit as unknown as never, updated_at: new Date().toISOString() })
    .eq("id", userId);
  if (error) {
    // Postgres "undefined column" (42703) or PostgREST's schema-cache miss (PGRST204).
    if (error.code === "42703" || error.code === "PGRST204" || /fit_profile/i.test(error.message)) {
      throw new FitProfileNotMigratedError();
    }
    throw error;
  }
}
