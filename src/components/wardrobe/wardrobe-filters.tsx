"use client";

import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CLOTHING_CATEGORIES, type WardrobeFilters } from "@/types/wardrobe";

const SORTS: { value: WardrobeFilters["sort"]; label: string }[] = [
  { value: "recent", label: "Recently added" },
  { value: "most-worn", label: "Most worn" },
  { value: "least-worn", label: "Least worn" },
  { value: "never-worn", label: "Never worn" },
  { value: "name", label: "Name (A–Z)" },
];

export function WardrobeFiltersBar({
  filters,
  onChange,
}: {
  filters: WardrobeFilters;
  onChange: (f: WardrobeFilters) => void;
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
      <div className="relative flex-1">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search your wardrobe..."
          value={filters.search}
          onChange={(e) => onChange({ ...filters, search: e.target.value })}
          className="pl-10"
        />
      </div>

      <div className="flex gap-2">
        <Select
          value={filters.category}
          onValueChange={(v) => onChange({ ...filters, category: v as WardrobeFilters["category"] })}
        >
          <SelectTrigger className="w-[150px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="All">All categories</SelectItem>
            {CLOTHING_CATEGORIES.map((c) => (
              <SelectItem key={c} value={c}>
                {c}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filters.sort} onValueChange={(v) => onChange({ ...filters, sort: v as WardrobeFilters["sort"] })}>
          <SelectTrigger className="w-[170px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SORTS.map((s) => (
              <SelectItem key={s.value} value={s.value}>
                {s.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
