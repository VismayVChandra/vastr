import { usesSupabase } from "@/lib/demo";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { tripCollection } from "@/lib/store/local-db";
import { uid } from "@/lib/utils";
import type { Trip } from "@/types/shop";

export async function listTrips(userId: string): Promise<Trip[]> {
  if (usesSupabase()) {
    const supabase = getSupabaseBrowserClient()!;
    const { data, error } = await supabase
      .from("trips")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (data ?? []).map((r) => ({
      id: r.id,
      userId: r.user_id,
      destination: r.destination,
      startDate: r.start_date,
      endDate: r.end_date,
      durationDays: r.duration_days,
      activities: r.activities ?? [],
      notes: r.notes,
      packingList: (r.packing_list as Trip["packingList"]) ?? [],
      missingItems: (r.missing_items as Trip["missingItems"]) ?? [],
      createdAt: r.created_at,
    }));
  }
  return tripCollection
    .list()
    .filter((t) => t.userId === userId)
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

export async function saveTrip(
  userId: string,
  trip: Omit<Trip, "id" | "userId" | "createdAt">
): Promise<Trip> {
  if (usesSupabase()) {
    const supabase = getSupabaseBrowserClient()!;
    const { data, error } = await supabase
      .from("trips")
      .insert({
        user_id: userId,
        destination: trip.destination,
        duration_days: trip.durationDays,
        activities: trip.activities,
        notes: trip.notes,
        packing_list: trip.packingList as unknown as never,
        missing_items: trip.missingItems as unknown as never,
      })
      .select("*")
      .single();
    if (error) throw error;
    return {
      id: data.id,
      userId: data.user_id,
      destination: data.destination,
      startDate: data.start_date,
      endDate: data.end_date,
      durationDays: data.duration_days,
      activities: data.activities ?? [],
      notes: data.notes,
      packingList: (data.packing_list as Trip["packingList"]) ?? [],
      missingItems: (data.missing_items as Trip["missingItems"]) ?? [],
      createdAt: data.created_at,
    };
  }
  const record: Trip = {
    ...trip,
    id: uid(),
    userId,
    createdAt: new Date().toISOString(),
  };
  return tripCollection.insert(record);
}
