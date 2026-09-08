import { Home, Shirt, Sparkles, MessageCircle, ShoppingBag, User } from "lucide-react";

export const NAV_ITEMS = [
  { href: "/home", label: "Home", icon: Home },
  { href: "/wardrobe", label: "Wardrobe", icon: Shirt },
  { href: "/style-me", label: "Style Me", icon: Sparkles },
  { href: "/stylist", label: "AI Stylist", icon: MessageCircle },
  { href: "/shop", label: "Shop", icon: ShoppingBag },
  { href: "/profile", label: "Profile", icon: User },
] as const;
