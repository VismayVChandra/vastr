import { Shirt, Footprints, Watch } from "lucide-react";
import { cn } from "@/lib/utils";
import { swatchFor } from "@/lib/colors";
import type { ClothingCategory } from "@/types/wardrobe";

function iconFor(category: ClothingCategory) {
  if (category === "Shoes") return Footprints;
  if (category === "Accessories") return Watch;
  return Shirt;
}

export function ClothingSwatch({
  imageUrl,
  name,
  category,
  primaryColor,
  className,
}: {
  imageUrl: string | null;
  name: string;
  category: ClothingCategory;
  primaryColor: string;
  className?: string;
}) {
  if (imageUrl) {
    return (
      <div className={cn("relative overflow-hidden bg-secondary", className)}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={imageUrl}
          alt={name}
          className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
      </div>
    );
  }

  const Icon = iconFor(category);
  const bg = swatchFor(primaryColor);

  return (
    <div
      className={cn("relative flex items-center justify-center overflow-hidden", className)}
      style={{
        background: `linear-gradient(155deg, ${bg}dd, ${bg}99)`,
      }}
    >
      <Icon className="h-10 w-10 text-white/70" strokeWidth={1.25} />
    </div>
  );
}
