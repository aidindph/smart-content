create type public.gsc_connection_status as enum ('active', 'expired', 'revoked');
create type public.title_suggestion_status as enum ('pending', 'accepted', 'rejected');

create table public.gsc_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  google_email extensions.citext,
  encrypted_access_token text not null,
  access_iv text not null,
  access_tag text not null,
  access_key_version text not null,
  encrypted_refresh_token text not null,
  refresh_iv text not null,
  refresh_tag text not null,
  refresh_key_version text not null,
  token_expires_at timestamptz not null,
  status public.gsc_connection_status not null default 'active',
  last_synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.gsc_properties (
  id uuid primary key default gen_random_uuid(),
  connection_id uuid not null references public.gsc_connections(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  site_url text not null,
  permission_level text not null,
  selected boolean not null default true,
  last_synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, site_url)
);

create table public.gsc_metrics_daily (
  id bigint generated always as identity primary key,
  property_id uuid not null references public.gsc_properties(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  metric_date date not null,
  query text not null default '',
  page text not null default '',
  country text not null default '',
  device text not null default '',
  search_type text not null default 'web',
  clicks numeric(18, 4) not null default 0,
  impressions numeric(18, 4) not null default 0,
  ctr numeric(12, 8) not null default 0,
  position numeric(12, 4) not null default 0,
  synced_at timestamptz not null default now(),
  unique (property_id, metric_date, query, page, country, device, search_type)
);

create table public.title_suggestions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  property_id uuid not null references public.gsc_properties(id) on delete cascade,
  source_query text not null,
  source_page text not null,
  suggested_title text not null,
  evidence jsonb not null,
  score numeric(12, 4) not null,
  status public.title_suggestion_status not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index gsc_metrics_opportunity_lookup on public.gsc_metrics_daily (user_id, impressions desc, position);
create index title_suggestions_owner_recent on public.title_suggestions (user_id, created_at desc);

create trigger gsc_connections_updated before update on public.gsc_connections for each row execute function public.set_updated_at();
create trigger gsc_properties_updated before update on public.gsc_properties for each row execute function public.set_updated_at();
create trigger title_suggestions_updated before update on public.title_suggestions for each row execute function public.set_updated_at();

alter table public.gsc_connections enable row level security;
alter table public.gsc_properties enable row level security;
alter table public.gsc_metrics_daily enable row level security;
alter table public.title_suggestions enable row level security;

create policy gsc_connections_owner_read on public.gsc_connections for select to authenticated using (user_id = (select auth.uid()));
create policy gsc_properties_owner_read on public.gsc_properties for select to authenticated using (user_id = (select auth.uid()));
create policy gsc_metrics_owner_read on public.gsc_metrics_daily for select to authenticated using (user_id = (select auth.uid()));
create policy title_suggestions_owner_read on public.title_suggestions for select to authenticated using (user_id = (select auth.uid()));

revoke all on public.gsc_connections, public.gsc_properties, public.gsc_metrics_daily, public.title_suggestions from anon, authenticated;
grant select (
  id, user_id, google_email, token_expires_at, status, last_synced_at, created_at, updated_at
) on public.gsc_connections to authenticated;
grant select on public.gsc_properties, public.gsc_metrics_daily, public.title_suggestions to authenticated;
