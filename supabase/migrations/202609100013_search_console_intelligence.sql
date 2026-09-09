do $$ begin
  create type public.gsc_sync_status as enum ('running', 'completed', 'partial', 'failed');
exception when duplicate_object then null;
end $$;

create table if not exists public.gsc_sync_runs (
  id uuid primary key default gen_random_uuid(),
  connection_id uuid not null references public.gsc_connections(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  trigger_type text not null check (trigger_type in ('manual', 'scheduled')),
  status public.gsc_sync_status not null default 'running',
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  properties_found integer not null default 0,
  properties_synced integer not null default 0,
  rows_written integer not null default 0,
  search_types text[] not null default '{}',
  error_code text,
  error_message text,
  error_details jsonb not null default '{}'::jsonb
);

create table if not exists public.gsc_sitemaps (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.gsc_properties(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  path text not null,
  sitemap_type text,
  is_pending boolean not null default false,
  is_sitemaps_index boolean not null default false,
  last_submitted_at timestamptz,
  last_downloaded_at timestamptz,
  warnings integer not null default 0,
  errors integer not null default 0,
  contents jsonb not null default '[]'::jsonb,
  synced_at timestamptz not null default now(),
  unique (property_id, path)
);

alter table public.title_suggestions
  add column if not exists suggestion_type text not null default 'ctr_opportunity',
  add column if not exists analysis jsonb not null default '{}'::jsonb;

create index gsc_sync_runs_owner_recent on public.gsc_sync_runs (user_id, started_at desc);
create index gsc_sitemaps_owner on public.gsc_sitemaps (user_id, property_id);

alter table public.gsc_sync_runs enable row level security;
alter table public.gsc_sitemaps enable row level security;
do $$ begin
  create policy gsc_sync_runs_owner_read on public.gsc_sync_runs for select to authenticated using (user_id = (select auth.uid()));
exception when duplicate_object then null;
end $$;
do $$ begin
  create policy gsc_sitemaps_owner_read on public.gsc_sitemaps for select to authenticated using (user_id = (select auth.uid()));
exception when duplicate_object then null;
end $$;
revoke all on public.gsc_sync_runs, public.gsc_sitemaps from anon, authenticated;
grant select on public.gsc_sync_runs, public.gsc_sitemaps to authenticated;

do $$ begin
  perform cron.unschedule(jobid) from cron.job where jobname = 'smart-content-search-console-sync';
  perform cron.schedule('smart-content-search-console-sync', '30 3 * * *', 'select public.dispatch_search_console_sync()');
end $$;
