create table public.rate_limit_buckets (
  key_hash text not null,
  bucket_start timestamptz not null,
  hits integer not null default 1,
  primary key (key_hash, bucket_start)
);

alter table public.rate_limit_buckets enable row level security;
revoke all on public.rate_limit_buckets from public, anon, authenticated;

create or replace function public.consume_rate_limit(
  p_key_hash text,
  p_limit integer,
  p_window_seconds integer
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_bucket timestamptz;
  current_hits integer;
begin
  if p_limit < 1 or p_window_seconds < 1 or char_length(p_key_hash) <> 64 then return false; end if;
  current_bucket := to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds);
  insert into public.rate_limit_buckets (key_hash, bucket_start, hits)
  values (p_key_hash, current_bucket, 1)
  on conflict (key_hash, bucket_start) do update set hits = public.rate_limit_buckets.hits + 1
  returning hits into current_hits;
  return current_hits <= p_limit;
end;
$$;

grant execute on function public.consume_rate_limit(text, integer, integer) to anon, authenticated;

create or replace function public.cleanup_expired_application_data()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.rate_limit_buckets where bucket_start < now() - interval '2 days';
  delete from public.user_invitations where (revoked_at is not null or accepted_at is not null or expires_at < now()) and created_at < now() - interval '90 days';
  delete from public.user_api_keys where deleted_at < now() - interval '90 days';
end;
$$;

revoke execute on function public.cleanup_expired_application_data() from public, anon, authenticated;

do $$
begin
  if not exists (select 1 from cron.job where jobname = 'smart-content-retention-cleanup') then
    perform cron.schedule('smart-content-retention-cleanup', '40 3 * * *', 'select public.cleanup_expired_application_data()');
  end if;
end;
$$;
