"use client";

import { useCallback, useEffect, useState } from "react";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { ensureLocalDemoUser, saveLocalProfile, seedLocalDemoData } from "@/lib/store/local-db";
import { fetchProfile, saveProfile } from "@/services/profile-service";
import type { UserProfile } from "@/types/user";

interface AuthState {
  userId: string | null;
  profile: UserProfile | null;
  loading: boolean;
  isDemoMode: boolean;
}

let listeners: Array<(s: AuthState) => void> = [];
let state: AuthState = {
  userId: null,
  profile: null,
  loading: true,
  isDemoMode: !isSupabaseConfigured,
};

function setState(patch: Partial<AuthState>) {
  state = { ...state, ...patch };
  listeners.forEach((l) => l(state));
}

let initialized = false;

async function initAuth() {
  if (initialized) return;
  initialized = true;

  if (isSupabaseConfigured) {
    const supabase = getSupabaseBrowserClient()!;
    const { data } = await supabase.auth.getUser();
    if (data.user) {
      const profile = await fetchProfile(data.user.id);
      setState({ userId: data.user.id, profile, loading: false });
    } else {
      setState({ userId: null, profile: null, loading: false });
    }
    supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session?.user) {
        const profile = await fetchProfile(session.user.id);
        setState({ userId: session.user.id, profile, loading: false });
      } else {
        setState({ userId: null, profile: null, loading: false });
      }
    });
  } else {
    const localProfile = ensureLocalDemoUser();
    setState({ userId: localProfile.id, profile: localProfile, loading: false });
  }
}

export function useAuth() {
  const [snapshot, setSnapshot] = useState(state);

  useEffect(() => {
    listeners.push(setSnapshot);
    initAuth();
    return () => {
      listeners = listeners.filter((l) => l !== setSnapshot);
    };
  }, []);

  const completeOnboarding = useCallback(async (patch: Partial<UserProfile>) => {
    if (!state.profile) return;
    const updated: UserProfile = {
      ...state.profile,
      ...patch,
      onboardingComplete: true,
      updatedAt: new Date().toISOString(),
    };
    await saveProfile(updated);
    if (!isSupabaseConfigured) {
      saveLocalProfile(updated);
      seedLocalDemoData(updated.id);
    }
    setState({ profile: updated });
  }, []);

  const updateProfile = useCallback(async (patch: Partial<UserProfile>) => {
    if (!state.profile) return;
    const updated: UserProfile = { ...state.profile, ...patch, updatedAt: new Date().toISOString() };
    await saveProfile(updated);
    setState({ profile: updated });
  }, []);

  const signOut = useCallback(async () => {
    if (isSupabaseConfigured) {
      const supabase = getSupabaseBrowserClient()!;
      await supabase.auth.signOut();
    }
  }, []);

  return {
    ...snapshot,
    completeOnboarding,
    updateProfile,
    signOut,
  };
}
