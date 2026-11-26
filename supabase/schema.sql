-- Vastr — AI Personal Stylist
-- Run this in the Supabase SQL editor (or `supabase db push`) on a fresh project.

create extension if not exists "pgcrypto";

-- =========================================================
-- profiles
-- =========================================================
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  name text not null default '',
  gender text not null default '',
  avatar_url text,
  onboarding_complete boolean not null default false,
  preferred_styles text[] not null default '{}',
  favorite_colors text[] not null default '{}',
  disliked_colors text[] not null default '{}',
  occasions text[] not null default '{}',
  budget text not null default 'Mid-range',
  location jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- =========================================================
-- wardrobe_items
-- =========================================================
create table if not exists public.wardrobe_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  image_url text,
  name text not null,
  category text not null,
  subcategory text,
  primary_color text not null,
  secondary_colors text[] not null default '{}',
  pattern text not null default 'solid',
  material text,
  brand text,
  size text,
  fit text not null default 'regular',
  season text[] not null default '{all-season}',
  formality text not null default 'casual',
  style_tags text[] not null default '{}',
  times_worn integer not null default 0,
  last_worn_at timestamptz,
  favorite boolean not null default false,
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists wardrobe_items_user_id_idx on public.wardrobe_items (user_id);
create index if not exists wardrobe_items_category_idx on public.wardrobe_items (category);

-- =========================================================
-- outfits  (outfit_items folded into item_ids for MVP simplicity)
-- =========================================================
create table if not exists public.outfits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  item_ids uuid[] not null default '{}',
  reason text not null default '',
  occasion text,
  missing_items jsonb not null default '[]',
  saved boolean not null default false,
  worn_at timestamptz[] not null default '{}',
  rating text,
  feedback_reasons text[] not null default '{}',
  feedback_note text,
  source text not null default 'manual',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists outfits_user_id_idx on public.outfits (user_id);

-- =========================================================
-- wishlist
-- =========================================================
create table if not exists public.wishlist (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  product jsonb not null,
  created_at timestamptz not null default now()
);

-- =========================================================
-- trips
-- =========================================================
create table if not exists public.trips (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  destination text not null,
  start_date date,
  end_date date,
  duration_days integer not null default 1,
  activities text[] not null default '{}',
  notes text,
  packing_list jsonb not null default '[]',
  missing_items jsonb not null default '[]',
  created_at timestamptz not null default now()
);

-- =========================================================
-- chat_sessions / chat_messages
-- =========================================================
create table if not exists public.chat_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null default 'New conversation',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.chat_sessions (id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  outfits jsonb,
  created_at timestamptz not null default now()
);

create index if not exists chat_messages_session_id_idx on public.chat_messages (session_id);

-- =========================================================
-- Row Level Security — every table is owner-only
-- =========================================================
alter table public.profiles enable row level security;
alter table public.wardrobe_items enable row level security;
alter table public.outfits enable row level security;
alter table public.wishlist enable row level security;
alter table public.trips enable row level security;
alter table public.chat_sessions enable row level security;
alter table public.chat_messages enable row level security;

create policy "profiles: owner read" on public.profiles for select using (auth.uid() = id);
create policy "profiles: owner insert" on public.profiles for insert with check (auth.uid() = id);
create policy "profiles: owner update" on public.profiles for update using (auth.uid() = id);

create policy "wardrobe_items: owner all" on public.wardrobe_items for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "outfits: owner all" on public.outfits for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "wishlist: owner all" on public.wishlist for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "trips: owner all" on public.trips for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "chat_sessions: owner all" on public.chat_sessions for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "chat_messages: owner all" on public.chat_messages for all
  using (
    exists (
      select 1 from public.chat_sessions s
      where s.id = chat_messages.session_id and s.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.chat_sessions s
      where s.id = chat_messages.session_id and s.user_id = auth.uid()
    )
  );

-- =========================================================
-- auto-create a profile row on signup
-- =========================================================
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, name)
  values (new.id, coalesce(new.raw_user_meta_data->>'name', ''));
  return new;
end;
$$ language plpgsql security definer set search_path = public;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- =========================================================
-- Storage bucket for wardrobe photos
-- =========================================================
insert into storage.buckets (id, name, public)
values ('wardrobe', 'wardrobe', true)
on conflict (id) do nothing;

create policy "wardrobe images: public read"
  on storage.objects for select
  using (bucket_id = 'wardrobe');

create policy "wardrobe images: owner write"
  on storage.objects for insert
  with check (bucket_id = 'wardrobe' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "wardrobe images: owner delete"
  on storage.objects for delete
  using (bucket_id = 'wardrobe' and auth.uid()::text = (storage.foldername(name))[1]);

-- =========================================================
-- Migration: fit profile (added after the first release)
-- Run this once on an existing database. Safe to re-run.
-- Holds what suits the person (build, colouring, flattering cuts), used by the stylist.
-- =========================================================
alter table public.profiles add column if not exists fit_profile jsonb;
