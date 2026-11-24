"use client";

import { AlertCircle, Loader2, X } from "lucide-react";
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
import { COLOR_PALETTE } from "@/lib/colors";
import { useUploadStore, type UploadItem } from "@/lib/upload/upload-store";
import { CLOTHING_CATEGORIES, type ClothingCategory } from "@/types/wardrobe";

export function BulkReviewDialog() {
  const { userId } = useAuth();
  const items = useUploadStore((s) => s.items);
  const open = useUploadStore((s) => s.reviewOpen);
  const setOpen = useUploadStore((s) => s.setReviewOpen);
  const saveAll = useUploadStore((s) => s.saveAll);
  const removeItem = useUploadStore((s) => s.removeItem);

  const reviewable = items.filter((i) => i.form && (i.status === "ready" || i.status === "saving"));
  const saving = items.some((i) => i.status === "saving");
  const readyCount = items.filter((i) => i.status === "ready").length;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Review your {reviewable.length} new item{reviewable.length === 1 ? "" : "s"}</DialogTitle>
          <DialogDescription>
            Fix anything that looks off, then add them all in one go.
          </DialogDescription>
        </DialogHeader>

        <ul className="max-h-[55vh] space-y-3 overflow-y-auto pr-1">
          {reviewable.map((item) => (
            <ReviewRow key={item.id} item={item} onRemove={() => removeItem(item.id)} />
          ))}
        </ul>

        <div className="flex items-center justify-end gap-2 border-t border-border pt-4">
          <Button variant="ghost" onClick={() => setOpen(false)} disabled={saving}>
            Not yet
          </Button>
          <Button
            onClick={() => userId && saveAll(userId)}
            disabled={saving || readyCount === 0 || !userId}
          >
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Adding…
              </>
            ) : (
              `Add ${readyCount} item${readyCount === 1 ? "" : "s"}`
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ReviewRow({ item, onRemove }: { item: UploadItem; onRemove: () => void }) {
  const updateForm = useUploadStore((s) => s.updateForm);
  const form = item.form!;
  const busy = item.status === "saving";

  return (
    <li className="flex gap-3 rounded-2xl border border-border bg-card p-3">
      <div className="h-24 w-20 shrink-0 overflow-hidden rounded-xl bg-secondary">
        {item.previewUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={item.previewUrl} alt={form.name} className="h-full w-full object-cover" />
        )}
      </div>

      <div className="min-w-0 flex-1 space-y-2">
        <Input
          value={form.name}
          onChange={(e) => updateForm(item.id, { name: e.target.value })}
          disabled={busy}
          aria-label="Name"
          className="h-9"
        />
        <div className="grid grid-cols-2 gap-2">
          <Select
            value={form.category}
            onValueChange={(v) => updateForm(item.id, { category: v as ClothingCategory })}
            disabled={busy}
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
            value={form.primaryColor}
            onValueChange={(v) => updateForm(item.id, { primaryColor: v })}
            disabled={busy}
          >
            <SelectTrigger className="h-9" aria-label="Colour">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[...new Set([form.primaryColor, ...COLOR_PALETTE])].map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {item.estimated && (
          <p className="flex items-center gap-1.5 text-xs text-accent">
            <AlertCircle className="h-3.5 w-3.5" />
            {item.estimateReason === "daily-limit"
              ? "Offline estimate (AI limit reached). Please check."
              : item.estimateReason === "failed"
                ? "AI couldn't read this one. Please check."
                : "Rough estimate. Please check."}
          </p>
        )}
        {item.error && <p className="text-xs text-destructive">{item.error}</p>}
      </div>

      <button
        onClick={onRemove}
        disabled={busy}
        className="self-start rounded-full p-1.5 text-muted-foreground hover:bg-secondary disabled:opacity-40"
        aria-label={`Remove ${form.name}`}
      >
        <X className="h-4 w-4" />
      </button>
    </li>
  );
}
