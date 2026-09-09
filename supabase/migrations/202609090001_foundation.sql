create extension if not exists citext with schema extensions;

create type public.app_role as enum ('customer', 'system_admin');
create type public.account_status as enum ('active', 'suspended');
create type public.provider_kind as enum ('text', 'image', 'multimodal');
create type public.pricing_unit as enum (
  'input_million_tokens',
  'output_million_tokens',
  'image',
  'request'
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  role public.app_role not null default 'customer',
  status public.account_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.system_settings (
  id smallint primary key default 1 check (id = 1),
  registration_enabled boolean not null default false,
  maintenance_mode boolean not null default false,
  default_daily_request_limit integer not null default 25 check (default_daily_request_limit >= 0),
  default_monthly_request_limit integer not null default 500 check (default_monthly_request_limit >= 0),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);

insert into public.system_settings (id) values (1);

create table public.user_invitations (
  id uuid primary key default gen_random_uuid(),
  email extensions.citext not null,
  role public.app_role not null default 'customer',
  token_hash text not null unique,
  invited_by uuid references auth.users(id) on delete set null,
  expires_at timestamptz not null,
  accepted_at timestamptz,
  accepted_by uuid references auth.users(id) on delete set null,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  constraint invitation_expiry_after_creation check (expires_at > created_at)
);

create unique index one_open_invitation_per_email
  on public.user_invitations (email)
  where accepted_at is null and revoked_at is null;

create table public.providers (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  name text not null,
  kind public.provider_kind not null,
  enabled boolean not null default false,
  supports_byok boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.provider_models (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid not null references public.providers(id) on delete cascade,
  model_key text not null,
  display_name text not null,
  kind public.provider_kind not null,
  enabled boolean not null default false,
  capabilities jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider_id, model_key)
);

create table public.provider_pricing (
  id uuid primary key default gen_random_uuid(),
  provider_model_id uuid not null references public.provider_models(id) on delete cascade,
  unit public.pricing_unit not null,
  price_usd numeric(18, 8) not null check (price_usd >= 0),
  effective_from timestamptz not null,
  effective_until timestamptz,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  constraint pricing_window_is_valid check (
    effective_until is null or effective_until > effective_from
  )
);

create table public.quota_policies (
  user_id uuid primary key references auth.users(id) on delete cascade,
  daily_request_limit integer not null check (daily_request_limit >= 0),
  monthly_request_limit integer not null check (monthly_request_limit >= 0),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);

create table public.audit_logs (
  id bigint generated always as identity primary key,
  actor_id uuid references auth.users(id) on delete set null,
  action text not null,
  target_type text not null,
  target_id text,
  previous_value jsonb,
  new_value jsonb,
  request_id uuid,
  created_at timestamptz not null default now()
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

create trigger providers_set_updated_at
before update on public.providers
for each row execute function public.set_updated_at();

create trigger provider_models_set_updated_at
before update on public.provider_models
for each row execute function public.set_updated_at();

create trigger system_settings_set_updated_at
before update on public.system_settings
for each row execute function public.set_updated_at();

create trigger quota_policies_set_updated_at
before update on public.quota_policies
for each row execute function public.set_updated_at();

create or replace function public.audit_admin_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.audit_logs (
    actor_id,
    action,
    target_type,
    target_id,
    previous_value,
    new_value
  ) values (
    (select auth.uid()),
    lower(tg_op),
    tg_table_name,
    coalesce(new.id::text, old.id::text),
    case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end,
    case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) end
  );

  if tg_op = 'DELETE' then
    return old;
  end if;

  return new;
end;
$$;

create trigger system_settings_audit
after update on public.system_settings
for each row execute function public.audit_admin_change();

create trigger providers_audit
after insert or update or delete on public.providers
for each row execute function public.audit_admin_change();

create trigger provider_models_audit
after insert or update or delete on public.provider_models
for each row execute function public.audit_admin_change();

create trigger provider_pricing_audit
after insert or update or delete on public.provider_pricing
for each row execute function public.audit_admin_change();

revoke execute on function public.audit_admin_change() from public, anon, authenticated;

create or replace function public.is_system_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles
    where id = (select auth.uid())
      and role = 'system_admin'
      and status = 'active'
  );
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  invitation_role public.app_role;
begin
  select role
    into invitation_role
    from public.user_invitations
   where email = new.email
     and accepted_at is null
     and revoked_at is null
     and expires_at > now()
   order by created_at desc
   limit 1;

  insert into public.profiles (id, display_name, role)
  values (
    new.id,
    nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''),
    coalesce(invitation_role, 'customer')
  );

  update public.user_invitations
     set accepted_at = now(), accepted_by = new.id
   where email = new.email
     and accepted_at is null
     and revoked_at is null
     and expires_at > now();

  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

create or replace function public.before_user_created(event jsonb)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  signup_is_open boolean;
  requested_email extensions.citext;
  has_invitation boolean;
begin
  select registration_enabled
    into signup_is_open
    from public.system_settings
   where id = 1;

  if coalesce(signup_is_open, false) then
    return '{}'::jsonb;
  end if;

  requested_email := nullif(event -> 'user' ->> 'email', '')::extensions.citext;

  select exists (
    select 1
      from public.user_invitations
     where email = requested_email
       and accepted_at is null
       and revoked_at is null
       and expires_at > now()
  ) into has_invitation;

  if has_invitation then
    return '{}'::jsonb;
  end if;

  return jsonb_build_object(
    'error', jsonb_build_object(
      'http_code', 403,
      'message', 'ثبت‌نام عمومی در حال حاضر بسته است.'
    )
  );
end;
$$;

grant usage on schema public to supabase_auth_admin;
grant execute on function public.before_user_created(jsonb) to supabase_auth_admin;
grant select on public.system_settings, public.user_invitations to supabase_auth_admin;
revoke execute on function public.before_user_created(jsonb) from public, anon, authenticated;

alter table public.profiles enable row level security;
alter table public.system_settings enable row level security;
alter table public.user_invitations enable row level security;
alter table public.providers enable row level security;
alter table public.provider_models enable row level security;
alter table public.provider_pricing enable row level security;
alter table public.quota_policies enable row level security;
alter table public.audit_logs enable row level security;

create policy profiles_read_own
on public.profiles for select
to authenticated
using (id = (select auth.uid()));

create policy profiles_admin_all
on public.profiles for all
to authenticated
using ((select public.is_system_admin()))
with check ((select public.is_system_admin()));

create policy settings_read_authenticated
on public.system_settings for select
to authenticated
using (true);

create policy settings_read_registration_state
on public.system_settings for select
to anon
using (id = 1);

create policy settings_admin_update
on public.system_settings for update
to authenticated
using ((select public.is_system_admin()))
with check ((select public.is_system_admin()));

create policy invitations_admin_all
on public.user_invitations for all
to authenticated
using ((select public.is_system_admin()))
with check ((select public.is_system_admin()));

create policy invitations_auth_hook_read
on public.user_invitations for select
to supabase_auth_admin
using (true);

create policy settings_auth_hook_read
on public.system_settings for select
to supabase_auth_admin
using (id = 1);

create policy providers_read_authenticated
on public.providers for select
to authenticated
using (true);

create policy providers_admin_all
on public.providers for all
to authenticated
using ((select public.is_system_admin()))
with check ((select public.is_system_admin()));

create policy models_read_authenticated
on public.provider_models for select
to authenticated
using (true);

create policy models_admin_all
on public.provider_models for all
to authenticated
using ((select public.is_system_admin()))
with check ((select public.is_system_admin()));

create policy pricing_read_authenticated
on public.provider_pricing for select
to authenticated
using (true);

create policy pricing_admin_all
on public.provider_pricing for all
to authenticated
using ((select public.is_system_admin()))
with check ((select public.is_system_admin()));

create policy quotas_read_own
on public.quota_policies for select
to authenticated
using (user_id = (select auth.uid()));

create policy quotas_admin_all
on public.quota_policies for all
to authenticated
using ((select public.is_system_admin()))
with check ((select public.is_system_admin()));

create policy audit_logs_admin_read
on public.audit_logs for select
to authenticated
using ((select public.is_system_admin()));

revoke all on public.profiles from anon, authenticated;
grant select on public.profiles to authenticated;
grant insert, update, delete on public.profiles to authenticated;

revoke all on public.system_settings from anon, authenticated;
grant select (registration_enabled) on public.system_settings to anon;
grant select, update on public.system_settings to authenticated;

revoke all on public.user_invitations from anon, authenticated;
grant select, insert, update on public.user_invitations to authenticated;

revoke all on public.providers, public.provider_models, public.provider_pricing from anon, authenticated;
grant select, insert, update, delete on public.providers to authenticated;
grant select, insert, update, delete on public.provider_models to authenticated;
grant select, insert, update, delete on public.provider_pricing to authenticated;

revoke all on public.quota_policies from anon, authenticated;
grant select, insert, update, delete on public.quota_policies to authenticated;

revoke all on public.audit_logs from anon, authenticated;
grant select on public.audit_logs to authenticated;

insert into public.providers (slug, name, kind, enabled)
values
  ('openai', 'OpenAI', 'multimodal', false),
  ('google-gemini', 'Google Gemini', 'multimodal', false),
  ('openrouter', 'OpenRouter', 'text', false);

comment on function public.before_user_created(jsonb) is
  'برای اجرای امن باید در تنظیمات Auth به‌عنوان Before User Created Hook فعال شود.';
