"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { History, LogOut, Luggage, Sparkles, UserRound } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ChipSelect } from "@/components/shared/chip-select";
import { useAuth } from "@/hooks/use-auth";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { COLOR_PALETTE } from "@/lib/colors";
import { BUDGET_OPTIONS, OCCASION_OPTIONS, STYLE_OPTIONS } from "@/types/user";

export default function ProfilePage() {
  const router = useRouter();
  const { profile, updateProfile, signOut, isGuest } = useAuth();

  const [styles, setStyles] = useState<string[]>([]);
  const [favColors, setFavColors] = useState<string[]>([]);
  const [dislikedColors, setDislikedColors] = useState<string[]>([]);
  const [occasions, setOccasions] = useState<string[]>([]);
  const [budget, setBudget] = useState("Mid-range");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!profile) return;
    setStyles(profile.preferences.preferredStyles);
    setFavColors(profile.preferences.favoriteColors);
    setDislikedColors(profile.preferences.dislikedColors);
    setOccasions(profile.preferences.occasions);
    setBudget(profile.preferences.budget);
  }, [profile]);

  async function handleSave() {
    setSaving(true);
    try {
      await updateProfile({
        preferences: {
          preferredStyles: styles,
          favoriteColors: favColors,
          dislikedColors,
          occasions,
          budget,
          // Edited on the My Fit page; saving here must not wipe it.
          fitProfile: profile?.preferences.fitProfile ?? null,
        },
      });
      toast.success("Preferences updated");
    } finally {
      setSaving(false);
    }
  }

  async function handleSignOut() {
    await signOut();
    router.push("/");
  }

  return (
    <div className="space-y-8 max-w-2xl">
      <PageHeader title="Profile" />

      <div className="flex items-center gap-4">
        <Avatar className="h-16 w-16">
          <AvatarFallback className="text-xl">
            {(profile?.name || "V").charAt(0).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <div>
          <p className="font-display text-xl">{profile?.name || "Your name"}</p>
          <p className="text-sm text-muted-foreground">
            {profile?.email ?? (isGuest ? "Guest demo" : isSupabaseConfigured ? "" : "Local demo mode")}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Link
          href="/fit"
          className="flex flex-col items-center gap-2 rounded-2xl border border-border bg-card px-4 py-5 text-center hover:border-accent/40 transition-colors"
        >
          <UserRound className="h-4.5 w-4.5 text-accent" />
          <span className="text-xs font-medium">My fit</span>
        </Link>
        <Link
          href="/history"
          className="flex flex-col items-center gap-2 rounded-2xl border border-border bg-card px-4 py-5 text-center hover:border-accent/40 transition-colors"
        >
          <History className="h-4.5 w-4.5 text-accent" />
          <span className="text-xs font-medium">Outfit History</span>
        </Link>
        <Link
          href="/wardrobe/insights"
          className="flex flex-col items-center gap-2 rounded-2xl border border-border bg-card px-4 py-5 text-center hover:border-accent/40 transition-colors"
        >
          <Sparkles className="h-4.5 w-4.5 text-accent" />
          <span className="text-xs font-medium">Insights</span>
        </Link>
        <Link
          href="/trips"
          className="flex flex-col items-center gap-2 rounded-2xl border border-border bg-card px-4 py-5 text-center hover:border-accent/40 transition-colors"
        >
          <Luggage className="h-4.5 w-4.5 text-accent" />
          <span className="text-xs font-medium">Trips</span>
        </Link>
      </div>

      <div className="space-y-6 rounded-2xl border border-border bg-card p-5">
        <h2 className="font-display text-lg">Style preferences</h2>

        <div className="space-y-1.5">
          <Label>Preferred styles</Label>
          <ChipSelect options={STYLE_OPTIONS} value={styles} onChange={setStyles} />
        </div>
        <div className="space-y-1.5">
          <Label>Colours you love</Label>
          <ChipSelect options={COLOR_PALETTE} value={favColors} onChange={setFavColors} />
        </div>
        <div className="space-y-1.5">
          <Label>Colours to avoid</Label>
          <ChipSelect
            options={COLOR_PALETTE.filter((c) => !favColors.includes(c))}
            value={dislikedColors}
            onChange={setDislikedColors}
          />
        </div>
        <div className="space-y-1.5">
          <Label>Typical occasions</Label>
          <ChipSelect options={OCCASION_OPTIONS} value={occasions} onChange={setOccasions} />
        </div>
        <div className="space-y-1.5">
          <Label>Shopping budget</Label>
          <Select value={budget} onValueChange={setBudget}>
            <SelectTrigger className="w-[200px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {BUDGET_OPTIONS.map((b) => (
                <SelectItem key={b} value={b}>
                  {b}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Button onClick={handleSave} disabled={saving}>
          {saving ? "Saving..." : "Save preferences"}
        </Button>
      </div>

      {isSupabaseConfigured && (
        <Button variant="outline" onClick={handleSignOut}>
          <LogOut className="h-4 w-4" /> {isGuest ? "Exit demo" : "Sign out"}
        </Button>
      )}
    </div>
  );
}
