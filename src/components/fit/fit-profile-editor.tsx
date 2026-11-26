"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ChipSelect } from "@/components/shared/chip-select";
import { COLOR_PALETTE } from "@/lib/colors";
import {
  BUILDS,
  CONTRASTS,
  LEGS,
  SHOULDERS,
  TORSOS,
  UNDERTONES,
  type FitProfile,
} from "@/types/fit";

/** One choice out of a few, which can be cleared by tapping it again ("not sure" is a fine answer). */
function SingleChips<T extends string>({
  options,
  value,
  onChange,
}: {
  options: readonly T[];
  value: T | null;
  onChange: (value: T | null) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((opt) => {
        const active = value === opt;
        return (
          <button
            key={opt}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(active ? null : opt)}
            className={cn(
              "rounded-full border px-3.5 py-1.5 text-sm font-medium capitalize transition-all",
              active
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-card hover:border-primary/40"
            )}
          >
            {opt}
          </button>
        );
      })}
    </div>
  );
}

/** A list of short phrases the user can trim or add to. */
function TagList({
  values,
  onChange,
  placeholder,
}: {
  values: string[];
  onChange: (values: string[]) => void;
  placeholder: string;
}) {
  const [draft, setDraft] = useState("");

  function add() {
    const text = draft.trim();
    if (text && !values.some((v) => v.toLowerCase() === text.toLowerCase())) onChange([...values, text]);
    setDraft("");
  }

  return (
    <div className="space-y-2">
      {values.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {values.map((v) => (
            <span
              key={v}
              className="inline-flex items-center gap-1.5 rounded-full border border-border bg-secondary/50 py-1 pl-3 pr-1.5 text-sm"
            >
              {v}
              <button
                type="button"
                aria-label={`Remove ${v}`}
                onClick={() => onChange(values.filter((x) => x !== v))}
                className="rounded-full p-0.5 text-muted-foreground hover:bg-background hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </span>
          ))}
        </div>
      )}
      <Input
        value={draft}
        placeholder={placeholder}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            add();
          }
        }}
        onBlur={add}
      />
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      {children}
    </div>
  );
}

export function FitProfileEditor({
  value,
  onChange,
}: {
  value: FitProfile;
  onChange: (value: FitProfile) => void;
}) {
  const set = <K extends keyof FitProfile>(key: K, v: FitProfile[K]) => onChange({ ...value, [key]: v });

  return (
    <div className="space-y-6">
      <Field label="Height (cm)" hint="Optional. Helps with proportions and hem lengths.">
        <Input
          type="number"
          inputMode="numeric"
          min={100}
          max={230}
          className="w-32"
          value={value.heightCm ?? ""}
          onChange={(e) => {
            const n = Number(e.target.value);
            set("heightCm", e.target.value && Number.isFinite(n) ? n : null);
          }}
        />
      </Field>

      <Field label="Build">
        <SingleChips options={BUILDS} value={value.build} onChange={(v) => set("build", v)} />
      </Field>
      <div className="grid gap-6 sm:grid-cols-3">
        <Field label="Shoulders">
          <SingleChips options={SHOULDERS} value={value.shoulders} onChange={(v) => set("shoulders", v)} />
        </Field>
        <Field label="Torso">
          <SingleChips options={TORSOS} value={value.torso} onChange={(v) => set("torso", v)} />
        </Field>
        <Field label="Legs">
          <SingleChips options={LEGS} value={value.legs} onChange={(v) => set("legs", v)} />
        </Field>
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        <Field label="Skin undertone">
          <SingleChips options={UNDERTONES} value={value.undertone} onChange={(v) => set("undertone", v)} />
        </Field>
        <Field label="Contrast" hint="How much your skin, hair and eyes stand apart from each other.">
          <SingleChips options={CONTRASTS} value={value.contrast} onChange={(v) => set("contrast", v)} />
        </Field>
      </div>

      <Field label="Cuts that suit you" hint="Press Enter to add, for example “straight-leg trousers”.">
        <TagList
          values={value.suits}
          onChange={(v) => set("suits", v)}
          placeholder="Add a cut or silhouette"
        />
      </Field>
      <Field label="Cuts that tend to work against you">
        <TagList
          values={value.avoid}
          onChange={(v) => set("avoid", v)}
          placeholder="Add a cut to go easy on"
        />
      </Field>

      <Field label="Colours that flatter you">
        <ChipSelect
          options={COLOR_PALETTE}
          value={value.bestColors}
          onChange={(v) => onChange({ ...value, bestColors: v, avoidColors: value.avoidColors.filter((c) => !v.includes(c)) })}
        />
      </Field>
      <Field label="Colours to go easy on">
        <ChipSelect
          options={COLOR_PALETTE.filter((c) => !value.bestColors.includes(c))}
          value={value.avoidColors}
          onChange={(v) => set("avoidColors", v)}
        />
      </Field>

      <Field label="In a sentence" hint="This is what the stylist keeps in mind. Edit it freely.">
        <Textarea value={value.summary} rows={3} onChange={(e) => set("summary", e.target.value)} />
      </Field>
    </div>
  );
}
