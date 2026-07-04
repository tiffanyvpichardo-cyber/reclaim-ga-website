-- ============================================================================
-- Reclaim CA — Supabase schema (Phase 1)
-- Paste this whole file into Supabase → SQL Editor → New query → Run.
-- ============================================================================

-- One table. Each lead is stored as JSON in `data`, so the dashboard's exact
-- shape (contact, property, stage, outreachLog, docs, activity...) round-trips
-- with no field mapping. `id` is the lead's existing id.
create table if not exists public.leads (
  id          text primary key,
  data        jsonb not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Keep updated_at current on every change.
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists leads_set_updated_at on public.leads;
create trigger leads_set_updated_at
  before update on public.leads
  for each row execute function public.set_updated_at();

-- Row Level Security: nobody can read or write unless they are logged in.
-- (Any logged-in user in your project has full access — the internal-team model.)
alter table public.leads enable row level security;

drop policy if exists "authenticated full access" on public.leads;
create policy "authenticated full access" on public.leads
  for all
  to authenticated
  using (true)
  with check (true);
