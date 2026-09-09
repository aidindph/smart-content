create or replace function public.dispatch_search_console_sync()
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  worker_url text;
  worker_secret text;
  request_id bigint;
begin
  if not exists (select 1 from public.gsc_connections where status = 'active') then return null; end if;
  select decrypted_secret into worker_url from vault.decrypted_secrets where name = 'smart_content_gsc_sync_url' limit 1;
  select decrypted_secret into worker_secret from vault.decrypted_secrets where name = 'smart_content_worker_secret' limit 1;
  if worker_url is null or worker_secret is null then return null; end if;
  select net.http_post(
    url := worker_url,
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || worker_secret),
    body := '{}'::jsonb,
    timeout_milliseconds := 180000
  ) into request_id;
  return request_id;
end;
$$;

revoke execute on function public.dispatch_search_console_sync() from public, anon, authenticated;

do $$
begin
  if not exists (select 1 from cron.job where jobname = 'smart-content-search-console-sync') then
    perform cron.schedule('smart-content-search-console-sync', '15 2 * * *', 'select public.dispatch_search_console_sync()');
  end if;
end;
$$;
