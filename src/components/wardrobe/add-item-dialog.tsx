"use client";

import { useRef, useState, useEffect } from "react";
import { Camera, Loader2, Sparkles, X } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ChipSelect } from "@/components/shared/chip-select";
import { useAuth } from "@/hooks/use-auth";
import { useWardrobeStore } from "@/store/wardrobe-store";
import { persistWardrobeImage } from "@/services/storage-service";
import { COLOR_PALETTE } from "@/lib/colors";
import {
  CLOTHING_CATEGORIES,
  FITS,
  FORMALITY_LEVELS,
  SEASONS,
  STYLE_TAGS,
  type WardrobeItem,
  type WardrobeItemInput,
} from "@/types/wardrobe";

const EMPTY_FORM: WardrobeItemInput = {
  imageUrl: null,
  name: "",
  category: "T-Shirts",
  subcategory: "",
  primaryColor: "Black",
  secondaryColors: [],
  pattern: "solid",
  material: "",
  brand: "",
  size: "",
  fit: "regular",
  season: ["all-season"],
  formality: "casual",
  styleTags: [],
  favorite: false,
};

interface AddItemDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingItem?: WardrobeItem | null;
}

export function AddItemDialog({ open, onOpenChange, editingItem }: AddItemDialogProps) {
  const { userId } = useAuth();
  const { addItem, editItem } = useWardrobeStore();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState<WardrobeItemInput>(EMPTY_FORM);
  const [analyzing, setAnalyzing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [aiNote, setAiNote] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setForm(editingItem ? itemToForm(editingItem) : EMPTY_FORM);
      setAiNote(null);
    }
  }, [open, editingItem]);

  function update<K extends keyof WardrobeItemInput>(key: K, value: WardrobeItemInput[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleFile(file: File) {
    const dataUrl = await fileToDataUrl(file);
    update("imageUrl", dataUrl);
    setAnalyzing(true);
    try {
      const res = await fetch("/api/analyze-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dataUrl, fileName: file.name }),
      });
      if (!res.ok) throw new Error("Analysis failed");
      const { result, isMock, mockReason } = await res.json();
      setForm((f) => ({
        ...f,
        name: f.name || result.suggestedName,
        category: result.category,
        subcategory: result.subcategory,
        primaryColor: result.primaryColor,
        secondaryColors: result.secondaryColors,
        pattern: result.pattern,
        material: result.material,
        fit: result.fit,
        formality: result.formality,
        season: result.season,
        styleTags: result.styleTags,
      }));
      setAiNote(
        !isMock
          ? "AI filled these in from your photo — feel free to adjust anything."
          : mockReason === "provider-error"
            ? "The AI provider call failed, so this is an offline estimate — check the server logs and double-check these details."
            : "Estimated without an AI key configured — please double-check these details."
      );
    } catch {
      toast.error("Couldn't analyze the image automatically. Fill in the details below.");
    } finally {
      setAnalyzing(false);
    }
  }

  async function handleSave() {
    if (!userId) return;
    if (!form.name.trim()) {
      toast.error("Give this item a name first.");
      return;
    }
    setSaving(true);
    try {
      let imageUrl = form.imageUrl;
      if (imageUrl?.startsWith("data:")) {
        imageUrl = await persistWardrobeImage(userId, imageUrl);
      }
      const payload = { ...form, imageUrl };

      if (editingItem) {
        await editItem(editingItem.id, payload);
        toast.success("Item updated");
      } else {
        await addItem(userId, payload);
        toast.success("Added to your wardrobe");
      }
      onOpenChange(false);
    } catch (err) {
      console.error(err);
      toast.error("Something went wrong saving this item.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{editingItem ? "Edit item" : "Add to your wardrobe"}</DialogTitle>
          <DialogDescription>
            Upload a photo and let AI fill in the details, or enter them yourself.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-6 sm:grid-cols-[180px_1fr]">
          <div className="space-y-2">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="relative flex aspect-[3/4] w-full items-center justify-center overflow-hidden rounded-xl border border-dashed border-border bg-secondary/50 hover:border-accent/50 transition-colors"
            >
              {form.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={form.imageUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                <div className="flex flex-col items-center gap-2 text-muted-foreground p-3 text-center">
                  <Camera className="h-6 w-6" />
                  <span className="text-xs">Upload photo</span>
                </div>
              )}
              {analyzing && (
                <div className="absolute inset-0 flex items-center justify-center bg-background/70 backdrop-blur-sm">
                  <Loader2 className="h-5 w-5 animate-spin text-accent" />
                </div>
              )}
              {form.imageUrl && !analyzing && (
                <span
                  role="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    update("imageUrl", null);
                  }}
                  className="absolute top-1.5 right-1.5 rounded-full bg-background/90 p-1 hover:bg-background"
                >
                  <X className="h-3.5 w-3.5" />
                </span>
              )}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFile(file);
              }}
            />
            {aiNote && (
              <p className="flex items-start gap-1.5 text-[11px] leading-snug text-muted-foreground">
                <Sparkles className="h-3 w-3 shrink-0 mt-0.5 text-accent" />
                {aiNote}
              </p>
            )}
          </div>

          <div className="space-y-4 max-h-[55vh] overflow-y-auto pr-1">
            <div className="space-y-1.5">
              <Label>Name</Label>
              <Input
                value={form.name}
                onChange={(e) => update("name", e.target.value)}
                placeholder="White Oxford Shirt"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Category</Label>
                <Select value={form.category} onValueChange={(v) => update("category", v as WardrobeItemInput["category"]) }>
                  <SelectTrigger>
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
              </div>
              <div className="space-y-1.5">
                <Label>Subcategory</Label>
                <Input
                  value={form.subcategory ?? ""}
                  onChange={(e) => update("subcategory", e.target.value)}
                  placeholder="Oxford shirt"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Primary colour</Label>
                <Select value={form.primaryColor} onValueChange={(v) => update("primaryColor", v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {COLOR_PALETTE.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Pattern</Label>
                <Input value={form.pattern} onChange={(e) => update("pattern", e.target.value)} />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label>Fit</Label>
                <Select value={form.fit} onValueChange={(v) => update("fit", v as WardrobeItemInput["fit"]) }>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FITS.map((f) => (
                      <SelectItem key={f} value={f}>
                        {f}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Formality</Label>
                <Select
                  value={form.formality}
                  onValueChange={(v) => update("formality", v as WardrobeItemInput["formality"]) }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FORMALITY_LEVELS.map((f) => (
                      <SelectItem key={f} value={f}>
                        {f}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Size</Label>
                <Input value={form.size ?? ""} onChange={(e) => update("size", e.target.value)} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Brand</Label>
                <Input value={form.brand ?? ""} onChange={(e) => update("brand", e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Material</Label>
                <Input
                  value={form.material ?? ""}
                  onChange={(e) => update("material", e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Season</Label>
              <ChipSelect options={SEASONS} value={form.season} onChange={(v) => update("season", v as WardrobeItemInput["season"]) } />
            </div>

            <div className="space-y-1.5">
              <Label>Style tags</Label>
              <ChipSelect options={STYLE_TAGS} value={form.styleTags as string[]} onChange={(v) => update("styleTags", v)} />
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving || analyzing}>
            {saving ? "Saving..." : editingItem ? "Save changes" : "Add item"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function itemToForm(item: WardrobeItem): WardrobeItemInput {
  return {
    imageUrl: item.imageUrl,
    name: item.name,
    category: item.category,
    subcategory: item.subcategory,
    primaryColor: item.primaryColor,
    secondaryColors: item.secondaryColors,
    pattern: item.pattern,
    material: item.material,
    brand: item.brand,
    size: item.size,
    fit: item.fit,
    season: item.season,
    formality: item.formality,
    styleTags: item.styleTags,
    favorite: item.favorite,
  };
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
