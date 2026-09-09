alter table public.content_requests
  add column if not exists keyword_targets jsonb not null default '[]'::jsonb,
  add column if not exists seo_settings jsonb not null default '{}'::jsonb,
  add column if not exists content_brief text,
  add column if not exists required_headings text[] not null default '{}',
  add column if not exists image_topics text[] not null default '{}';

alter table public.generation_jobs
  add column if not exists output_html text,
  add column if not exists seo_analysis jsonb not null default '{}'::jsonb,
  add column if not exists image_suggestions jsonb not null default '[]'::jsonb;

comment on column public.content_requests.keyword_targets is 'Up to three keywords with requested density percentages.';
comment on column public.generation_jobs.output_html is 'Sanitized semantic article fragment ready to paste into a CMS.';
