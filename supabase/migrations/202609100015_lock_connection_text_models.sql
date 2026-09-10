-- مدل نگارش به خود اتصال وابسته است، نه به انتخاب آزاد در فرم تولید محتوا.
alter table public.user_api_keys
  add column if not exists default_text_model text;

alter table public.system_api_keys
  add column if not exists default_text_model text;

-- گوگل این مدل را برای کاربران تازه بازنشسته کرده است.
update public.provider_models as model
set enabled = false
from public.providers as provider
where model.provider_id = provider.id
  and provider.slug = 'google-gemini'
  and model.model_key = 'gemini-2.5-flash';

-- اتصال‌های قبلی جیمینی را هم به مدل فعلی منتقل می‌کنیم.
update public.user_api_keys as api_key
set default_text_model = 'gemini-3.6-flash'
from public.providers as provider
where api_key.provider_id = provider.id
  and provider.slug = 'google-gemini'
  and (api_key.default_text_model is null or api_key.default_text_model = 'gemini-2.5-flash');

update public.system_api_keys as api_key
set default_text_model = 'gemini-3.6-flash'
from public.providers as provider
where api_key.provider_id = provider.id
  and provider.slug = 'google-gemini'
  and (api_key.default_text_model is null or api_key.default_text_model = 'gemini-2.5-flash');
