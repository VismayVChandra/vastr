"use client";

import { cn } from "@/lib/utils";

interface ChipSelectProps {
  options: readonly string[];
  value: string[];
  onChange: (value: string[]) => void;
  multiple?: boolean;
  className?: string;
}

export function ChipSelect({ options, value, onChange, multiple = true, className }: ChipSelectProps) {
  const toggle = (opt: string) => {
    if (multiple) {
      onChange(value.includes(opt) ? value.filter((v) => v !== opt) : [...value, opt]);
    } else {
      onChange([opt]);
    }
  };

  return (
    <div className={cn("flex flex-wrap gap-2", className)}>
      {options.map((opt) => {
        const active = value.includes(opt);
        return (
          <button
            key={opt}
            type="button"
            onClick={() => toggle(opt)}
            className={cn(
              "rounded-full border px-4 py-2 text-sm font-medium capitalize transition-all",
              active
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-card text-foreground hover:border-primary/40"
            )}
          >
            {opt}
          </button>
        );
      })}
    </div>
  );
}
