import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/auth/guards";
import { ApiKeyForm } from "./api-key-form";
import { deleteApiKeyAction, testApiKeyAction, toggleApiKeyAction } from "./actions";

export const metadata: Metadata = { title: "کلیدهای هوش مصنوعی" };

type Provider = { id: string; name: string; slug: string; enabled: boolean; supports_byok: boolean };
type UserApiKey = {
  id: string;
  provider_id: string;
  label: string;
  key_hint: string;
  is_active: boolean;
  test_status: "valid" | "invalid" | "untested";
  last_tested_at: string | null;
  created_at: string;
};

const notices: Record<string, string> = {
  tested: "اتصال کلید با موفقیت آزمایش شد.",
  updated: "وضعیت کلید تغییر کرد.",
  deleted: "کلید حذف شد.",
};
const errors: Record<string, string> = {
  provider: "ارائه‌دهندهٔ این کلید پیدا نشد.",
  test: "آزمایش اتصال ناموفق بود؛ مقدار کلید را جایگزین کنید.",
  update: "تغییر وضعیت کلید انجام نشد.",
  delete: "حذف کلید انجام نشد.",
};

export default async function ApiKeysPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { supabase } = await requireUser();
  const params = await searchParams;
  const [{ data: providers }, { data: keys }] = await Promise.all([
    supabase.from("providers").select("id, name, slug, enabled, supports_byok").order("name").returns<Provider[]>(),
    supabase.from("user_api_keys")
      .select("id, provider_id, label, key_hint, is_active, test_status, last_tested_at, created_at")
      .is("deleted_at", null).order("created_at", { ascending: false }).returns<UserApiKey[]>(),
  ]);

  const enabledProviders = (providers ?? []).filter((provider) => provider.enabled && provider.supports_byok);
  const editId = typeof params.edit === "string" ? params.edit : undefined;
  const editableKey = (keys ?? []).find((key) => key.id === editId && enabledProviders.some((provider) => provider.id === key.provider_id));
  const providerById = new Map((providers ?? []).map((provider) => [provider.id, provider]));
  const notice = typeof params.notice === "string" ? notices[params.notice] : undefined;
  const error = typeof params.error === "string" ? errors[params.error] : undefined;

  return (
    <div className="mx-auto max-w-6xl">
      <header>
        <p className="text-sm font-bold text-brand">اتصال سرویس‌ها</p>
        <h1 className="mt-2 text-3xl font-black">کلیدهای هوش مصنوعی</h1>
        <p className="mt-3 max-w-3xl leading-7 text-muted">کلیدهای شخصی شما با رمزنگاری اصالت‌سنجی‌شده نگهداری می‌شوند و فقط هنگام اجرای درخواست در سرور رمزگشایی می‌شوند.</p>
      </header>

      {notice || error ? <p className={`mt-6 rounded-xl px-4 py-3 text-sm ${error ? "bg-red-50 text-danger dark:bg-red-950/30" : "bg-brand-soft text-brand-strong"}`}>{error ?? notice}</p> : null}

      <section className="mt-8">
        {enabledProviders.length ? (
          <ApiKeyForm editableKey={editableKey ? { id: editableKey.id, provider_id: editableKey.provider_id, label: editableKey.label } : undefined} providers={enabledProviders.map(({ id, name }) => ({ id, name }))} />
        ) : (
          <div className="panel p-6"><h2 className="font-black">ارائه‌دهندهٔ فعالی وجود ندارد</h2><p className="mt-2 text-sm text-muted">مدیر سامانه باید دست‌کم یک ارائه‌دهنده را فعال کند.</p></div>
        )}
      </section>

      <section className="mt-6 panel overflow-hidden">
        <div className="border-b border-line p-6">
          <h2 className="text-xl font-black">کلیدهای ذخیره‌شده</h2>
          <p className="mt-2 text-sm text-muted">برای امنیت، فقط چهار نویسهٔ پایانی هر کلید نمایش داده می‌شود.</p>
        </div>
        {(keys ?? []).length ? (
          <div className="divide-y divide-line">
            {(keys ?? []).map((key) => {
              const provider = providerById.get(key.provider_id);
              const testLabel = key.test_status === "valid" ? "اتصال سالم" : key.test_status === "invalid" ? "اتصال ناموفق" : "آزمایش‌نشده";
              return (
                <article className="grid gap-4 p-5 lg:grid-cols-[1fr_auto] lg:items-center" key={key.id}>
                  <div>
                    <div className="flex flex-wrap items-center gap-3">
                      <h3 className="font-black">{key.label}</h3>
                      <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${key.is_active ? "bg-brand-soft text-brand-strong" : "bg-surface-subtle text-muted"}`}>{key.is_active ? "فعال" : "غیرفعال"}</span>
                      <span className={`text-xs font-bold ${key.test_status === "valid" ? "text-brand" : key.test_status === "invalid" ? "text-danger" : "text-muted"}`}>{testLabel}</span>
                    </div>
                    <p className="mt-2 text-sm text-muted"><span>{provider?.name ?? "ارائه‌دهندهٔ حذف‌شده"}</span><span className="mx-2">·</span><span dir="ltr">{key.key_hint}</span></p>
                    {key.last_tested_at ? <p className="mt-1 text-xs text-muted">آخرین آزمایش: {new Intl.DateTimeFormat("fa-IR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(key.last_tested_at))}</p> : null}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <form action={testApiKeyAction}><input name="keyId" type="hidden" value={key.id} /><button className="secondary-button text-sm" disabled={!key.is_active || !provider?.enabled} type="submit">آزمایش</button></form>
                    <Link className="secondary-button text-sm" href={`/dashboard/api-keys?edit=${key.id}`}>جایگزینی</Link>
                    <form action={toggleApiKeyAction}><input name="keyId" type="hidden" value={key.id} /><input name="active" type="hidden" value={String(!key.is_active)} /><button className="secondary-button text-sm" type="submit">{key.is_active ? "غیرفعال کردن" : "فعال کردن"}</button></form>
                    <form action={deleteApiKeyAction}><input name="keyId" type="hidden" value={key.id} /><button className="danger-button text-sm" type="submit">حذف</button></form>
                  </div>
                </article>
              );
            })}
          </div>
        ) : <p className="p-6 text-sm text-muted">هنوز کلیدی ذخیره نشده است.</p>}
      </section>
    </div>
  );
}
