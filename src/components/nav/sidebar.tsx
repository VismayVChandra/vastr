"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { NAV_ITEMS } from "./nav-items";
import { useAuth } from "@/hooks/use-auth";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

export function Sidebar() {
  const pathname = usePathname();
  const { profile } = useAuth();

  return (
    <aside className="hidden lg:flex lg:w-64 lg:flex-col lg:fixed lg:inset-y-0 border-r border-border bg-card/60 backdrop-blur-sm">
      <div className="flex h-20 items-center px-7">
        <Link href="/home" className="font-display text-2xl tracking-tight">
          Vastr
        </Link>
      </div>

      <nav className="flex-1 space-y-1 px-4">
        {NAV_ITEMS.map((item) => {
          const active = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition-colors",
                active
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-secondary hover:text-foreground"
              )}
            >
              <item.icon className="h-4.5 w-4.5" strokeWidth={active ? 2.25 : 1.75} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <Link
        href="/profile"
        className="m-4 flex items-center gap-3 rounded-xl p-3 hover:bg-secondary transition-colors"
      >
        <Avatar className="h-9 w-9">
          <AvatarFallback>{(profile?.name || "V").charAt(0).toUpperCase()}</AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{profile?.name || "Your profile"}</p>
          <p className="truncate text-xs text-muted-foreground">
            {profile?.preferences.preferredStyles[0] ?? "Set up your style"}
          </p>
        </div>
      </Link>
    </aside>
  );
}
