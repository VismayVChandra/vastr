# Vastr — AI Personal Stylist

A digital wardrobe and AI stylist: add your clothes, tell Vastr about your day, and get outfits built from what you actually own — matched to weather, occasion, and your style.

## Running locally

```bash
npm install
npm run dev
```

Open http://localhost:3000. With no environment variables set, the app runs in **local demo mode**: it creates a browser-local profile, seeds a 12-item starter wardrobe, and persists everything to `localStorage`. No signup, no API keys — the whole product is usable immediately.

## Environment variables

See `.env.example`. Everything is optional:

| Variable | Effect when set | Behavior when unset |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Real auth (email/password), Postgres storage, image uploads to Supabase Storage, row-level security | Local demo mode (`localStorage`) |
| `GEMINI_API_KEY` | Real vision analysis of clothing photos + LLM-generated outfit reasoning, via Gemini (checked first) | — |
| `ANTHROPIC_API_KEY` | Same, via Claude — used only if `GEMINI_API_KEY` isn't set | — |

If neither AI key is set: offline mock vision (filename-hinted, clearly labeled) + a rule-based outfit engine scoring your real wardrobe by formality, weather, color preference, and recency.

Weather (via [Open-Meteo](https://open-meteo.com), no key required) always works — it uses the browser's geolocation when granted, and falls back to a mock snapshot otherwise.

## Supabase setup (optional)

1. Create a project at [supabase.com](https://supabase.com).
2. In the SQL editor, run `supabase/schema.sql` — creates all tables, RLS policies, a public `wardrobe` storage bucket, and a trigger that provisions a `profiles` row on signup.
3. Copy your project URL and anon key into `.env.local` as `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
4. Restart the dev server. `/signup` and `/login` now create real accounts.

## AI setup (optional)

1. Get a free key at [aistudio.google.com/apikey](https://aistudio.google.com/apikey) (no billing setup required, generous free tier).
2. Add `GEMINI_API_KEY=...` to `.env.local`, restart the dev server.

That's it — vision analysis (`/api/analyze-image`) and outfit generation (`/api/outfits/generate`) automatically switch from their mock implementations to real Gemini calls, with structured-JSON responses (`responseMimeType: "application/json"`) validated by Zod. If a real call ever fails or returns something invalid, each route gracefully falls back to its mock counterpart rather than erroring. `ANTHROPIC_API_KEY` works the same way as a fallback provider if you'd rather use Claude — set it instead of (or in addition to; Gemini takes priority) the Gemini key.

## Architecture

- **Next.js App Router + TypeScript + Tailwind v4**, hand-built UI primitives (`src/components/ui`) on Radix + CVA — no external component library.
- **Dual persistence layer** (`src/services/*`): every service function checks `isSupabaseConfigured` and transparently uses either Supabase or a `localStorage`-backed store (`src/lib/store`). Components never know which backend is active.
- **AI provider abstraction** (`src/lib/ai/*`): vision and stylist logic each have two real implementations (Gemini, Anthropic) plus a mock implementation; `config.ts` picks whichever provider has a key set (Gemini first) with no other code changes needed. The stylist is never handed the whole database — `stylist-context.ts` builds a compact, structured payload, and the model's JSON response is Zod-validated with item IDs cross-checked against the real wardrobe before use.
- **Weather** (`src/lib/weather/*`): Open-Meteo + BigDataCloud reverse geocoding, both keyless, with a mock fallback.
- **State**: Zustand stores for wardrobe/outfits/wishlist (`src/store`), a small pub-sub auth hook for profile/session (`src/hooks/use-auth.ts`).

## What was built

- **Onboarding** — 9-step wizard (name, styling category, styles, colors loved/avoided, occasions, budget) ending in a "scan clothes" / "add manually" / "skip" choice.
- **Digital wardrobe** — add/edit/delete, AI photo analysis with an editable review step, search/filter (category, sort by most/least/never worn, recent), color-block placeholders for photo-less items.
- **Home dashboard** — "Today's Outfit" generated from real weather + wardrobe, wear/save/regenerate/why-this actions.
- **Style Me** — occasion/activity/style/color inputs (or "Surprise me") → 3 generated looks.
- **AI Stylist chat** — free-text conversation, outfits rendered inline as cards, persisted chat history.
- **Outfit history** — every saved/worn outfit with 👍/🙂/👎 feedback (+ reason chips on negative).
- **Wardrobe insights** — most worn, forgotten, most versatile, detected gaps with a recommendation.
- **Shop** — seeded mock catalog, category filter, wishlist, "Complete the Look" from any outfit's missing pieces, "Import a purchase" (photo → AI-filled wardrobe item).
- **Pack for a Trip** — destination/duration/activities → packing list built from owned items, with shortfalls flagged.
- **Profile** — editable style preferences, links to History/Insights/Trips.

## Known limitations

- Mock AI (no `GEMINI_API_KEY` / `ANTHROPIC_API_KEY`) is rule-based, not a real vision model — it can't actually "see" a photo, so it estimates from the filename and falls back to sensible defaults you're expected to correct.
- "Import a purchase" supports photo upload only; per the brief, no live e-commerce scraping was implemented (by design — the shop catalog is mock/seeded and structured so a real affiliate API can replace `src/lib/store/products.ts` later without touching UI code).
- Trip packing uses the rule-based engine only (no LLM path yet), though it follows the same swappable-service pattern as the rest of the AI layer.
- No automated test suite — verification so far has been manual, end-to-end in-browser.

## Recommended next features

- Real e-commerce/affiliate integration behind `services/shop-service.ts`.
- LLM-backed trip packing for more nuanced itineraries.
- Outfit-combination learning from repeated 👎 feedback (currently feedback is stored but not yet fed back into generation scoring).
- Multi-photo wardrobe items (front/back/detail shots).
