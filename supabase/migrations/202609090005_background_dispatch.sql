create extension if not exists pg_net with schema extensions;
create extension if not exists pg_cron;

create or replace function public.dispatch_generation_job()
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
  if not exists (
    select 1 from public.generation_jobs where status = 'queued' and cancel_requested = false
  ) or exists (
    select 1 from public.system_settings where id = 1 and maintenance_mode = true
  ) then
    return null;
  end if;

  select decrypted_secret into worker_url
    from vault.decrypted_secrets where name = 'smart_content_worker_url' limit 1;
  select decrypted_secret into worker_secret
    from vault.decrypted_secrets where name = 'smart_content_worker_secret' limit 1;

  if worker_url is null or worker_secret is null then
    return null;
  end if;

  select net.http_post(
    url := worker_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || worker_secret
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 180000
  ) into request_id;

  return request_id;
end;
$$;

revoke execute on function public.dispatch_generation_job() from public, anon, authenticated;

do $$
begin
  if not exists (select 1 from cron.job where jobname = 'smart-content-generation-worker') then
    perform cron.schedule(
      'smart-content-generation-worker',
      '* * * * *',
      'select public.dispatch_generation_job()'
    );
  end if;
end;
$$;
