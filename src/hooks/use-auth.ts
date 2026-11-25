"use client";

import { useCallback, useEffect, useState } from "react";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { endDemoSession, isGuestDemo, startDemoSession, usesSupabase } from "@/lib/demo";
import { ensureLocalDemoUser, saveLocalProfile, seedLocalDemoData } from "@/lib/store/local-db";
import { fetchProfile, saveProfile } from "@/services/profile-service";
import type { UserProfile } from "@/types/user";

interface AuthState {
  userId: string | null;
  profile: UserProfile | null;
  loading: boolean;
  /** No Supabase configured at all: the whole deployment runs on local storage. */
  isDemoMode: boolean;
  /** A visitor trying the app without an account, on a deployment that does have accounts. */
  isGuest: boolean;
}

let listeners: Array<(s: AuthState) => void> = [];
let state: AuthState = {
  userId: null,
  profile: null,
  loading: true,
  isDemoMode: !isSupabaseConfigured,
  isGuest: false,
};

function setState(patch: Partial<AuthState>) {
  state = { ...state, ...patch };
  listeners.forEach((l) => l(state));
}

let initialized = false;

async function initAuth() {
  if (initialized) return;
  initialized = true;

  if (usesSupabase()) {
    const supabase = getSupabaseBrowserClient()!;
    const { data } = await supabase.auth.getUser();
    if (data.user) {
      const profile = await fetchProfile(data.user.id);
      setState({ userId: data.user.id, profile, loading: false });
    } else {
      setState({ userId: null, profile: null, loading: false });
    }
    supabase.auth.onAuthStateChange(async (_event, session) => {
      // A guest session owns the app until they leave it; ignore the empty session.
      if (isGuestDemo()) return;
      if (session?.user) {
        const profile = await fetchProfile(session.user.id);
        setState({ userId: session.user.id, profile, loading: false });
      } else {
        setState({ userId: null, profile: null, loading: false });
      }
    });
  } else {
    const localProfile = ensureLocalDemoUser();
    setState({ userId: localProfile.id, profile: localProfile, loading: false, isGuest: isGuestDemo() });
  }
}

/** Drops a visitor straight into the app with a sample wardrobe, no account needed. */
export function startGuestDemo() {
  const profile = startDemoSession();
  setState({ userId: profile.id, profile, loading: false, isGuest: true });
}

/** Clears everything the guest did and returns to the landing page with a clean slate. */
export function leaveGuestDemo(destination = "/") {
  endDemoSession();
  window.location.assign(destination);
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
    if (!usesSupabase()) {
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
    if (isGuestDemo()) {
      leaveGuestDemo();
      return;
    }
    if (usesSupabase()) {
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
