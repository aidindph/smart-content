create trigger profiles_admin_audit
after update on public.profiles
for each row execute function public.audit_admin_change();

create or replace function public.audit_quota_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.audit_logs (actor_id, action, target_type, target_id, previous_value, new_value)
  values (
    (select auth.uid()), lower(tg_op), 'quota_policies', coalesce(new.user_id, old.user_id)::text,
    case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end,
    case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) end
  );
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

create trigger quota_policies_audit
after insert or update or delete on public.quota_policies
for each row execute function public.audit_quota_change();
revoke execute on function public.audit_quota_change() from public, anon, authenticated;

create or replace function public.audit_invitation_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.audit_logs (actor_id, action, target_type, target_id, previous_value, new_value)
  values (
    (select auth.uid()), lower(tg_op), 'user_invitations', coalesce(new.id, old.id)::text,
    case when tg_op in ('UPDATE', 'DELETE') then jsonb_build_object('email', old.email, 'role', old.role, 'expires_at', old.expires_at, 'accepted_at', old.accepted_at, 'revoked_at', old.revoked_at) end,
    case when tg_op in ('INSERT', 'UPDATE') then jsonb_build_object('email', new.email, 'role', new.role, 'expires_at', new.expires_at, 'accepted_at', new.accepted_at, 'revoked_at', new.revoked_at) end
  );
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

create trigger user_invitations_audit
after insert or update or delete on public.user_invitations
for each row execute function public.audit_invitation_change();
revoke execute on function public.audit_invitation_change() from public, anon, authenticated;
