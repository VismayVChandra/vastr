"use client";

import Link from "next/link";
import { Sparkles, Camera, MessageCircle, Luggage, ScanSearch } from "lucide-react";

const ACTIONS = [
  { href: "/style-me", label: "Style me", icon: Sparkles },
  { href: "/wardrobe?add=1", label: "Add clothes", icon: Camera },
  { href: "/stylist", label: "Ask stylist", icon: MessageCircle },
  { href: "/inspiration", label: "Check an inspo", icon: ScanSearch },
  { href: "/trips", label: "Pack for a trip", icon: Luggage },
];

export function QuickActions() {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
      {ACTIONS.map((a) => (
        <Link
          key={a.href}
          href={a.href}
          className="flex flex-col items-center gap-2 rounded-2xl border border-border bg-card px-4 py-5 text-center hover:border-accent/40 hover:shadow-sm transition-all"
        >
          <div className="rounded-full bg-accent/10 p-2.5 text-accent">
            <a.icon className="h-4.5 w-4.5" />
          </div>
          <span className="text-xs font-medium">{a.label}</span>
        </Link>
      ))}
    </div>
  );
}
