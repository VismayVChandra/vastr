"use client";

import Link from "next/link";
import { RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { leaveGuestDemo, useAuth } from "@/hooks/use-auth";

/** Sits above every page while someone is trying the demo, so it's always clear it's a sandbox. */
export function DemoBanner() {
  const { isGuest } = useAuth();
  if (!isGuest) return null;

  // Wipes the sandbox and reloads the landing page, where "Try the demo" starts a fresh one.
  const reset = () => leaveGuestDemo();

  return (
    <div
      role="status"
      className="sticky top-0 z-30 border-b border-accent/20 bg-accent/10 backdrop-blur-sm lg:ml-64"
    >
      <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-2 sm:px-6 lg:px-10">
        <p className="text-xs sm:text-sm">
          <span className="font-medium">You&apos;re trying the demo.</span>{" "}
          <span className="text-muted-foreground">
            Sample wardrobe, saved only on this device.
          </span>
        </p>
        <div className="flex items-center gap-1.5">
          <Button variant="ghost" size="sm" onClick={reset}>
            <RotateCcw className="h-3.5 w-3.5" /> Start over
          </Button>
          <Button size="sm" asChild>
            <Link href="/signup">Create free account</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
