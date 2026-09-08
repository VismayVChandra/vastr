"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Flame, Layers, Moon, Sparkles } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { ClothingSwatch } from "@/components/shared/clothing-swatch";
import { ProductCard } from "@/components/shop/product-card";
import { EmptyState } from "@/components/shared/empty-state";
import { useWardrobeStore } from "@/store/wardrobe-store";
import { useAuth } from "@/hooks/use-auth";
import { computeInsights, type WardrobeGap } from "@/lib/insights";
import { fetchRecommendedProducts } from "@/services/shop-service";
import type { Product } from "@/types/shop";
import type { WornItemInsight } from "@/lib/insights";

export default function InsightsPage() {
  const items = useWardrobeStore((s) => s.items);
  const { profile } = useAuth();
  const insights = useMemo(() => computeInsights(items), [items]);

  if (items.length < 3) {
    return (
      <div>
        <BackLink />
        <EmptyState
          icon={Sparkles}
          title="Not enough data yet"
          description="Add a few more wardrobe items so I can start surfacing insights about what you wear."
        />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <BackLink />
      <PageHeader
        title="Wardrobe Insights"
        description={`${insights.totalItems} items · ${insights.neverWornCount} never worn`}
      />

      <div className="grid gap-5 sm:grid-cols-3">
        <InsightGroup icon={Flame} title="Most worn" items={insights.mostWorn} empty="Wear a few outfits to see this." />
        <InsightGroup icon={Moon} title="Forgotten" items={insights.forgotten} empty="Nothing's been forgotten yet." />
        <InsightGroup
          icon={Layers}
          title="Most versatile"
          items={insights.mostVersatile}
          empty="Add more items to see pairings."
        />
      </div>

      {insights.gaps.length > 0 && (
        <div className="space-y-4">
          <h2 className="font-display text-xl">Wardrobe gaps</h2>
          {insights.gaps.map((gap, i) => (
            <GapCard key={i} gap={gap} preferredStyles={profile?.preferences.preferredStyles ?? []} />
          ))}
        </div>
      )}
    </div>
  );
}

function BackLink() {
  return (
    <Link
      href="/wardrobe"
      className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
    >
      <ArrowLeft className="h-3.5 w-3.5" /> Back to wardrobe
    </Link>
  );
}

function InsightGroup({
  icon: Icon,
  title,
  items,
  empty,
}: {
  icon: typeof Flame;
  title: string;
  items: WornItemInsight[];
  empty: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 text-accent" />
        <h3 className="font-medium text-sm">{title}</h3>
      </div>
      {items.length === 0 ? (
        <p className="text-xs text-muted-foreground">{empty}</p>
      ) : (
        <div className="space-y-3">
          {items.map(({ item, detail }) => (
            <div key={item.id} className="flex items-center gap-3">
              <ClothingSwatch
                imageUrl={item.imageUrl}
                name={item.name}
                category={item.category}
                primaryColor={item.primaryColor}
                className="h-12 w-12 rounded-lg shrink-0"
              />
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{item.name}</p>
                <p className="text-xs text-muted-foreground">{detail}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function GapCard({ gap, preferredStyles }: { gap: WardrobeGap; preferredStyles: string[] }) {
  const [products, setProducts] = useState<Product[]>([]);

  useEffect(() => {
    fetchRecommendedProducts([gap.recommendationCategory], preferredStyles, 3).then(setProducts);
  }, [gap, preferredStyles]);

  return (
    <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
      <div>
        <p className="text-sm text-muted-foreground">{gap.headline}</p>
        <p className="mt-1.5 flex items-start gap-1.5 text-sm font-medium">
          <Sparkles className="h-4 w-4 text-accent shrink-0 mt-0.5" />
          {gap.recommendationText}
        </p>
      </div>
      {products.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {products.map((p) => (
            <ProductCard key={p.id} product={p} />
          ))}
        </div>
      )}
    </div>
  );
}
