import { isSupabaseConfigured } from "@/lib/supabase/config";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { getLocalProfile, saveLocalProfile } from "@/lib/store/local-db";
import type { UserProfile } from "@/types/user";
import { profileRowToProfile } from "./mappers";

export async function fetchProfile(userId: string): Promise<UserProfile | null> {
  if (isSupabaseConfigured) {
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
  if (isSupabaseConfigured) {
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
