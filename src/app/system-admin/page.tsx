import type { Metadata } from "next";
import Link from "next/link";
import { requireSystemAdmin } from "@/lib/auth/guards";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  addProviderModelAction, revokeInvitationAction, setDefaultLimitsAction, setMaintenanceAction, setModelPriceAction, setProviderAction,
  setRegistrationAction, setUserQuotaAction, setUserRoleAction, setUserStatusAction,
  toggleProviderModelAction,
} from "./actions";
import { InvitationForm } from "./invitation-form";

export const metadata: Metadata = { title: "مدیریت سامانه" };
type Settings = { registration_enabled: boolean; maintenance_mode: boolean; default_daily_request_limit: number; default_monthly_request_limit: number };
type Provider = { id: string; slug: string; name: string; kind: "text" | "image" | "multimodal"; enabled: boolean };
type Profile = { id: string; display_name: string | null; role: "customer" | "system_admin"; status: "active" | "suspended"; created_at: string };
type Quota = { user_id: string; daily_request_limit: number; monthly_request_limit: number };
type Invitation = { id: string; email: string; role: "customer" | "system_admin"; expires_at: string; accepted_at: string | null; revoked_at: string | null; created_at: string };
type ProviderModel = { id: string; provider_id: string; model_key: string; display_name: string; kind: "text" | "image" | "multimodal"; enabled: boolean };
type ModelPrice = { provider_model_id: string; unit: "input_million_tokens" | "output_million_tokens" | "image" | "request"; price_usd: number };

export default async function SystemAdminPage() {
  const { supabase, profile: currentProfile } = await requireSystemAdmin();
  const admin = createAdminClient();
  const [settingsResult, providersResult, profilesResult, quotaResult, invitationsResult, jobsResult, authUsersResult, modelsResult, pricingResult] = await Promise.all([
    supabase.from("system_settings").select("registration_enabled, maintenance_mode, default_daily_request_limit, default_monthly_request_limit").eq("id", 1).single<Settings>(),
    supabase.from("providers").select("id, slug, name, kind, enabled").order("name").returns<Provider[]>(),
    supabase.from("profiles").select("id, display_name, role, status, created_at").order("created_at", { ascending: false }).limit(100).returns<Profile[]>(),
    supabase.from("quota_policies").select("user_id, daily_request_limit, monthly_request_limit").returns<Quota[]>(),
    supabase.from("user_invitations").select("id, email, role, expires_at, accepted_at, revoked_at, created_at").order("created_at", { ascending: false }).limit(50).returns<Invitation[]>(),
    admin.from("generation_jobs").select("id, status, estimated_cost_usd"),
    admin.auth.admin.listUsers({ page: 1, perPage: 1000 }),
    supabase.from("provider_models").select("id, provider_id, model_key, display_name, kind, enabled").order("display_name").returns<ProviderModel[]>(),
    supabase.from("provider_pricing").select("provider_model_id, unit, price_usd").is("effective_until", null).order("effective_from", { ascending: false }).returns<ModelPrice[]>(),
  ]);
  const settings = settingsResult.data;
  if (!settings) throw new Error("تنظیمات سامانه در دسترس نیست.");
  const providers = providersResult.data ?? [];
  const profiles = profilesResult.data ?? [];
  const quotaByUser = new Map((quotaResult.data ?? []).map((quota) => [quota.user_id, quota]));
  const emailByUser = new Map((authUsersResult.data?.users ?? []).map((user) => [user.id, user.email ?? ""]));
  const jobs = jobsResult.data ?? [];
  const models = modelsResult.data ?? [];
  const pricesByModel = new Map<string, ModelPrice[]>();
  for (const price of pricingResult.data ?? []) pricesByModel.set(price.provider_model_id, [...(pricesByModel.get(price.provider_model_id) ?? []), price]);
  const completedCount = jobs.filter((job) => job.status === "completed").length;
  const failedCount = jobs.filter((job) => job.status === "failed").length;

  return (
    <main className="app-shell min-h-screen p-5 sm:p-8 lg:p-10">
      <div className="mx-auto max-w-7xl">
        <header className="flex flex-wrap items-center justify-between gap-5"><div><p className="text-sm font-bold text-brand">دسترسی ویژهٔ مالک سامانه</p><h1 className="mt-2 text-3xl font-black">مدیریت سامانه</h1><p className="mt-3 text-muted">کنترل کاربران، ثبت‌نام، ارائه‌دهندگان، سهمیه و عملیات جاری.</p></div><Link className="secondary-button" href="/dashboard">بازگشت به داشبورد</Link></header>

        <section className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <article className="panel p-5"><p className="text-sm text-muted">کاربران</p><p className="mt-3 text-3xl font-black">{new Intl.NumberFormat("fa-IR").format(profiles.length)}</p></article>
          <article className="panel p-5"><p className="text-sm text-muted">کل اجراها</p><p className="mt-3 text-3xl font-black">{new Intl.NumberFormat("fa-IR").format(jobs.length)}</p></article>
          <article className="panel p-5"><p className="text-sm text-muted">تکمیل‌شده</p><p className="mt-3 text-3xl font-black text-brand">{new Intl.NumberFormat("fa-IR").format(completedCount)}</p></article>
          <article className="panel p-5"><p className="text-sm text-muted">ناموفق</p><p className="mt-3 text-3xl font-black text-danger">{new Intl.NumberFormat("fa-IR").format(failedCount)}</p></article>
        </section>

        <section className="mt-6 grid gap-6 xl:grid-cols-3">
          <article className="panel p-6"><h2 className="text-xl font-black">دسترسی و عملیات</h2><p className="mt-2 text-sm leading-6 text-muted">تغییرها همان لحظه در بررسی سمت سرور اعمال می‌شوند.</p>
            <form action={setRegistrationAction} className="mt-5 flex items-center justify-between gap-4 rounded-xl bg-surface-subtle p-4"><div><p className="font-bold">ثبت‌نام عمومی</p><p className="mt-1 text-xs text-muted">{settings.registration_enabled ? "باز" : "بسته"}</p></div><input name="enabled" type="hidden" value={String(!settings.registration_enabled)} /><button className={settings.registration_enabled ? "danger-button" : "primary-button"} type="submit">{settings.registration_enabled ? "بستن" : "باز کردن"}</button></form>
            <form action={setMaintenanceAction} className="mt-3 flex items-center justify-between gap-4 rounded-xl bg-surface-subtle p-4"><div><p className="font-bold">حالت تعمیر</p><p className="mt-1 text-xs text-muted">{settings.maintenance_mode ? "فعال" : "غیرفعال"}</p></div><input name="enabled" type="hidden" value={String(!settings.maintenance_mode)} /><button className={settings.maintenance_mode ? "primary-button" : "secondary-button"} type="submit">{settings.maintenance_mode ? "پایان تعمیر" : "فعال‌سازی"}</button></form>
          </article>

          <article className="panel p-6"><h2 className="text-xl font-black">سقف‌های پیش‌فرض</h2><p className="mt-2 text-sm text-muted">برای کاربری که سهمیهٔ اختصاصی ندارد.</p><form action={setDefaultLimitsAction} className="mt-5 grid gap-4"><label className="grid gap-2 text-sm font-bold">روزانه<input className="field" defaultValue={settings.default_daily_request_limit} min={0} name="daily" type="number" /></label><label className="grid gap-2 text-sm font-bold">ماهانه<input className="field" defaultValue={settings.default_monthly_request_limit} min={0} name="monthly" type="number" /></label><button className="primary-button" type="submit">ذخیرهٔ سقف‌ها</button></form></article>
          <article className="panel p-6"><h2 className="text-xl font-black">دعوت کاربر</h2><p className="mt-2 text-sm text-muted">پیوند یک‌بارمصرف و زمان‌دار ساخته می‌شود.</p><InvitationForm /></article>
        </section>

        <section className="panel mt-6 overflow-hidden"><div className="border-b border-line p-6"><h2 className="text-xl font-black">ارائه‌دهندگان هوش مصنوعی</h2><p className="mt-2 text-sm text-muted">خاموش‌کردن ارائه‌دهنده، درخواست تازه و پردازش صف آن را متوقف می‌کند.</p></div><div className="grid gap-px bg-line sm:grid-cols-2 lg:grid-cols-3">{providers.map((provider) => <form action={setProviderAction} className="flex items-center justify-between gap-4 bg-surface p-5" key={provider.id}><div><p className="font-bold">{provider.name}</p><p className="mt-1 text-xs text-muted" dir="ltr">{provider.slug} · {provider.kind}</p></div><input name="providerId" type="hidden" value={provider.id} /><input name="enabled" type="hidden" value={String(!provider.enabled)} /><button className={provider.enabled ? "danger-button text-sm" : "secondary-button text-sm"} type="submit">{provider.enabled ? "غیرفعال" : "فعال"}</button></form>)}</div></section>

        <section className="panel mt-6 overflow-hidden"><div className="border-b border-line p-6"><h2 className="text-xl font-black">مدل‌ها و قیمت‌ها</h2><p className="mt-2 text-sm text-muted">قیمت هر نسخه با زمان آغاز نگهداری می‌شود و اجرای قبلی را تغییر نمی‌دهد.</p><form action={addProviderModelAction} className="mt-5 grid gap-3 lg:grid-cols-[1fr_1fr_1fr_10rem_auto]"><select className="field" name="providerId" required>{providers.map((provider) => <option key={provider.id} value={provider.id}>{provider.name}</option>)}</select><input className="field" dir="ltr" name="modelKey" placeholder="شناسهٔ مدل" required /><input className="field" name="displayName" placeholder="نام نمایشی" required /><select className="field" name="kind"><option value="text">متن</option><option value="image">تصویر</option><option value="multimodal">چندوجهی</option></select><button className="primary-button" type="submit">افزودن مدل</button></form></div>{models.length ? <div className="divide-y divide-line">{models.map((model) => { const provider = providers.find((item) => item.id === model.provider_id); const prices = pricesByModel.get(model.id) ?? []; return <article className="grid gap-4 p-5 xl:grid-cols-[1fr_auto] xl:items-center" key={model.id}><div><div className="flex flex-wrap items-center gap-3"><h3 className="font-black">{model.display_name}</h3><span className={`rounded-full px-2 py-1 text-xs font-bold ${model.enabled ? "bg-brand-soft text-brand" : "bg-surface-subtle text-muted"}`}>{model.enabled ? "فعال" : "غیرفعال"}</span></div><p className="mt-1 text-xs text-muted" dir="ltr">{provider?.slug} · {model.model_key}</p>{prices.length ? <p className="mt-2 text-xs text-muted">{prices.map((price) => `${price.unit}: $${Number(price.price_usd)}`).join(" · ")}</p> : null}</div><div className="flex flex-wrap gap-2"><form action={setModelPriceAction} className="flex flex-wrap gap-2"><input name="modelId" type="hidden" value={model.id} /><select className="field w-auto py-2 text-sm" name="unit"><option value="input_million_tokens">ورودی/میلیون توکن</option><option value="output_million_tokens">خروجی/میلیون توکن</option><option value="image">هر تصویر</option><option value="request">هر درخواست</option></select><input aria-label="قیمت دلار" className="field w-28 py-2 text-sm" min={0} name="price" placeholder="دلار" step="0.000001" type="number" /><button className="secondary-button text-sm" type="submit">ثبت قیمت</button></form><form action={toggleProviderModelAction}><input name="modelId" type="hidden" value={model.id} /><input name="enabled" type="hidden" value={String(!model.enabled)} /><button className={model.enabled ? "danger-button text-sm" : "primary-button text-sm"} type="submit">{model.enabled ? "غیرفعال" : "فعال"}</button></form></div></article>; })}</div> : <p className="p-6 text-sm text-muted">هنوز مدلی ثبت نشده است.</p>}</section>

        <section className="panel mt-6 overflow-hidden"><div className="border-b border-line p-6"><h2 className="text-xl font-black">کاربران و سهمیه‌ها</h2><p className="mt-2 text-sm text-muted">تا صد حساب تازه نمایش داده می‌شود.</p></div><div className="divide-y divide-line">{profiles.map((profile) => { const quota = quotaByUser.get(profile.id); return <article className="grid gap-5 p-5 xl:grid-cols-[1fr_auto_auto] xl:items-center" key={profile.id}><div><div className="flex flex-wrap items-center gap-2"><h3 className="font-black">{profile.display_name ?? "بدون نام"}</h3>{profile.id === currentProfile.id ? <span className="rounded-full bg-brand-soft px-2 py-1 text-xs font-bold text-brand">حساب شما</span> : null}</div><p className="mt-1 text-sm text-muted" dir="ltr">{emailByUser.get(profile.id)}</p></div><div className="flex flex-wrap gap-2"><form action={setUserRoleAction} className="flex gap-2"><input name="userId" type="hidden" value={profile.id} /><select className="field py-2 text-sm" defaultValue={profile.role} name="role"><option value="customer">مشتری</option><option value="system_admin">مدیر</option></select><button className="secondary-button text-sm" type="submit">نقش</button></form><form action={setUserStatusAction}><input name="userId" type="hidden" value={profile.id} /><input name="status" type="hidden" value={profile.status === "active" ? "suspended" : "active"} /><button className={profile.status === "active" ? "danger-button text-sm" : "primary-button text-sm"} type="submit">{profile.status === "active" ? "تعلیق" : "فعال‌سازی"}</button></form></div><form action={setUserQuotaAction} className="grid grid-cols-[6rem_6rem_auto] gap-2"><input name="userId" type="hidden" value={profile.id} /><input aria-label="سقف روزانه" className="field py-2 text-sm" defaultValue={quota?.daily_request_limit ?? settings.default_daily_request_limit} min={0} name="daily" type="number" /><input aria-label="سقف ماهانه" className="field py-2 text-sm" defaultValue={quota?.monthly_request_limit ?? settings.default_monthly_request_limit} min={0} name="monthly" type="number" /><button className="secondary-button text-sm" type="submit">سهمیه</button></form></article>; })}</div></section>

        <section className="panel mt-6 overflow-hidden"><div className="border-b border-line p-6"><h2 className="text-xl font-black">دعوت‌نامه‌های اخیر</h2></div>{(invitationsResult.data ?? []).length ? <div className="divide-y divide-line">{(invitationsResult.data ?? []).map((invitation) => { const state = invitation.accepted_at ? "پذیرفته‌شده" : invitation.revoked_at ? "لغوشده" : new Date(invitation.expires_at) <= new Date() ? "منقضی" : "فعال"; return <div className="flex flex-wrap items-center justify-between gap-4 p-5" key={invitation.id}><div><p className="font-bold" dir="ltr">{invitation.email}</p><p className="mt-1 text-xs text-muted">{state} · اعتبار تا {new Intl.DateTimeFormat("fa-IR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(invitation.expires_at))}</p></div>{state === "فعال" ? <form action={revokeInvitationAction}><input name="invitationId" type="hidden" value={invitation.id} /><button className="danger-button text-sm" type="submit">لغو دعوت</button></form> : null}</div>; })}</div> : <p className="p-6 text-sm text-muted">دعوت‌نامه‌ای ساخته نشده است.</p>}</section>
      </div>
    </main>
  );
}
