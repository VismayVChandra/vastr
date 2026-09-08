"use client";

import { useEffect, useMemo, useState } from "react";
import { Heart, Upload } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ProductCard } from "@/components/shop/product-card";
import { AddItemDialog } from "@/components/wardrobe/add-item-dialog";
import { useAuth } from "@/hooks/use-auth";
import { useWishlistStore } from "@/store/wishlist-store";
import { fetchProducts } from "@/services/shop-service";
import { CLOTHING_CATEGORIES } from "@/types/wardrobe";
import type { Product } from "@/types/shop";

export default function ShopPage() {
  const { profile } = useAuth();
  const { entries, load, toggle, isWishlisted } = useWishlistStore();
  const [products, setProducts] = useState<Product[]>([]);
  const [category, setCategory] = useState<string>("All");
  const [importOpen, setImportOpen] = useState(false);

  useEffect(() => {
    fetchProducts().then(setProducts);
  }, []);

  useEffect(() => {
    if (profile) load(profile.id);
  }, [profile, load]);

  const filtered = useMemo(
    () => (category === "All" ? products : products.filter((p) => p.category === category)),
    [products, category]
  );

  const wishlistedProducts = products.filter((p) => isWishlisted(p.id));

  return (
    <div>
      <PageHeader
        title="Shop"
        description="Mock recommendations today — ready to plug into a real catalogue later."
        action={
          <Button variant="outline" onClick={() => setImportOpen(true)}>
            <Upload className="h-4 w-4" /> Import a purchase
          </Button>
        }
      />

      <Tabs defaultValue="browse">
        <TabsList>
          <TabsTrigger value="browse">Browse</TabsTrigger>
          <TabsTrigger value="wishlist">
            Wishlist {entries.length > 0 && `(${entries.length})`}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="browse" className="space-y-5">
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger className="w-[180px]">
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

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {filtered.map((p) => (
              <ProductCard
                key={p.id}
                product={p}
                wishlisted={isWishlisted(p.id)}
                onToggleWishlist={() => profile && toggle(profile.id, p)}
              />
            ))}
          </div>
        </TabsContent>

        <TabsContent value="wishlist">
          {wishlistedProducts.length === 0 ? (
            <EmptyState
              icon={Heart}
              title="Your wishlist is empty"
              description="Tap the heart on any product to save it here."
            />
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {wishlistedProducts.map((p) => (
                <ProductCard
                  key={p.id}
                  product={p}
                  wishlisted
                  onToggleWishlist={() => profile && toggle(profile.id, p)}
                />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <AddItemDialog open={importOpen} onOpenChange={setImportOpen} />
    </div>
  );
}
