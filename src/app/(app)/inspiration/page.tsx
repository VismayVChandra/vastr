"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ImagePlus, Lock, ScanSearch } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { OutfitLookCard } from "@/components/outfit/outfit-look-card";
import { useAuth } from "@/hooks/use-auth";
import { isDemoSession } from "@/lib/demo";
import { compressImage } from "@/lib/image/compress";
import { postAI } from "@/lib/ai/post-ai";
import { resolveItems } from "@/lib/resolve-items";
import { useDemoPrompt } from "@/store/demo-prompt-store";
import { useOutfitStore } from "@/store/outfit-store";
import { useWardrobeStore } from "@/store/wardrobe-store";
import { hasFitSignal } from "@/types/fit";
import type { InspirationOutcome, InspirationResult, InspirationVerdict } from "@/lib/ai/inspiration";

const VERDICTS: Record<InspirationVerdict, { label: string; variant: "success" | "accent" | "destructive" }> = {
  great: { label: "Should suit you", variant: "success" },
  works_with_tweaks: { label: "Works with a tweak", variant: "accent" },
  not_ideal: { label: "Not the best fit as is", variant: "destructive" },
};

export default function InspirationPage() {
  const { profile, userId } = useAuth();
  const items = useWardrobeStore((s) => s.items);
  const saveOutfit = useOutfitStore((s) => s.save);
  const showDemoPrompt = useDemoPrompt((s) => s.show);
  const fileRef = useRef<HTMLInputElement>(null);

  const [image, setImage] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [waitSeconds, setWaitSeconds] = useState<number | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [result, setResult] = useState<InspirationResult | null>(null);
  const [saved, setSaved] = useState(false);

  const fit = profile?.preferences.fitProfile;
  const hasFit = hasFitSignal(fit);

  async function load(file: Blob) {
    try {
      setImage(await compressImage(file, 1280, 0.85));
      setResult(null);
      setNote(null);
      setSaved(false);
    } catch {
      toast.error("Couldn't read that image. Try another screenshot.");
    }
  }

  // Pinterest and phone screenshots are usually copied, not saved: let people paste them in.
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const file = Array.from(e.clipboardData?.files ?? []).find((f) => f.type.startsWith("image/"));
      if (file) {
        e.preventDefault();
        load(file);
      }
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, []);

  async function check() {
    if (!image || !profile) return;
    if (isDemoSession()) {
      showDemoPrompt("inspiration");
      return;
    }
    setChecking(true);
    setNote(null);
    setResult(null);
    setSaved(false);
    try {
      const out = await postAI<InspirationOutcome>(
        "/api/inspiration/check",
        {
          dataUrl: image,
          fit: hasFit ? fit : null,
          preferences: profile.preferences,
          // The server never looks at wardrobe photos, so leave them out of the request.
          wardrobe: items.map((i) => ({ ...i, imageUrl: null })),
        },
        setWaitSeconds
      );
      if (out.status === "daily-limit") {
        setNote("Today's free AI limit is used up. Please try again tomorrow.");
        return;
      }
      if (out.status === "failed") {
        setNote(`Couldn't check this look (${out.message}). Please try again in a moment.`);
        return;
      }
      const data = out.data;
      if (data.provider === "none" || data.provider === "unsupported") {
        setNote("The inspiration check needs an AI key on this server.");
        return;
      }
      if (!data.usable) {
        setNote(data.reason);
        return;
      }
      setResult(data.result);
    } finally {
      setChecking(false);
      setWaitSeconds(null);
    }
  }

  async function saveLook() {
    if (!userId || !result?.fromWardrobe) return;
    await saveOutfit(userId, {
      name: result.fromWardrobe.name,
      itemIds: result.fromWardrobe.itemIds,
      reason: result.fromWardrobe.reason,
      occasion: "Inspiration",
      missingItems: result.fromWardrobe.missingItems,
      source: "manual",
    });
    setSaved(true);
    toast.success("Saved to your outfit history");
  }

  const verdict = result ? VERDICTS[result.verdict] : null;

  return (
    <div className="max-w-2xl">
      <PageHeader
        title="Inspiration check"
        description="Found a look you love? See how it would work on you, not the model."
      />

      {!hasFit && (
        <div className="mb-5 rounded-2xl border border-accent/30 bg-accent/10 p-4 text-sm leading-relaxed">
          Add your{" "}
          <Link href="/fit" className="font-medium underline underline-offset-4">
            fit profile
          </Link>{" "}
          for a verdict made for you. Without it I can only judge a look in general terms.
        </div>
      )}

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        data-testid="inspo-input"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) load(f);
          e.target.value = "";
        }}
      />

      <div className="space-y-5 rounded-2xl border border-border bg-card p-5">
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            const f = e.dataTransfer.files?.[0];
            if (f?.type.startsWith("image/")) load(f);
          }}
          className="relative flex min-h-48 w-full items-center justify-center overflow-hidden rounded-2xl border border-dashed border-border bg-secondary/40 text-muted-foreground transition-colors hover:border-accent/50"
        >
          {image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={image} alt="The look to check" className="max-h-96 w-auto object-contain" />
          ) : (
            <span className="flex flex-col items-center gap-2 px-4 py-10 text-center text-sm">
              <ImagePlus className="h-7 w-7" />
              Drop a screenshot here, paste one, or tap to choose
              <span className="text-xs">A Pinterest or Instagram save works great</span>
            </span>
          )}
        </button>

        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={check} disabled={!image || checking}>
            <ScanSearch className="h-4 w-4" />
            {checking ? (waitSeconds ? `Busy, continuing in ${waitSeconds}s` : "Checking on you...") : "Check this look on me"}
          </Button>
          {image && !checking && (
            <Button variant="ghost" onClick={() => fileRef.current?.click()}>
              Choose another
            </Button>
          )}
        </div>
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Lock className="h-3.5 w-3.5" /> The screenshot is analysed by Gemini and not stored by Vastr.
        </p>

        {note && <p className="rounded-xl bg-accent/10 p-3 text-sm">{note}</p>}
      </div>

      {result && verdict && (
        <div className="mt-6 space-y-5" data-testid="inspo-result">
          <div className="space-y-3 rounded-2xl border border-border bg-card p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-display text-xl">{result.lookName}</h2>
              <Badge variant={verdict.variant}>{verdict.label}</Badge>
            </div>
            {result.pieces.length > 0 && (
              <p className="text-sm text-muted-foreground">{result.pieces.join(" · ")}</p>
            )}
            <p className="leading-relaxed">{result.verdictReason}</p>

            {result.adjustments.length > 0 && (
              <div className="space-y-1.5 pt-1">
                <p className="text-sm font-medium">To make it work for you</p>
                <ul className="space-y-1.5 text-sm leading-relaxed">
                  {result.adjustments.map((a) => (
                    <li key={a} className="flex gap-2">
                      <span className="text-accent">•</span>
                      <span>{a}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {!result.usedFitProfile && (
              <p className="text-xs text-muted-foreground">
                This is a general read. Add your{" "}
                <Link href="/fit" className="underline">
                  fit profile
                </Link>{" "}
                to make it specific to you.
              </p>
            )}
          </div>

          {result.fromWardrobe ? (
            <div className="space-y-2">
              <h3 className="font-display text-lg">The closest version from your wardrobe</h3>
              <OutfitLookCard
                name={result.fromWardrobe.name}
                subtitle="Adapted to you"
                items={resolveItems(items, result.fromWardrobe.itemIds)}
                reason={result.fromWardrobe.reason}
                missingItems={result.fromWardrobe.missingItems}
                saved={saved}
                onSave={saved ? undefined : saveLook}
              />
            </div>
          ) : (
            <p className="rounded-2xl border border-border bg-card p-5 text-sm text-muted-foreground">
              Nothing in your wardrobe is close to this look yet, so there&apos;s no version to build from your clothes.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
