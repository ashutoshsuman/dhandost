-- Run this in your Supabase SQL editor.
-- Creates public.user_categories with RLS, and backfills existing custom
-- category strings from transactions.

create table if not exists public.user_categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name text not null,
  kind text not null default 'expense',
  created_at timestamptz not null default now()
);

create unique index if not exists user_categories_user_lower_name_uk
  on public.user_categories (user_id, lower(name));

grant select, insert, update, delete on public.user_categories to authenticated;
grant all on public.user_categories to service_role;

alter table public.user_categories enable row level security;

drop policy if exists "user_categories select own" on public.user_categories;
create policy "user_categories select own"
  on public.user_categories for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists "user_categories insert own" on public.user_categories;
create policy "user_categories insert own"
  on public.user_categories for insert
  to authenticated
  with check (user_id = auth.uid());

drop policy if exists "user_categories update own" on public.user_categories;
create policy "user_categories update own"
  on public.user_categories for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "user_categories delete own" on public.user_categories;
create policy "user_categories delete own"
  on public.user_categories for delete
  to authenticated
  using (user_id = auth.uid());

-- Backfill from existing transactions.category values that aren't defaults.
insert into public.user_categories (user_id, name)
select distinct t.user_id, trim(t.category)
from public.transactions t
where t.category is not null
  and trim(t.category) <> ''
  and lower(trim(t.category)) not in (
    'salary','freelance','bonus','refund','food','transport','shopping',
    'entertainment','family transfer','utilities','rent','emi','sip',
    'transfer','other'
  )
on conflict (user_id, lower(name)) do nothing;
