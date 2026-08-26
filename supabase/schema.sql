-- ============================================================
-- CodeType — one-time Supabase setup
-- Run this ONCE in:  Supabase Dashboard → SQL Editor → New query
-- Then add your project URL + anon key to:
--   frontend/.env  (VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY)
--   backend/.env   (SUPABASE_URL, SUPABASE_ANON_KEY)
-- ============================================================

create table if not exists public.sessions (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users (id) on delete cascade,
  created_at     timestamptz not null default now(),
  mode           text not null default 'unknown',
  language       text not null default 'unknown',
  snippet_id     text not null default 'unknown',
  snippet_title  text not null default 'unknown',
  snippet_source text not null default '',
  wpm            numeric not null default 0,
  raw_wpm        numeric not null default 0,
  accuracy       numeric not null default 0,
  consistency    numeric not null default 0,
  time_sec       numeric not null default 0,
  errors         integer not null default 0,
  backspaces     integer not null default 0,
  chars          integer not null default 0,
  symbol_stats   jsonb not null default '{}'::jsonb,
  line_stats     jsonb not null default '{}'::jsonb,
  char_stats     jsonb not null default '{}'::jsonb,
  char_times     jsonb not null default '[]'::jsonb,
  daily          boolean not null default false
);

create index if not exists sessions_user_created_idx
  on public.sessions (user_id, created_at desc);

-- Row Level Security: a user can only ever see/touch their own rows
alter table public.sessions enable row level security;

drop policy if exists "users select own sessions" on public.sessions;
create policy "users select own sessions"
  on public.sessions for select
  using (auth.uid() = user_id);

drop policy if exists "users insert own sessions" on public.sessions;
create policy "users insert own sessions"
  on public.sessions for insert
  with check (auth.uid() = user_id);

drop policy if exists "users update own sessions" on public.sessions;
create policy "users update own sessions"
  on public.sessions for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- (Accounts themselves live in Supabase Auth — email + password is enabled
--  by default. If you want to skip the confirmation email:
--  Authentication → Providers → Email → turn OFF "Confirm email".)
