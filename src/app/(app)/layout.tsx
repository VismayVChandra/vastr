"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Sidebar } from "@/components/nav/sidebar";
import { BottomNav } from "@/components/nav/bottom-nav";
import { UploadTray } from "@/components/upload/upload-tray";
import { BulkReviewDialog } from "@/components/upload/bulk-review-dialog";
import { useAuth } from "@/hooks/use-auth";
import { useWardrobeStore } from "@/store/wardrobe-store";
import { useOutfitStore } from "@/store/outfit-store";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { userId, profile, loading } = useAuth();
  const loadWardrobe = useWardrobeStore((s) => s.load);
  const loadOutfits = useOutfitStore((s) => s.load);

  useEffect(() => {
    if (loading) return;
    if (!userId) {
      router.replace("/");
      return;
    }
    if (profile && !profile.onboardingComplete) {
      router.replace("/onboarding");
    }
  }, [loading, userId, profile, router]);

  useEffect(() => {
    if (userId) {
      loadWardrobe(userId);
      loadOutfits(userId);
    }
  }, [userId, loadWardrobe, loadOutfits]);

  if (loading || !userId) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="font-display text-2xl animate-pulse">Vastr</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Sidebar />
      <main className="lg:pl-64 pb-20 lg:pb-0">
        <div className="mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-10 py-6 lg:py-10">
          {children}
        </div>
      </main>
      <BottomNav />
      <UploadTray />
      <BulkReviewDialog />
    </div>
  );
}
