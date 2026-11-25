"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertCircle, Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/hooks/use-auth";
import { useWardrobeStore } from "@/store/wardrobe-store";
import { persistWardrobeImage } from "@/services/storage-service";
import { compressImage } from "@/lib/image/compress";
import { cropToDataUrl } from "@/lib/image/crop";
import { detectOutfitInPhoto } from "@/lib/upload/detect-outfit";
import { visionToForm } from "@/lib/upload/vision-to-form";
import { COLOR_PALETTE } from "@/lib/colors";
import { cn, uid } from "@/lib/utils";
import { CLOTHING_CATEGORIES, type ClothingCategory, type WardrobeItemInput } from "@/types/wardrobe";
import type { Box2D, DetectedPerson } from "@/types/outfit-photo";

interface Row {
  id: string;
  selected: boolean;
  cropUrl: string;
  box: Box2D;
  form: WardrobeItemInput;
}

type Phase =
  | { kind: "detecting" }
  | { kind: "choosing" }
  | { kind: "reviewing" }
  | { kind: "saving" }
  | { kind: "error"; message: string; canRetry: boolean };

const ERROR_COPY = {
  noAi: "Adding from an outfit photo needs AI to be set up (a Gemini API key).",
  dailyLimit:
    "Today's free AI limit is used up, so this can't run right now. Try again tomorrow, or add pieces one at a time.",
  nothingFound:
    "I couldn't spot a clearly visible outfit. Try a photo where the clothes are fully in view.",
  generic: "Something went wrong reading that photo.",
};

/** Pick a photo of someone wearing an outfit and add each garment as its own
 *  wardrobe item. Mount with a fresh `key` per photo. Only the cropped garments
 *  are saved; the original photo (and the people in it) never is. */
export function OutfitPhotoDialog({
  file,
  onClose,
  onRetry,
}: {
  file: File;
  onClose: () => void;
  onRetry: () => void;
}) {
  const { userId } = useAuth();
  const addItem = useWardrobeStore((s) => s.addItem);

  const [phase, setPhase] = useState<Phase>({ kind: "detecting" });
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  // Detection runs on a smaller copy; crops come from this sharper one so small
  // items (a watch, a belt) stay crisp. Boxes are relative, so they apply to both.
  const [cropSource, setCropSource] = useState<string | null>(null);
  const [people, setPeople] = useState<DetectedPerson[]>([]);
  const [rows, setRows] = useState<Row[]>([]);
  const [waitSeconds, setWaitSeconds] = useState<number | null>(null);

  const loadPerson = useCallback(async (photo: string, person: DetectedPerson) => {
    const crops = await Promise.all(person.items.map((item) => cropToDataUrl(photo, item.box)));
    setRows(
      person.items.map((item, i) => ({
        id: uid(),
        selected: true,
        cropUrl: crops[i],
        box: item.box,
        form: visionToForm(item.result, crops[i]),
      }))
    );
    setPhase({ kind: "reviewing" });
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    (async () => {
      try {
        const [dataUrl, sharpUrl] = await Promise.all([
          compressImage(file, 1280, 0.85),
          compressImage(file, 2400, 0.9),
        ]);
        if (controller.signal.aborted) return;
        setPhotoUrl(dataUrl);
        setCropSource(sharpUrl);

        const outcome = await detectOutfitInPhoto(dataUrl, setWaitSeconds, controller.signal);
        if (controller.signal.aborted) return;

        if (outcome.status === "no-ai") {
          setPhase({ kind: "error", message: ERROR_COPY.noAi, canRetry: false });
        } else if (outcome.status === "daily-limit") {
          setPhase({ kind: "error", message: ERROR_COPY.dailyLimit, canRetry: false });
        } else if (outcome.status === "failed") {
          setPhase({ kind: "error", message: ERROR_COPY.generic, canRetry: true });
        } else if (outcome.people.length === 0) {
          setPhase({ kind: "error", message: ERROR_COPY.nothingFound, canRetry: true });
        } else {
          setPeople(outcome.people);
          if (outcome.people.length === 1) await loadPerson(sharpUrl, outcome.people[0]);
          else setPhase({ kind: "choosing" });
        }
      } catch {
        if (!controller.signal.aborted) {
          setPhase({
            kind: "error",
            message: "Couldn't read that photo. HEIC files may need converting to JPEG first.",
            canRetry: false,
          });
        }
      }
    })();
    return () => controller.abort();
  }, [file, loadPerson]);

  const updateForm = (id: string, patch: Partial<WardrobeItemInput>) =>
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, form: { ...r.form, ...patch } } : r)));
  const toggle = (id: string) =>
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, selected: !r.selected } : r)));

  const selected = rows.filter((r) => r.selected);

  async function handleSave() {
    if (!userId || selected.length === 0) return;
    setPhase({ kind: "saving" });

    const savedIds = new Set<string>();
    const queue = [...selected];
    const worker = async () => {
      for (let next = queue.shift(); next; next = queue.shift()) {
        try {
          const imageUrl = await persistWardrobeImage(userId, next.cropUrl);
          await addItem(userId, { ...next.form, imageUrl });
          savedIds.add(next.id);
        } catch (err) {
          console.error("[outfit-photo] failed to save item", err);
        }
      }
    };
    await Promise.all(Array.from({ length: 3 }, worker));

    if (savedIds.size > 0) {
      toast.success(`Added ${savedIds.size} item${savedIds.size === 1 ? "" : "s"} to your wardrobe`);
    }
    if (savedIds.size === selected.length) {
      onClose();
      return;
    }
    toast.error("Some items couldn't be saved. They're still here to try again.");
    setRows((rs) => rs.filter((r) => !savedIds.has(r.id)));
    setPhase({ kind: "reviewing" });
  }

  const description =
    phase.kind === "choosing"
      ? "More than one person is in this photo."
      : phase.kind === "reviewing"
        ? "Untick anything you don't want, and fix names if needed."
        : "Vastr finds each piece in your photo and adds it to your wardrobe.";

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Add from an outfit photo</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        {phase.kind === "detecting" && (
          <div className="flex flex-col items-center gap-4 py-6">
            {photoUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={photoUrl} alt="" className="max-h-56 rounded-xl opacity-60" />
            )}
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin text-accent" />
              {waitSeconds !== null
                ? `AI is busy right now. Continuing in ${waitSeconds}s…`
                : "Spotting each piece in your photo…"}
            </div>
          </div>
        )}

        {phase.kind === "choosing" && photoUrl && (
          <div className="flex flex-col items-center gap-3">
            <PhotoWithBoxes
              src={photoUrl}
              boxes={people.map((p) => p.box)}
              onPick={(i) => {
                setPhase({ kind: "detecting" });
                void loadPerson(cropSource ?? photoUrl, people[i]);
              }}
            />
            <p className="text-sm text-muted-foreground">
              Tap the person whose outfit you want to add. The biggest is numbered 1.
            </p>
          </div>
        )}

        {(phase.kind === "reviewing" || phase.kind === "saving") && photoUrl && (
          <div className="grid gap-5 sm:grid-cols-[minmax(0,240px)_1fr]">
            <div className="flex flex-col items-center gap-2">
              <PhotoWithBoxes src={photoUrl} boxes={selected.map((r) => r.box)} />
              {people.length > 1 && phase.kind === "reviewing" && (
                <button
                  onClick={() => setPhase({ kind: "choosing" })}
                  className="text-xs text-muted-foreground underline underline-offset-4 hover:text-foreground"
                >
                  Choose a different person
                </button>
              )}
              <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
                <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-success" />
                Only the cropped clothes are saved, not your original photo.
              </p>
            </div>

            <ul className="max-h-[48vh] space-y-3 overflow-y-auto pr-1">
              {rows.map((row) => (
                <li
                  key={row.id}
                  className={cn(
                    "flex gap-3 rounded-2xl border border-border bg-card p-3 transition-opacity",
                    !row.selected && "opacity-50"
                  )}
                >
                  <input
                    type="checkbox"
                    checked={row.selected}
                    onChange={() => toggle(row.id)}
                    disabled={phase.kind === "saving"}
                    aria-label={`Include ${row.form.name}`}
                    className="mt-1 h-4 w-4 shrink-0 accent-accent"
                  />
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={row.cropUrl}
                    alt={row.form.name}
                    className="h-20 w-16 shrink-0 rounded-xl bg-secondary object-cover"
                  />
                  <div className="min-w-0 flex-1 space-y-2">
                    <Input
                      value={row.form.name}
                      onChange={(e) => updateForm(row.id, { name: e.target.value })}
                      disabled={phase.kind === "saving"}
                      aria-label="Name"
                      className="h-9"
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <Select
                        value={row.form.category}
                        onValueChange={(v) => updateForm(row.id, { category: v as ClothingCategory })}
                        disabled={phase.kind === "saving"}
                      >
                        <SelectTrigger className="h-9" aria-label="Category">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {CLOTHING_CATEGORIES.map((c) => (
                            <SelectItem key={c} value={c}>
                              {c}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Select
                        value={row.form.primaryColor}
                        onValueChange={(v) => updateForm(row.id, { primaryColor: v })}
                        disabled={phase.kind === "saving"}
                      >
                        <SelectTrigger className="h-9" aria-label="Colour">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {[...new Set([row.form.primaryColor, ...COLOR_PALETTE])].map((c) => (
                            <SelectItem key={c} value={c}>
                              {c}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}

        {phase.kind === "error" && (
          <div className="flex flex-col items-center gap-4 py-6 text-center">
            <div className="rounded-full bg-accent/10 p-3 text-accent">
              <AlertCircle className="h-5 w-5" />
            </div>
            <p className="max-w-sm text-sm text-muted-foreground">{phase.message}</p>
            <div className="flex gap-2">
              <Button variant="ghost" onClick={onClose}>
                Close
              </Button>
              {phase.canRetry && <Button onClick={onRetry}>Try again</Button>}
            </div>
          </div>
        )}

        {(phase.kind === "reviewing" || phase.kind === "saving") && (
          <div className="flex items-center justify-end gap-2 border-t border-border pt-4">
            <Button variant="ghost" onClick={onClose} disabled={phase.kind === "saving"}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={phase.kind === "saving" || selected.length === 0}>
              {phase.kind === "saving" ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Adding…
                </>
              ) : (
                `Add ${selected.length} item${selected.length === 1 ? "" : "s"}`
              )}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function PhotoWithBoxes({
  src,
  boxes,
  onPick,
}: {
  src: string;
  boxes: Box2D[];
  onPick?: (index: number) => void;
}) {
  return (
    <div className="relative inline-block max-w-full">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt="Your outfit photo" className="block max-h-[46vh] w-auto max-w-full rounded-xl" />
      {boxes.map((box, i) => (
        <button
          key={i}
          type="button"
          disabled={!onPick}
          onClick={() => onPick?.(i)}
          aria-label={onPick ? `Choose person ${i + 1}` : undefined}
          style={{
            top: `${box[0] / 10}%`,
            left: `${box[1] / 10}%`,
            height: `${(box[2] - box[0]) / 10}%`,
            width: `${(box[3] - box[1]) / 10}%`,
          }}
          className={cn(
            "absolute rounded-lg border-2",
            onPick
              ? "border-white bg-white/10 shadow-md transition-colors hover:border-accent hover:bg-accent/30"
              : "pointer-events-none border-accent"
          )}
        >
          {onPick && (
            <span className="absolute left-1/2 top-0 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary px-2 py-0.5 text-xs font-medium text-primary-foreground">
              {i + 1}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}
