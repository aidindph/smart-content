import type { Metadata } from "next";
import Link from "next/link";
import { requireSystemAdmin } from "@/lib/auth/guards";
import { setMaintenanceAction, setProviderAction, setRegistrationAction } from "./actions";

export const metadata: Metadata = { title: "مدیریت سامانه" };

type Settings = {
  registration_enabled: boolean;
  maintenance_mode: boolean;
  default_daily_request_limit: number;
  default_monthly_request_limit: number;
};

type Provider = {
  id: string;
  slug: string;
  name: string;
  kind: "text" | "image" | "multimodal";
  enabled: boolean;
};

export default async function SystemAdminPage() {
  const { supabase } = await requireSystemAdmin();
  const [{ data: settings }, { data: providers }, { count: userCount }] = await Promise.all([
    supabase.from("system_settings").select("registration_enabled, maintenance_mode, default_daily_request_limit, default_monthly_request_limit").eq("id", 1).single<Settings>(),
    supabase.from("providers").select("id, slug, name, kind, enabled").order("name").returns<Provider[]>(),
    supabase.from("profiles").select("id", { count: "exact", head: true }),
  ]);

  if (!settings) throw new Error("تنظیمات سامانه در دسترس نیست.");

  return (
    <main className="app-shell min-h-screen p-5 sm:p-8 lg:p-10">
      <div className="mx-auto max-w-6xl">
        <header className="flex flex-wrap items-center justify-between gap-5">
          <div>
            <p className="text-sm font-bold text-brand">دسترسی ویژهٔ مالک سامانه</p>
            <h1 className="mt-2 text-3xl font-black">مدیریت سامانه</h1>
            <p className="mt-3 text-muted">تنظیمات سراسری روی همهٔ فضاهای کاری اثر می‌گذارند.</p>
          </div>
          <Link className="secondary-button" href="/dashboard">بازگشت به داشبورد</Link>
        </header>

        <section className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <article className="panel p-5"><p className="text-sm text-muted">کاربران سامانه</p><p className="mt-3 text-3xl font-black">{userCount ?? 0}</p></article>
          <article className="panel p-5"><p className="text-sm text-muted">ثبت‌نام عمومی</p><p className={`mt-3 font-black ${settings.registration_enabled ? "text-brand" : "text-accent"}`}>{settings.registration_enabled ? "باز" : "بسته"}</p></article>
          <article className="panel p-5"><p className="text-sm text-muted">سقف روزانهٔ پیش‌فرض</p><p className="mt-3 text-3xl font-black">{settings.default_daily_request_limit}</p></article>
          <article className="panel p-5"><p className="text-sm text-muted">سقف ماهانهٔ پیش‌فرض</p><p className="mt-3 text-3xl font-black">{settings.default_monthly_request_limit}</p></article>
        </section>

        <section className="mt-6 grid gap-6 lg:grid-cols-2">
          <article className="panel p-6">
            <h2 className="text-xl font-black">دسترسی و ثبت‌نام</h2>
            <p className="mt-2 text-sm leading-6 text-muted">در حالت بسته، فقط ایمیل دارای دعوت معتبر می‌تواند حساب بسازد.</p>
            <form action={setRegistrationAction} className="mt-6 flex items-center justify-between gap-4 rounded-xl bg-surface-subtle p-4">
              <div><p className="font-bold">ثبت‌نام عمومی</p><p className="mt-1 text-xs text-muted">وضعیت فعلی: {settings.registration_enabled ? "باز" : "بسته"}</p></div>
              <input name="enabled" type="hidden" value={String(!settings.registration_enabled)} />
              <button className={settings.registration_enabled ? "danger-button" : "primary-button"} type="submit">{settings.registration_enabled ? "بستن" : "باز کردن"}</button>
            </form>
            <form action={setMaintenanceAction} className="mt-3 flex items-center justify-between gap-4 rounded-xl bg-surface-subtle p-4">
              <div><p className="font-bold">حالت تعمیر</p><p className="mt-1 text-xs text-muted">برای توقف موقت عملیات مشتریان</p></div>
              <input name="enabled" type="hidden" value={String(!settings.maintenance_mode)} />
              <button className={settings.maintenance_mode ? "primary-button" : "secondary-button"} type="submit">{settings.maintenance_mode ? "پایان تعمیر" : "فعال‌سازی"}</button>
            </form>
          </article>

          <article className="panel p-6">
            <h2 className="text-xl font-black">ارائه‌دهندگان هوش مصنوعی</h2>
            <p className="mt-2 text-sm text-muted">خاموش‌کردن ارائه‌دهنده، انتخاب آن را برای همه می‌بندد.</p>
            <div className="mt-6 divide-y divide-line">
              {(providers ?? []).map((provider) => (
                <form action={setProviderAction} className="flex items-center justify-between gap-4 py-4 first:pt-0 last:pb-0" key={provider.id}>
                  <div><p className="font-bold">{provider.name}</p><p className="mt-1 text-xs text-muted" dir="ltr">{provider.slug} · {provider.kind}</p></div>
                  <input name="providerId" type="hidden" value={provider.id} />
                  <input name="enabled" type="hidden" value={String(!provider.enabled)} />
                  <button className={provider.enabled ? "danger-button" : "secondary-button"} type="submit">{provider.enabled ? "غیرفعال کردن" : "فعال کردن"}</button>
                </form>
              ))}
            </div>
          </article>
        </section>
      </div>
    </main>
  );
}
