"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { ProductCard } from "@/components/shop/product-card";
import { useAuth } from "@/hooks/use-auth";
import { useWishlistStore } from "@/store/wishlist-store";
import { fetchRecommendedProducts } from "@/services/shop-service";
import type { MissingPiece } from "@/types/outfit";
import type { Product } from "@/types/shop";

export function CompleteLookDialog({
  open,
  onOpenChange,
  missingItems,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  missingItems: MissingPiece[];
}) {
  const { profile } = useAuth();
  const { toggle, isWishlisted, load } = useWishlistStore();
  const [products, setProducts] = useState<Product[]>([]);

  useEffect(() => {
    if (!open) return;
    if (profile) load(profile.id);
    fetchRecommendedProducts(
      missingItems.map((m) => m.category),
      profile?.preferences.preferredStyles ?? [],
      6
    ).then(setProducts);
  }, [open, missingItems, profile, load]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Complete the look</DialogTitle>
          <DialogDescription>
            {missingItems.map((m) => m.description).join(", ") || "Recommended pieces for this outfit."}
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-h-[60vh] overflow-y-auto">
          {products.map((p) => (
            <ProductCard
              key={p.id}
              product={p}
              wishlisted={isWishlisted(p.id)}
              onToggleWishlist={() => profile && toggle(profile.id, p)}
            />
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
