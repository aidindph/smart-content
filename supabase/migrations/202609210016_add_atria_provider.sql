insert into public.providers (slug, name, kind, enabled, supports_byok)
values ('atria', 'Atria', 'text', true, true)
on conflict (slug) do update
set name = excluded.name,
    kind = excluded.kind,
    supports_byok = excluded.supports_byok,
    enabled = true;

insert into public.provider_models (provider_id, model_key, display_name, kind, enabled)
select id, 'Atria-Dawn-Preview', 'Atria Dawn Preview', 'text', true
from public.providers
where slug = 'atria'
on conflict (provider_id, model_key) do update
set display_name = excluded.display_name,
    kind = excluded.kind,
    enabled = true;
