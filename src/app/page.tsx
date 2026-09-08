"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export default function LandingPage() {
  const router = useRouter();
  const { userId, profile, loading, isDemoMode } = useAuth();

  useEffect(() => {
    if (loading) return;
    if (isDemoMode) {
      router.replace(profile?.onboardingComplete ? "/home" : "/onboarding");
      return;
    }
    if (userId) {
      router.replace(profile?.onboardingComplete ? "/home" : "/onboarding");
    }
  }, [loading, isDemoMode, userId, profile, router]);

  if (loading || isDemoMode || userId) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="font-display text-2xl animate-pulse">Vastr</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="mx-auto w-full max-w-5xl px-6 py-6 flex items-center justify-between">
        <span className="font-display text-2xl">Vastr</span>
        <div className="flex items-center gap-3">
          <Button variant="ghost" asChild>
            <Link href="/login">Sign in</Link>
          </Button>
          <Button asChild>
            <Link href="/signup">Sign up</Link>
          </Button>
        </div>
      </header>

      <main className="flex-1 flex items-center">
        <div className="mx-auto w-full max-w-3xl px-6 py-16 text-center space-y-7">
          <p className="text-sm font-medium text-accent tracking-wide uppercase">
            Your Personal AI Fashion Operating System
          </p>
          <h1 className="font-display text-5xl sm:text-6xl leading-[1.05]">
            Never wonder
            <br />
            what to wear again.
          </h1>
          <p className="text-muted-foreground text-lg max-w-xl mx-auto">
            Digitize your wardrobe, tell Vastr about your day, and get outfits built from clothes
            you actually own — matched to the weather, the occasion, and your style.
          </p>
          <div className="flex items-center justify-center gap-3 pt-2">
            <Button size="lg" asChild>
              <Link href="/signup">Create your wardrobe</Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link href="/login">I have an account</Link>
            </Button>
          </div>
        </div>
      </main>

      <footer className="mx-auto w-full max-w-5xl px-6 py-6 text-center text-xs text-muted-foreground">
        {isSupabaseConfigured ? "Powered by Supabase" : "Running in local demo mode"}
      </footer>
    </div>
  );
}
