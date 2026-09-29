-- Run this in your Supabase SQL editor.
create table public.analytics_events (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  event_name text not null check (event_name ~ '^[a-z_]{3,50}$'),
  properties jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index analytics_events_user_time_idx on public.analytics_events (user_id, created_at);
create index analytics_events_name_time_idx on public.analytics_events (event_name, created_at);
grant insert on public.analytics_events to authenticated;
grant all on public.analytics_events to service_role;
alter table public.analytics_events enable row level security;
create policy "users insert own events"
  on public.analytics_events for insert
  to authenticated
  with check (user_id = auth.uid());
-- No select/update/delete policies: users cannot read analytics.

-- In the super-processor (reset-user-data) edge function, add alongside the other deletes:
--   await admin.from("analytics_events").delete().eq("user_id", userId);
