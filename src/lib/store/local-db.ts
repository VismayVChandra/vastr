"use client";

import { uid } from "@/lib/utils";
import type { WardrobeItem } from "@/types/wardrobe";
import type { Outfit } from "@/types/outfit";
import type { UserProfile } from "@/types/user";
import { DEFAULT_PREFERENCES } from "@/types/user";
import type { WishlistEntry, Trip } from "@/types/shop";
import type { ChatMessage, ChatSession } from "@/types/chat";
import { buildSeedOutfits, buildSeedWardrobe } from "./seed-data";

const NS = "vastr";
const DEMO_USER_KEY = `${NS}:demo-user-id`;

function isBrowser() {
  return typeof window !== "undefined";
}

function readCollection<T>(key: string): T[] {
  if (!isBrowser()) return [];
  try {
    const raw = window.localStorage.getItem(`${NS}:${key}`);
    return raw ? (JSON.parse(raw) as T[]) : [];
  } catch {
    return [];
  }
}

function writeCollection<T>(key: string, value: T[]) {
  if (!isBrowser()) return;
  window.localStorage.setItem(`${NS}:${key}`, JSON.stringify(value));
}

/** Minimal typed CRUD over a localStorage-backed JSON array. Used as the
 *  zero-config persistence layer when Supabase env vars aren't set. */
class LocalCollection<T extends { id: string }> {
  constructor(private key: string) {}

  list(): T[] {
    return readCollection<T>(this.key);
  }

  get(id: string): T | null {
    return this.list().find((row) => row.id === id) ?? null;
  }

  insert(row: T): T {
    const rows = this.list();
    rows.push(row);
    writeCollection(this.key, rows);
    return row;
  }

  update(id: string, patch: Partial<T>): T | null {
    const rows = this.list();
    const idx = rows.findIndex((r) => r.id === id);
    if (idx === -1) return null;
    rows[idx] = { ...rows[idx], ...patch };
    writeCollection(this.key, rows);
    return rows[idx];
  }

  remove(id: string) {
    writeCollection(
      this.key,
      this.list().filter((r) => r.id !== id)
    );
  }

  replaceAll(rows: T[]) {
    writeCollection(this.key, rows);
  }
}

export const wardrobeCollection = new LocalCollection<WardrobeItem>("wardrobe_items");
export const outfitCollection = new LocalCollection<Outfit>("outfits");
export const wishlistCollection = new LocalCollection<WishlistEntry>("wishlist");
export const tripCollection = new LocalCollection<Trip>("trips");
export const chatSessionCollection = new LocalCollection<ChatSession>("chat_sessions");
export const chatMessageCollection = new LocalCollection<ChatMessage>("chat_messages");

function nowIso() {
  return new Date().toISOString();
}

/** Ensures a demo user + profile exists locally, seeding a starter wardrobe
 *  and a couple of past outfits the very first time the app runs. */
export function ensureLocalDemoUser(): UserProfile {
  if (!isBrowser()) {
    return {
      id: "demo",
      email: null,
      name: "",
      gender: "",
      avatarUrl: null,
      onboardingComplete: false,
      preferences: DEFAULT_PREFERENCES,
      location: null,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
  }

  let userId = window.localStorage.getItem(DEMO_USER_KEY);
  const profileKey = `${NS}:profile`;
  const existingProfileRaw = userId ? window.localStorage.getItem(profileKey) : null;

  if (userId && existingProfileRaw) {
    return JSON.parse(existingProfileRaw) as UserProfile;
  }

  userId = uid();
  window.localStorage.setItem(DEMO_USER_KEY, userId);

  const profile: UserProfile = {
    id: userId,
    email: null,
    name: "",
    gender: "",
    avatarUrl: null,
    onboardingComplete: false,
    preferences: DEFAULT_PREFERENCES,
    location: null,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };
  window.localStorage.setItem(profileKey, JSON.stringify(profile));
  return profile;
}

export function saveLocalProfile(profile: UserProfile) {
  if (!isBrowser()) return;
  window.localStorage.setItem(`${NS}:profile`, JSON.stringify(profile));
}

export function getLocalProfile(): UserProfile | null {
  if (!isBrowser()) return null;
  const raw = window.localStorage.getItem(`${NS}:profile`);
  return raw ? (JSON.parse(raw) as UserProfile) : null;
}

/** Populates the demo wardrobe + outfit history once, right after onboarding. */
export function seedLocalDemoData(userId: string) {
  if (!isBrowser()) return;
  const seededKey = `${NS}:seeded`;
  if (window.localStorage.getItem(seededKey)) return;

  const items = buildSeedWardrobe(userId);
  wardrobeCollection.replaceAll(items);
  outfitCollection.replaceAll(buildSeedOutfits(userId, items));
  window.localStorage.setItem(seededKey, "1");
}

export function clearLocalData() {
  if (!isBrowser()) return;
  Object.keys(window.localStorage)
    .filter((k) => k.startsWith(`${NS}:`))
    .forEach((k) => window.localStorage.removeItem(k));
}
