"use client";

import { Suspense, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Plus, Shirt, Sparkles } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { WardrobeFiltersBar } from "@/components/wardrobe/wardrobe-filters";
import { ClothingCard } from "@/components/wardrobe/clothing-card";
import { AddItemDialog } from "@/components/wardrobe/add-item-dialog";
import { useWardrobeStore } from "@/store/wardrobe-store";
import { filterWardrobeItems } from "@/lib/wardrobe-filter";
import { DEFAULT_FILTERS, type WardrobeItem } from "@/types/wardrobe";
import { toast } from "sonner";

export default function WardrobePage() {
  return (
    <Suspense fallback={null}>
      <WardrobePageInner />
    </Suspense>
  );
}

function WardrobePageInner() {
  const searchParams = useSearchParams();
  const { items, loading, removeItem, editItem } = useWardrobeStore();
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [dialogOpen, setDialogOpen] = useState(searchParams.get("add") !== null);
  const [editingItem, setEditingItem] = useState<WardrobeItem | null>(null);

  const filtered = useMemo(() => filterWardrobeItems(items, filters), [items, filters]);

  function openAdd() {
    setEditingItem(null);
    setDialogOpen(true);
  }

  function openEdit(item: WardrobeItem) {
    setEditingItem(item);
    setDialogOpen(true);
  }

  async function handleDelete(item: WardrobeItem) {
    await removeItem(item.id);
    toast.success(`Removed ${item.name}`);
  }

  return (
    <div>
      <PageHeader
        title="Your Wardrobe"
        description={`${items.length} item${items.length === 1 ? "" : "s"} digitized`}
        action={
          <div className="flex items-center gap-2">
            <Button variant="outline" asChild>
              <Link href="/wardrobe/insights">
                <Sparkles className="h-4 w-4" /> Insights
              </Link>
            </Button>
            <Button onClick={openAdd}>
              <Plus className="h-4 w-4" /> Add item
            </Button>
          </div>
        }
      />

      <div className="mb-6">
        <WardrobeFiltersBar filters={filters} onChange={setFilters} />
      </div>

      {loading && items.length === 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="aspect-[3/4] animate-pulse rounded-2xl bg-secondary" />
          ))}
        </div>
      ) : filtered.length === 0 && items.length === 0 ? (
        <EmptyState
          icon={Shirt}
          title="Your wardrobe is empty"
          description="Add your first few pieces — a top, bottom, and shoes are enough to get outfit ideas started."
          actionLabel="Add your first item"
          onAction={openAdd}
        />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Shirt}
          title="No items match"
          description="Try adjusting your search or filters."
        />
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {filtered.map((item) => (
            <ClothingCard
              key={item.id}
              item={item}
              onEdit={() => openEdit(item)}
              onDelete={() => handleDelete(item)}
              onToggleFavorite={() => editItem(item.id, { favorite: !item.favorite })}
            />
          ))}
        </div>
      )}

      <AddItemDialog open={dialogOpen} onOpenChange={setDialogOpen} editingItem={editingItem} />
    </div>
  );
}
