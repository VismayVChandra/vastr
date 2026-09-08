"use client";

import { Heart, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Product } from "@/types/shop";

export function ProductCard({
  product,
  wishlisted,
  onToggleWishlist,
}: {
  product: Product;
  wishlisted?: boolean;
  onToggleWishlist?: () => void;
}) {
  return (
    <div className="group rounded-2xl border border-border bg-card overflow-hidden hover:shadow-md transition-shadow">
      <div className="relative aspect-[4/5] overflow-hidden bg-secondary">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={product.imageUrl}
          alt={product.name}
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
        {onToggleWishlist && (
          <button
            onClick={onToggleWishlist}
            className="absolute top-2 right-2 rounded-full bg-background/85 p-1.5 backdrop-blur-sm hover:bg-background transition-colors"
          >
            <Heart className={cn("h-3.5 w-3.5", wishlisted ? "fill-accent text-accent" : "text-foreground")} />
          </button>
        )}
      </div>
      <div className="p-3.5 space-y-1.5">
        <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{product.brand}</p>
        <p className="text-sm font-medium truncate">{product.name}</p>
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">
            ₹{product.price.toLocaleString("en-IN")}
          </span>
          <span className="flex items-center gap-0.5 text-xs text-muted-foreground">
            <Star className="h-3 w-3 fill-accent text-accent" /> {product.rating}
          </span>
        </div>
        <Button size="sm" variant="outline" className="w-full mt-1" asChild>
          <a href={product.url} target="_blank" rel="noopener noreferrer">
            Shop
          </a>
        </Button>
      </div>
    </div>
  );
}
