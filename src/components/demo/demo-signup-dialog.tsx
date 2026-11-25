"use client";

import Link from "next/link";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useDemoPrompt, type DemoLockReason } from "@/store/demo-prompt-store";

const COPY: Record<DemoLockReason, { title: string; body: string }> = {
  photos: {
    title: "Add your own clothes with a free account",
    body: "Snap or upload photos and Vastr recognises every piece for you: category, colour, formality, all of it. That uses AI, so it's reserved for accounts. The demo wardrobe is yours to play with, and you can still add pieces by typing the details in.",
  },
  "outfit-photo": {
    title: "Turn one outfit photo into wardrobe items",
    body: "With an account, drop in a single photo of an outfit and Vastr pulls out each garment as its own wardrobe item. That uses AI, so it's reserved for accounts.",
  },
};

/** Shown when a guest reaches for a feature that spends AI quota. */
export function DemoSignupDialog() {
  const reason = useDemoPrompt((s) => s.reason);
  const close = useDemoPrompt((s) => s.close);
  const copy = reason ? COPY[reason] : null;

  return (
    <Dialog open={Boolean(reason)} onOpenChange={(open) => !open && close()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="mb-1 flex h-10 w-10 items-center justify-center rounded-full bg-accent/10 text-accent">
            <Sparkles className="h-5 w-5" />
          </div>
          <DialogTitle>{copy?.title}</DialogTitle>
          <DialogDescription className="leading-relaxed">{copy?.body}</DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="ghost" onClick={close}>
            Keep exploring
          </Button>
          <Button asChild>
            <Link href="/signup">Create free account</Link>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
