create extension if not exists pgcrypto with schema extensions;

create type public.api_key_test_status as enum ('valid', 'invalid', 'untested');

create table public.user_api_keys (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  provider_id uuid not null references public.providers(id) on delete restrict,
  label text not null check (char_length(label) between 2 and 80),
  encrypted_key text not null,
  encryption_iv text not null,
  encryption_tag text not null,
  key_version text not null check (key_version ~ '^[a-zA-Z0-9._-]{1,32}$'),
  key_hint text not null check (char_length(key_hint) between 4 and 24),
  is_active boolean not null default true,
  test_status public.api_key_test_status not null default 'untested',
  last_tested_at timestamptz,
  last_error_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create unique index user_api_keys_unique_live_label
  on public.user_api_keys (user_id, provider_id, lower(label))
  where deleted_at is null;

create index user_api_keys_owner_lookup
  on public.user_api_keys (user_id, provider_id)
  where deleted_at is null and is_active;

create trigger user_api_keys_set_updated_at
before update on public.user_api_keys
for each row execute function public.set_updated_at();

alter table public.user_api_keys enable row level security;

create policy user_api_keys_owner_select
on public.user_api_keys for select
to authenticated
using (user_id = (select auth.uid()));

create policy user_api_keys_owner_insert
on public.user_api_keys for insert
to authenticated
with check (user_id = (select auth.uid()));

create policy user_api_keys_owner_update
on public.user_api_keys for update
to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

create policy user_api_keys_owner_delete
on public.user_api_keys for delete
to authenticated
using (user_id = (select auth.uid()));

revoke all on public.user_api_keys from anon, authenticated;
grant select (
  id, user_id, provider_id, label, key_hint, is_active, test_status,
  last_tested_at, last_error_code, created_at, updated_at, deleted_at
) on public.user_api_keys to authenticated;

-- همهٔ نوشتن‌ها با کارخواه محرمانهٔ سرور انجام می‌شوند. این تصمیم جلوی
-- تزریق بستهٔ رمز دست‌کاری‌شده از مسیر مستقیم API عمومی را می‌گیرد.

create or replace function public.audit_api_key_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  safe_old jsonb;
  safe_new jsonb;
begin
  if tg_op in ('UPDATE', 'DELETE') then
    safe_old := jsonb_build_object(
      'provider_id', old.provider_id,
      'label', old.label,
      'key_hint', old.key_hint,
      'is_active', old.is_active,
      'test_status', old.test_status,
      'deleted_at', old.deleted_at
    );
  end if;

  if tg_op in ('INSERT', 'UPDATE') then
    safe_new := jsonb_build_object(
      'provider_id', new.provider_id,
      'label', new.label,
      'key_hint', new.key_hint,
      'is_active', new.is_active,
      'test_status', new.test_status,
      'deleted_at', new.deleted_at
    );
  end if;

  insert into public.audit_logs (
    actor_id, action, target_type, target_id, previous_value, new_value
  ) values (
    (select auth.uid()), lower(tg_op), 'user_api_keys',
    coalesce(new.id::text, old.id::text), safe_old, safe_new
  );

  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

create trigger user_api_keys_audit
after insert or update or delete on public.user_api_keys
for each row execute function public.audit_api_key_change();

revoke execute on function public.audit_api_key_change() from public, anon, authenticated;

create or replace function public.before_user_created(event jsonb)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  signup_is_open boolean;
  requested_email extensions.citext;
  requested_token text;
  requested_token_hash text;
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
  requested_token := nullif(event -> 'user' -> 'user_metadata' ->> 'invite_token', '');

  if requested_email is null or requested_token is null then
    return jsonb_build_object(
      'error', jsonb_build_object(
        'http_code', 403,
        'message', 'ثبت‌نام عمومی در حال حاضر بسته است.'
      )
    );
  end if;

  requested_token_hash := encode(extensions.digest(requested_token, 'sha256'), 'hex');

  select exists (
    select 1
      from public.user_invitations
     where email = requested_email
       and token_hash = requested_token_hash
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
      'message', 'دعوت‌نامه معتبر نیست یا منقضی شده است.'
    )
  );
end;
$$;

grant execute on function public.before_user_created(jsonb) to supabase_auth_admin;
revoke execute on function public.before_user_created(jsonb) from public, anon, authenticated;
