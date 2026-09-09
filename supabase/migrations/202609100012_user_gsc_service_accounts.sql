alter table public.gsc_connections
  add column auth_type text not null default 'oauth' check (auth_type in ('oauth', 'service_account')),
  add column encrypted_service_account text,
  add column service_account_iv text,
  add column service_account_tag text,
  add column service_account_key_version text;

alter table public.gsc_connections
  alter column encrypted_access_token drop not null,
  alter column access_iv drop not null,
  alter column access_tag drop not null,
  alter column access_key_version drop not null,
  alter column encrypted_refresh_token drop not null,
  alter column refresh_iv drop not null,
  alter column refresh_tag drop not null,
  alter column refresh_key_version drop not null,
  alter column token_expires_at drop not null;

alter table public.gsc_connections add constraint gsc_credentials_complete check (
  (auth_type = 'oauth' and encrypted_access_token is not null and encrypted_refresh_token is not null and token_expires_at is not null)
  or
  (auth_type = 'service_account' and encrypted_service_account is not null and service_account_iv is not null and service_account_tag is not null and service_account_key_version is not null)
);

grant select (auth_type) on public.gsc_connections to authenticated;
