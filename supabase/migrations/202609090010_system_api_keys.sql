create table public.system_api_keys (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid not null references public.providers(id) on delete restrict,
  label text not null check (char_length(label) between 2 and 80),
  encrypted_key text not null,
  encryption_iv text not null,
  encryption_tag text not null,
  key_version text not null,
  key_hint text not null,
  is_active boolean not null default true,
  test_status public.api_key_test_status not null default 'untested',
  last_tested_at timestamptz,
  last_error_code text,
  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create unique index system_api_keys_provider_active
on public.system_api_keys (provider_id)
where deleted_at is null;

create trigger system_api_keys_set_updated_at
before update on public.system_api_keys
for each row execute function public.set_updated_at();

alter table public.system_api_keys enable row level security;
revoke all on public.system_api_keys from anon, authenticated;

alter table public.content_requests
  alter column text_api_key_id drop not null,
  add column text_system_api_key_id uuid references public.system_api_keys(id) on delete restrict,
  add column image_system_api_key_id uuid references public.system_api_keys(id) on delete restrict;

alter table public.content_requests
  add constraint text_credential_complete check (
    num_nonnulls(text_api_key_id, text_system_api_key_id) = 1
  );

alter table public.content_requests drop constraint image_configuration_complete;
alter table public.content_requests
  add constraint image_configuration_complete check (
    (
      image_count = 0
      and image_api_key_id is null
      and image_system_api_key_id is null
      and image_provider_slug is null
      and image_model is null
    )
    or
    (
      image_count > 0
      and num_nonnulls(image_api_key_id, image_system_api_key_id) = 1
      and image_provider_slug is not null
      and image_model is not null
    )
  );

create or replace function public.audit_system_api_key_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  actor uuid;
  old_safe jsonb;
  new_safe jsonb;
begin
  actor := coalesce(
    case when tg_op <> 'DELETE' then new.updated_by end,
    case when tg_op <> 'DELETE' then new.created_by end,
    case when tg_op <> 'INSERT' then old.updated_by end,
    case when tg_op <> 'INSERT' then old.created_by end,
    auth.uid()
  );
  old_safe := case when tg_op = 'INSERT' then null else jsonb_build_object(
    'provider_id', old.provider_id,
    'label', old.label,
    'key_hint', old.key_hint,
    'is_active', old.is_active,
    'test_status', old.test_status,
    'deleted_at', old.deleted_at
  ) end;
  new_safe := case when tg_op = 'DELETE' then null else jsonb_build_object(
    'provider_id', new.provider_id,
    'label', new.label,
    'key_hint', new.key_hint,
    'is_active', new.is_active,
    'test_status', new.test_status,
    'deleted_at', new.deleted_at
  ) end;
  insert into public.audit_logs (actor_id, action, target_type, target_id, previous_value, new_value)
  values (actor, lower(tg_op), 'system_api_key', coalesce(new.id, old.id)::text, old_safe, new_safe);
  return coalesce(new, old);
end;
$$;

create trigger system_api_keys_audit
after insert or update or delete on public.system_api_keys
for each row execute function public.audit_system_api_key_change();

revoke execute on function public.audit_system_api_key_change() from public, anon, authenticated;
