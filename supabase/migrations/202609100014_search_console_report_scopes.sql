alter table public.gsc_metrics_daily
  add column if not exists data_scope text not null default 'detail';

do $$
begin
  alter table public.gsc_metrics_daily
    add constraint gsc_metrics_daily_data_scope_check
    check (data_scope in ('detail', 'total', 'query', 'page', 'query_page', 'country', 'device'));
exception when duplicate_object then null;
end $$;

do $$
declare
  item record;
begin
  for item in
    select conname
    from pg_constraint
    where conrelid = 'public.gsc_metrics_daily'::regclass
      and contype = 'u'
      and pg_get_constraintdef(oid) not ilike '%data_scope%'
  loop
    execute format('alter table public.gsc_metrics_daily drop constraint %I', item.conname);
  end loop;
end $$;

do $$
begin
  alter table public.gsc_metrics_daily
    add constraint gsc_metrics_daily_scope_unique
    unique (property_id, metric_date, query, page, country, device, search_type, data_scope);
exception when duplicate_object then null;
end $$;

create index if not exists gsc_metrics_scope_lookup
  on public.gsc_metrics_daily (user_id, data_scope, search_type, metric_date desc);

update public.provider_models
set enabled = false
where provider_id in (select id from public.providers where slug = 'google-gemini')
  and model_key ~* '(image|tts|transcribe|lyria|robotics|computer-use|deep-research|antigravity|nano-banana)';
