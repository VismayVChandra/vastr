export interface Product {
  id: string;
  name: string;
  brand: string;
  category: string;
  price: number;
  currency: string;
  rating: number;
  imageUrl: string;
  colors: string[];
  tags: string[];
  url: string;
}

export interface WishlistEntry {
  id: string;
  userId: string;
  productId: string;
  createdAt: string;
}

export interface TripItem {
  label: string;
  quantity: number;
  fromWardrobeItemIds: string[];
  fulfilled: boolean;
}

export interface Trip {
  id: string;
  userId: string;
  destination: string;
  startDate: string | null;
  endDate: string | null;
  durationDays: number;
  activities: string[];
  notes: string | null;
  packingList: TripItem[];
  missingItems: MissingTripItem[];
  createdAt: string;
}

export interface MissingTripItem {
  label: string;
  reason: string;
}

export type TripInput = Pick<Trip, "destination" | "durationDays" | "activities" | "notes">;
