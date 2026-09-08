"use client";

import { Heart, MoreVertical, Pencil, Trash2 } from "lucide-react";
import { ClothingSwatch } from "@/components/shared/clothing-swatch";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { relativeDays } from "@/lib/utils";
import type { WardrobeItem } from "@/types/wardrobe";
import { cn } from "@/lib/utils";

interface ClothingCardProps {
  item: WardrobeItem;
  onEdit: () => void;
  onDelete: () => void;
  onToggleFavorite: () => void;
  selectable?: boolean;
  selected?: boolean;
  onSelect?: () => void;
}

export function ClothingCard({
  item,
  onEdit,
  onDelete,
  onToggleFavorite,
  selectable,
  selected,
  onSelect,
}: ClothingCardProps) {
  return (
    <div
      className={cn(
        "group relative rounded-2xl border border-border bg-card overflow-hidden transition-all hover:shadow-md",
        selectable && "cursor-pointer",
        selected && "ring-2 ring-accent"
      )}
      onClick={selectable ? onSelect : undefined}
    >
      <ClothingSwatch
        imageUrl={item.imageUrl}
        name={item.name}
        category={item.category}
        primaryColor={item.primaryColor}
        className="aspect-[3/4] w-full"
      />

      <button
        onClick={(e) => {
          e.stopPropagation();
          onToggleFavorite();
        }}
        className="absolute top-2 left-2 rounded-full bg-background/85 p-1.5 backdrop-blur-sm hover:bg-background transition-colors"
      >
        <Heart
          className={cn("h-3.5 w-3.5", item.favorite ? "fill-accent text-accent" : "text-foreground")}
        />
      </button>

      {!selectable && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              onClick={(e) => e.stopPropagation()}
              className="absolute top-2 right-2 rounded-full bg-background/85 p-1.5 backdrop-blur-sm hover:bg-background transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100"
            >
              <MoreVertical className="h-3.5 w-3.5" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={onEdit}>
              <Pencil className="h-3.5 w-3.5" /> Edit
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onDelete} className="text-destructive">
              <Trash2 className="h-3.5 w-3.5" /> Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      <div className="p-3">
        <p className="truncate text-sm font-medium">{item.name}</p>
        <div className="mt-1 flex items-center justify-between text-xs text-muted-foreground">
          <span>{item.category}</span>
          <span>{item.timesWorn === 0 ? "Never worn" : relativeDays(item.lastWornAt)}</span>
        </div>
      </div>
    </div>
  );
}
