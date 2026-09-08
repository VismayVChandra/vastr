"use client";

import { useState } from "react";
import { Luggage } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { ChipSelect } from "@/components/shared/chip-select";
import { ClothingSwatch } from "@/components/shared/clothing-swatch";
import { useAuth } from "@/hooks/use-auth";
import { useWardrobeStore } from "@/store/wardrobe-store";
import { resolveItems } from "@/lib/resolve-items";
import { saveTrip } from "@/services/trip-service";
import type { Trip } from "@/types/shop";
import { toast } from "sonner";

const ACTIVITY_OPTIONS = [
  "Sightseeing",
  "Beach",
  "Hiking",
  "Business meetings",
  "Nightlife",
  "Dinners",
  "Sports",
  "Wedding",
];

export default function TripsPage() {
  const { profile } = useAuth();
  const items = useWardrobeStore((s) => s.items);

  const [destination, setDestination] = useState("");
  const [duration, setDuration] = useState(4);
  const [activities, setActivities] = useState<string[]>([]);
  const [notes, setNotes] = useState("");
  const [planning, setPlanning] = useState(false);
  const [trip, setTrip] = useState<Trip | null>(null);

  async function handlePlan() {
    if (!profile || !destination.trim()) {
      toast.error("Add a destination first.");
      return;
    }
    setPlanning(true);
    try {
      const res = await fetch("/api/trips/pack", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wardrobe: items, destination, durationDays: duration, activities }),
      });
      const data = await res.json();
      const saved = await saveTrip(profile.id, {
        destination,
        startDate: null,
        endDate: null,
        durationDays: duration,
        activities,
        notes: notes || null,
        packingList: data.packingList,
        missingItems: data.missingItems,
      });
      setTrip(saved);
    } catch {
      toast.error("Couldn't plan this trip. Try again.");
    } finally {
      setPlanning(false);
    }
  }

  return (
    <div>
      <PageHeader title="Pack for a Trip" description="Tell me where you're headed and for how long." />

      <div className="grid gap-8 lg:grid-cols-[340px_1fr]">
        <div className="space-y-5 rounded-2xl border border-border bg-card p-5 h-fit">
          <div className="space-y-1.5">
            <Label>Destination</Label>
            <Input
              placeholder="Goa, Paris, a work trip to Delhi..."
              value={destination}
              onChange={(e) => setDestination(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Duration (days)</Label>
            <Input
              type="number"
              min={1}
              max={30}
              value={duration}
              onChange={(e) => setDuration(Number(e.target.value) || 1)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Activities</Label>
            <ChipSelect options={ACTIVITY_OPTIONS} value={activities} onChange={setActivities} />
          </div>
          <div className="space-y-1.5">
            <Label>Notes (optional)</Label>
            <Textarea
              placeholder="Anything else worth knowing..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
          <Button className="w-full" onClick={handlePlan} disabled={planning}>
            {planning ? "Planning..." : "Build packing list"}
          </Button>
        </div>

        <div>
          {!trip ? (
            <EmptyState
              icon={Luggage}
              title="No trip planned yet"
              description="Fill in your trip details and I'll build a packing list from your wardrobe."
            />
          ) : (
            <div className="space-y-5">
              <div>
                <h2 className="font-display text-xl">{trip.destination}</h2>
                <p className="text-sm text-muted-foreground">
                  {trip.durationDays} day{trip.durationDays > 1 ? "s" : ""}
                  {trip.activities.length ? ` · ${trip.activities.join(", ")}` : ""}
                </p>
              </div>

              <div className="space-y-4">
                {trip.packingList.map((entry, i) => (
                  <div key={i} className="rounded-2xl border border-border bg-card p-4">
                    <div className="flex items-center justify-between mb-3">
                      <p className="text-sm font-medium">
                        {entry.label} <span className="text-muted-foreground">× {entry.quantity}</span>
                      </p>
                      {!entry.fulfilled && (
                        <span className="text-xs text-destructive">Short by {entry.quantity - entry.fromWardrobeItemIds.length}</span>
                      )}
                    </div>
                    <div className="flex gap-2 flex-wrap">
                      {resolveItems(items, entry.fromWardrobeItemIds).map((item) => (
                        <ClothingSwatch
                          key={item.id}
                          imageUrl={item.imageUrl}
                          name={item.name}
                          category={item.category}
                          primaryColor={item.primaryColor}
                          className="h-16 w-14 rounded-lg"
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              {trip.missingItems.length > 0 && (
                <div className="rounded-2xl border border-dashed border-border bg-card/50 p-4 space-y-1.5">
                  <p className="text-sm font-medium">You might be short on a few things</p>
                  {trip.missingItems.map((m, i) => (
                    <p key={i} className="text-xs text-muted-foreground">
                      • {m.reason}
                    </p>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
