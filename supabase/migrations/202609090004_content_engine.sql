create type public.content_tone as enum ('professional', 'friendly', 'persuasive', 'educational', 'creative');
create type public.generation_job_status as enum ('queued', 'running', 'completed', 'failed', 'cancelled');
create type public.generation_step_kind as enum ('article', 'hero_image', 'inline_image');
create type public.generation_step_status as enum ('pending', 'running', 'completed', 'failed', 'cancelled');

create table public.content_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  topic text not null check (char_length(topic) between 5 and 300),
  keywords text[] not null default '{}',
  language text not null default 'fa' check (char_length(language) between 2 and 16),
  audience text not null check (char_length(audience) between 2 and 200),
  tone public.content_tone not null default 'professional',
  target_words integer not null check (target_words between 400 and 5000),
  text_api_key_id uuid not null references public.user_api_keys(id) on delete restrict,
  text_provider_slug text not null,
  text_model text not null check (char_length(text_model) between 2 and 200),
  image_api_key_id uuid references public.user_api_keys(id) on delete restrict,
  image_provider_slug text,
  image_model text,
  image_count smallint not null default 0 check (image_count between 0 and 4),
  settings_snapshot jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint image_configuration_complete check (
    (image_count = 0 and image_api_key_id is null and image_provider_slug is null and image_model is null)
    or
    (image_count > 0 and image_api_key_id is not null and image_provider_slug is not null and image_model is not null)
  )
);

create table public.generation_jobs (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.content_requests(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  status public.generation_job_status not null default 'queued',
  progress smallint not null default 0 check (progress between 0 and 100),
  current_step text,
  attempt integer not null default 0 check (attempt >= 0),
  max_attempts integer not null default 3 check (max_attempts between 1 and 10),
  cancel_requested boolean not null default false,
  locked_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  error_code text,
  error_message text,
  output_title text,
  output_markdown text,
  input_tokens integer not null default 0 check (input_tokens >= 0),
  output_tokens integer not null default 0 check (output_tokens >= 0),
  estimated_cost_usd numeric(18, 8),
  idempotency_key uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, idempotency_key)
);

create index generation_jobs_owner_history on public.generation_jobs (user_id, created_at desc);
create index generation_jobs_queue on public.generation_jobs (status, created_at) where status = 'queued';

create table public.generation_steps (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.generation_jobs(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  kind public.generation_step_kind not null,
  position smallint not null default 0,
  status public.generation_step_status not null default 'pending',
  attempt integer not null default 0,
  provider_slug text not null,
  model_key text not null,
  error_code text,
  error_message text,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (job_id, kind, position)
);

create table public.content_assets (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.generation_jobs(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  step_id uuid references public.generation_steps(id) on delete set null,
  storage_path text not null unique,
  mime_type text not null,
  alt_text text not null,
  position smallint not null default 0,
  created_at timestamptz not null default now()
);

create table public.usage_ledger (
  id bigint generated always as identity primary key,
  job_id uuid not null references public.generation_jobs(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  provider_slug text not null,
  model_key text not null,
  unit public.pricing_unit not null,
  quantity numeric(18, 6) not null check (quantity >= 0),
  estimated_cost_usd numeric(18, 8),
  provider_request_id text,
  created_at timestamptz not null default now()
);

create trigger generation_jobs_set_updated_at before update on public.generation_jobs
for each row execute function public.set_updated_at();
create trigger generation_steps_set_updated_at before update on public.generation_steps
for each row execute function public.set_updated_at();

alter table public.content_requests enable row level security;
alter table public.generation_jobs enable row level security;
alter table public.generation_steps enable row level security;
alter table public.content_assets enable row level security;
alter table public.usage_ledger enable row level security;

create policy content_requests_owner_read on public.content_requests for select to authenticated
using (user_id = (select auth.uid()));
create policy generation_jobs_owner_read on public.generation_jobs for select to authenticated
using (user_id = (select auth.uid()));
create policy generation_steps_owner_read on public.generation_steps for select to authenticated
using (user_id = (select auth.uid()));
create policy content_assets_owner_read on public.content_assets for select to authenticated
using (user_id = (select auth.uid()));
create policy usage_ledger_owner_read on public.usage_ledger for select to authenticated
using (user_id = (select auth.uid()));

revoke all on public.content_requests, public.generation_jobs, public.generation_steps, public.content_assets, public.usage_ledger from anon, authenticated;
grant select on public.content_requests, public.generation_jobs, public.generation_steps, public.content_assets, public.usage_ledger to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('content-assets', 'content-assets', false, 10485760, array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy content_assets_storage_owner_read
on storage.objects for select to authenticated
using (bucket_id = 'content-assets' and (storage.foldername(name))[1] = (select auth.uid())::text);
