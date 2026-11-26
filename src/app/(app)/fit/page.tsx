"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { Camera, Check, Lock, PenLine, Scan, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FitProfileEditor } from "@/components/fit/fit-profile-editor";
import { useAuth } from "@/hooks/use-auth";
import { isDemoSession } from "@/lib/demo";
import { compressImage } from "@/lib/image/compress";
import { postAI } from "@/lib/ai/post-ai";
import { swatchFor } from "@/lib/colors";
import { FitProfileNotMigratedError, saveFitProfile } from "@/services/profile-service";
import { useDemoPrompt } from "@/store/demo-prompt-store";
import { EMPTY_FIT_PROFILE, hasFitSignal, type FitProfile } from "@/types/fit";
import type { FitAnalysisOutcome } from "@/lib/ai/fit-profile";

type Step = "home" | "photos" | "edit";

function PhotoSlot({
  label,
  hint,
  dataUrl,
  onPick,
  onClear,
}: {
  label: string;
  hint: string;
  dataUrl: string | null;
  onPick: (file: File) => void;
  onClear: () => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <div className="space-y-2">
      <input
        ref={ref}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onPick(f);
          e.target.value = "";
        }}
      />
      <button
        type="button"
        onClick={() => ref.current?.click()}
        className="relative flex aspect-[3/4] w-full items-center justify-center overflow-hidden rounded-2xl border border-dashed border-border bg-secondary/40 text-muted-foreground transition-colors hover:border-accent/50"
      >
        {dataUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={dataUrl} alt={label} className="absolute inset-0 h-full w-full object-cover" />
        ) : (
          <span className="flex flex-col items-center gap-2 px-3 text-center text-sm">
            <Camera className="h-6 w-6" />
            {label}
          </span>
        )}
      </button>
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">{hint}</p>
        {dataUrl && (
          <button type="button" onClick={onClear} className="text-xs text-muted-foreground underline">
            Remove
          </button>
        )}
      </div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1 sm:grid-cols-[130px_1fr] sm:gap-4">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="text-sm">{children}</dd>
    </div>
  );
}

function Swatches({ colors }: { colors: string[] }) {
  if (colors.length === 0) return <span className="text-muted-foreground">Not set</span>;
  return (
    <span className="flex flex-wrap gap-2">
      {colors.map((c) => (
        <span key={c} className="inline-flex items-center gap-1.5 rounded-full border border-border px-2.5 py-1">
          <span className="h-3 w-3 rounded-full border border-border" style={{ background: swatchFor(c) }} />
          {c}
        </span>
      ))}
    </span>
  );
}

export default function FitPage() {
  const { profile, userId, updateProfile } = useAuth();
  const showDemoPrompt = useDemoPrompt((s) => s.show);

  const existing = hasFitSignal(profile?.preferences.fitProfile) ? profile!.preferences.fitProfile! : null;

  const [step, setStep] = useState<Step>("home");
  const [draft, setDraft] = useState<FitProfile>(EMPTY_FIT_PROFILE);
  const [fromPhotos, setFromPhotos] = useState(false);
  const [face, setFace] = useState<string | null>(null);
  const [body, setBody] = useState<string | null>(null);
  const [heightText, setHeightText] = useState("");
  const [consent, setConsent] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [waitSeconds, setWaitSeconds] = useState<number | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function pick(file: File, set: (url: string) => void) {
    try {
      set(await compressImage(file, 900, 0.82));
    } catch {
      toast.error("Couldn't read that photo. Try another one.");
    }
  }

  function startManual() {
    setDraft({ ...(existing ?? EMPTY_FIT_PROFILE), source: "manual" });
    setFromPhotos(false);
    setNote(null);
    setStep("edit");
  }

  async function analyze() {
    if (isDemoSession()) {
      showDemoPrompt("fit-photos");
      return;
    }
    const photos = [
      face && { dataUrl: face, kind: "face" },
      body && { dataUrl: body, kind: "body" },
    ].filter(Boolean);
    if (photos.length === 0) {
      setNote("Add at least one photo first.");
      return;
    }
    const height = Number(heightText);
    const heightCm = heightText && Number.isFinite(height) && height >= 100 && height <= 230 ? height : null;

    setAnalyzing(true);
    setNote(null);
    try {
      const out = await postAI<FitAnalysisOutcome>("/api/fit-profile/analyze", { photos, heightCm }, setWaitSeconds);
      if (out.status === "daily-limit") {
        setNote("Today's free AI limit is used up. You can fill your fit profile in by hand, or try photos again tomorrow.");
        return;
      }
      if (out.status === "failed") {
        setNote(`Couldn't analyse the photos (${out.message}). You can fill it in by hand instead.`);
        return;
      }
      const result = out.data;
      if (result.provider === "none" || result.provider === "unsupported") {
        setNote("Photo analysis needs an AI key on this server. You can fill your fit profile in by hand.");
        return;
      }
      if (!result.usable) {
        setNote(result.reason);
        return;
      }
      setDraft({
        ...EMPTY_FIT_PROFILE,
        ...result.profile,
        heightCm,
        source: "photos",
      });
      setFromPhotos(true);
      setStep("edit");
    } finally {
      setAnalyzing(false);
      setWaitSeconds(null);
    }
  }

  async function persist(fit: FitProfile | null, message: string) {
    if (!profile || !userId) return;
    setSaving(true);
    try {
      await updateProfile({ preferences: { ...profile.preferences, fitProfile: fit } });
      try {
        await saveFitProfile(userId, fit);
        toast.success(message);
      } catch (err) {
        if (err instanceof FitProfileNotMigratedError) {
          toast.warning("Saved on this device. To keep it on your account, the database needs its latest update (see supabase/schema.sql).", { duration: 9000 });
        } else {
          throw err;
        }
      }
      setStep("home");
    } catch (err) {
      console.error(err);
      toast.error("Couldn't save your fit profile. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  const save = () => persist({ ...draft, summary: draft.summary.trim(), updatedAt: new Date().toISOString() }, "Fit profile saved");

  // ---------------------------------------------------------------- photos
  if (step === "photos") {
    return (
      <div className="max-w-2xl">
        <PageHeader title="Analyse my photos" description="Two photos are plenty. One is fine too." />
        <div className="space-y-6 rounded-2xl border border-border bg-card p-5">
          <div className="grid grid-cols-2 gap-4">
            <PhotoSlot
              label="Face, in daylight"
              hint="Facing a window works best"
              dataUrl={face}
              onPick={(f) => pick(f, setFace)}
              onClear={() => setFace(null)}
            />
            <PhotoSlot
              label="Full body, head to toe"
              hint="Fitted clothes show more"
              dataUrl={body}
              onPick={(f) => pick(f, setBody)}
              onClear={() => setBody(null)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="height">Height in cm (optional)</Label>
            <Input
              id="height"
              type="number"
              inputMode="numeric"
              className="w-32"
              value={heightText}
              onChange={(e) => setHeightText(e.target.value)}
            />
          </div>

          <label className="flex cursor-pointer items-start gap-3 rounded-xl bg-secondary/50 p-3 text-sm leading-relaxed">
            <input
              type="checkbox"
              className="mt-1 h-4 w-4 accent-[var(--color-primary)]"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
            />
            <span>
              <span className="mb-0.5 flex items-center gap-1.5 font-medium">
                <Lock className="h-3.5 w-3.5" /> Your photos stay private
              </span>
              They are sent to Google&apos;s Gemini to be analysed, and Vastr does not store them. Only the written profile
              below is kept, and you can edit or delete it any time.
            </span>
          </label>

          {note && <p className="rounded-xl bg-accent/10 p-3 text-sm">{note}</p>}

          <div className="flex flex-wrap gap-2">
            <Button onClick={analyze} disabled={analyzing || !consent || (!face && !body)}>
              <Scan className="h-4 w-4" />
              {analyzing
                ? waitSeconds
                  ? `Busy, continuing in ${waitSeconds}s`
                  : "Analysing..."
                : "Analyse my photos"}
            </Button>
            <Button variant="ghost" onClick={startManual} disabled={analyzing}>
              Fill it in myself
            </Button>
            <Button variant="ghost" onClick={() => setStep("home")} disabled={analyzing}>
              Cancel
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------- edit
  if (step === "edit") {
    return (
      <div className="max-w-2xl">
        <PageHeader
          title="Your fit profile"
          description={fromPhotos ? "Here's what I picked up. Please fix anything that's off." : "Fill in what you know. Skip anything you're unsure about."}
        />
        <div className="space-y-6 rounded-2xl border border-border bg-card p-5">
          {fromPhotos && (
            <p className="rounded-xl bg-accent/10 p-3 text-sm leading-relaxed">
              A photo can&apos;t tell everything, and lighting can shift colours. You know yourself best, so treat this as a
              starting point.
            </p>
          )}
          <FitProfileEditor value={draft} onChange={setDraft} />
          <div className="flex flex-wrap gap-2">
            <Button onClick={save} disabled={saving || !hasFitSignal(draft)}>
              <Check className="h-4 w-4" /> {saving ? "Saving..." : "Save fit profile"}
            </Button>
            <Button variant="ghost" onClick={() => setStep("home")} disabled={saving}>
              Cancel
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------- home
  return (
    <div className="max-w-2xl">
      <PageHeader
        title="My fit"
        description="What suits you, so outfits are judged on you, not on whoever modelled them."
      />

      {existing ? (
        <div className="space-y-5 rounded-2xl border border-border bg-card p-5" data-testid="fit-summary">
          {existing.summary && <p className="leading-relaxed">{existing.summary}</p>}
          <dl className="space-y-3">
            <Row label="Colouring">
              {[existing.undertone && `${existing.undertone} undertone`, existing.contrast && `${existing.contrast} contrast`]
                .filter(Boolean)
                .join(" · ") || <span className="text-muted-foreground">Not set</span>}
            </Row>
            <Row label="Build">
              {[
                existing.heightCm && `${existing.heightCm} cm`,
                existing.build,
                existing.shoulders && `${existing.shoulders} shoulders`,
                existing.torso && `${existing.torso} torso`,
                existing.legs && `${existing.legs} legs`,
              ]
                .filter(Boolean)
                .join(" · ") || <span className="text-muted-foreground">Not set</span>}
            </Row>
            <Row label="Suits you">{existing.suits.join(", ") || <span className="text-muted-foreground">Not set</span>}</Row>
            <Row label="Go easy on">{existing.avoid.join(", ") || <span className="text-muted-foreground">Not set</span>}</Row>
            <Row label="Best colours">
              <Swatches colors={existing.bestColors} />
            </Row>
            <Row label="Fewer of">
              <Swatches colors={existing.avoidColors} />
            </Row>
          </dl>
          <div className="flex flex-wrap gap-2 pt-1">
            <Button variant="outline" onClick={startManual}>
              <PenLine className="h-4 w-4" /> Edit
            </Button>
            <Button variant="outline" onClick={() => setStep("photos")}>
              <Camera className="h-4 w-4" /> Redo from photos
            </Button>
            <Button
              variant="ghost"
              disabled={saving}
              onClick={() => {
                if (window.confirm("Remove your fit profile? The stylist will stop using it.")) {
                  persist(null, "Fit profile removed");
                }
              }}
            >
              <Trash2 className="h-4 w-4" /> Remove
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Used by your stylist and chat, and by{" "}
            <Link href="/inspiration" className="underline">
              the inspiration check
            </Link>
            .
          </p>
        </div>
      ) : (
        <div className="space-y-5 rounded-2xl border border-border bg-card p-5">
          <p className="leading-relaxed">
            A look that works on a model can fall flat on you, because bodies and colouring differ. Tell Vastr about
            yours, from a couple of photos or by hand, and every suggestion is chosen to suit you.
          </p>
          <ul className="space-y-1.5 text-sm text-muted-foreground">
            <li>• Your colouring: which shades flatter you and which wash you out</li>
            <li>• Your proportions: which cuts balance them</li>
            <li>• Always editable, and you can delete it whenever you like</li>
          </ul>
          <div className="flex flex-wrap gap-2 pt-1">
            <Button onClick={() => setStep("photos")}>
              <Camera className="h-4 w-4" /> Analyse my photos
            </Button>
            <Button variant="outline" onClick={startManual}>
              <PenLine className="h-4 w-4" /> Fill it in myself
            </Button>
          </div>
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Lock className="h-3.5 w-3.5" /> Photos are analysed by Gemini and never stored by Vastr.
          </p>
        </div>
      )}
    </div>
  );
}
