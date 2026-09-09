import type { Metadata } from "next";
import { AppIcon } from "@/components/app-icon";
import { requireUser } from "@/lib/auth/guards";
import { createAdminClient } from "@/lib/supabase/admin";
import { disconnectSearchConsoleAction, syncSearchConsoleAction, togglePropertyAction, updateSuggestionAction } from "./actions";
import { SuggestTitleForm } from "./suggest-title-form";
import { ServiceAccountForm } from "./service-account-form";

export const metadata: Metadata = { title: "سرچ کنسول" };
type Connection = { id: string; google_email: string | null; auth_type: "oauth" | "service_account"; status: string; last_synced_at: string | null };
type Property = { id: string; site_url: string; permission_level: string; selected: boolean; last_synced_at: string | null };
type Suggestion = { id: string; property_id: string; source_query: string; source_page: string; suggested_title: string; evidence: { clicks?: number; impressions?: number; ctr?: number; position?: number }; score: number; status: "pending" | "accepted" | "rejected" };
type Metric = { clicks: number; impressions: number };
type KeyRow = { id: string; provider_id: string; label: string; key_hint: string };
type Provider = { id: string; name: string; slug: string; enabled: boolean };
type Model = { provider_id: string; model_key: string; display_name: string; kind: "text" | "image" | "multimodal" };

const notices: Record<string, string> = { connected: "حساب گوگل متصل شد؛ اکنون ویژگی‌ها را همگام کنید.", synced: "داده‌های سرچ کنسول به‌روز شدند.", disconnected: "اتصال سرچ کنسول حذف شد.", suggested: "پیشنهادهای تازه بر پایهٔ داده ساخته شدند." };
const errors: Record<string, string> = { "not-configured": "اتصال گوگل هنوز توسط مدیر سامانه فعال نشده است.", state: "اعتبار درخواست اتصال تأیید نشد؛ دوباره تلاش کنید.", oauth: "اتصال حساب گوگل کامل نشد.", sync: "همگام‌سازی سرچ کنسول انجام نشد.", property: "ویژگی انتخاب‌شده معتبر نیست.", "no-data": "دادهٔ کافی برای پیشنهاد عنوان وجود ندارد." };

export default async function SearchConsolePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { supabase } = await requireUser();
  const admin = createAdminClient();
  const query = await searchParams;
  const [{ data: connection }, { data: properties }, { data: suggestions }, { data: metrics }, { data: keys }, { data: systemKeys }, { data: providers }, { data: models }] = await Promise.all([
    supabase.from("gsc_connections").select("id, google_email, auth_type, status, last_synced_at").maybeSingle<Connection>(),
    supabase.from("gsc_properties").select("id, site_url, permission_level, selected, last_synced_at").order("site_url").returns<Property[]>(),
    supabase.from("title_suggestions").select("id, property_id, source_query, source_page, suggested_title, evidence, score, status").order("score", { ascending: false }).limit(50).returns<Suggestion[]>(),
    supabase.from("gsc_metrics_daily").select("clicks, impressions").limit(10000).returns<Metric[]>(),
    supabase.from("user_api_keys").select("id, provider_id, label, key_hint").is("deleted_at", null).eq("is_active", true).eq("test_status", "valid").returns<KeyRow[]>(),
    admin.from("system_api_keys").select("id, provider_id, label, key_hint").is("deleted_at", null).eq("is_active", true).eq("test_status", "valid").returns<KeyRow[]>(),
    supabase.from("providers").select("id, name, slug, enabled").eq("enabled", true).returns<Provider[]>(),
    supabase.from("provider_models").select("provider_id, model_key, display_name, kind").eq("enabled", true).in("kind", ["text", "multimodal"]).order("display_name").returns<Model[]>(),
  ]);
  const providerById = new Map((providers ?? []).map((provider) => [provider.id, provider]));
  const keyOptions = [
    ...(systemKeys ?? []).flatMap((key) => { const provider = providerById.get(key.provider_id); return provider ? [{ ...key, connectionId: `system:${key.id}`, source: "system" as const, provider }] : []; }),
    ...(keys ?? []).flatMap((key) => { const provider = providerById.get(key.provider_id); return provider ? [{ ...key, connectionId: `user:${key.id}`, source: "user" as const, provider }] : []; }),
  ];
  const clicks = (metrics ?? []).reduce((sum, metric) => sum + Number(metric.clicks), 0);
  const impressions = (metrics ?? []).reduce((sum, metric) => sum + Number(metric.impressions), 0);
  const noticeKey = typeof query.notice === "string" ? query.notice : "";
  const errorKey = typeof query.error === "string" ? query.error : "";

  return (
    <div className="mx-auto max-w-6xl">
      <header className="page-heading"><div><span className="page-kicker"><AppIcon name="search" /> فرصت‌های محتوایی</span><h1>گوگل سرچ کنسول</h1><p>عملکرد جست‌وجو را همگام کنید و با تکیه بر نمایش، نرخ کلیک و جایگاه واقعی، عنوان تازه بسازید.</p></div></header>
      {notices[noticeKey] || errors[errorKey] ? <p className={`mt-6 rounded-xl px-4 py-3 text-sm ${errors[errorKey] ? "bg-red-50 text-danger dark:bg-red-950/30" : "bg-brand-soft text-brand-strong"}`}>{errors[errorKey] ?? notices[noticeKey]}</p> : null}

      {!connection ? <section className="content-card mt-8 p-7"><div className="form-card-title"><span className="bg-cyan-100 text-cyan-700"><AppIcon name="search" /></span><div><small>اتصال شخصی و مستقل</small><h2>اتصال سرچ کنسول با فایل جیسون</h2><p>حساب خدماتی پروژهٔ گوگل خودتان را وصل کنید؛ این اتصال به تنظیمات مدیر سامانه وابسته نیست.</p></div></div><ol className="gsc-steps"><li><b>۱</b><span>رابط برنامه‌نویسی سرچ کنسول را در پروژهٔ گوگل فعال کنید.</span></li><li><b>۲</b><span>یک حساب خدماتی و کلید جیسون بسازید.</span></li><li><b>۳</b><span>ایمیل حساب خدماتی را در تنظیمات کاربران سرچ کنسول سایت اضافه کنید.</span></li></ol><ServiceAccountForm /></section> : <>
        <section className="panel mt-8 p-6"><div className="flex flex-wrap items-center justify-between gap-5"><div><span className="job-status status-completed">اتصال فعال</span><h2 className="mt-3 text-xl font-black">حساب سرچ کنسول شما</h2><p className="mt-2 text-sm text-muted" dir="ltr">{connection.google_email}</p><p className="mt-1 text-xs text-muted">روش اتصال: {connection.auth_type === "service_account" ? "حساب خدماتی شخصی" : "ورود گوگل"}</p>{connection.last_synced_at ? <p className="mt-1 text-xs text-muted">آخرین همگام‌سازی: {new Intl.DateTimeFormat("fa-IR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(connection.last_synced_at))}</p> : null}</div><div className="flex gap-2"><form action={syncSearchConsoleAction}><button className="primary-button" type="submit">همگام‌سازی</button></form><form action={disconnectSearchConsoleAction}><button className="danger-button" type="submit">قطع اتصال</button></form></div></div></section>

        <section className="mt-6 grid gap-4 sm:grid-cols-3"><article className="panel p-5"><p className="text-sm text-muted">ویژگی‌ها</p><p className="mt-3 text-3xl font-black">{new Intl.NumberFormat("fa-IR").format(properties?.length ?? 0)}</p></article><article className="panel p-5"><p className="text-sm text-muted">کلیک در دادهٔ ذخیره‌شده</p><p className="mt-3 text-3xl font-black">{new Intl.NumberFormat("fa-IR", { maximumFractionDigits: 0 }).format(clicks)}</p></article><article className="panel p-5"><p className="text-sm text-muted">نمایش در دادهٔ ذخیره‌شده</p><p className="mt-3 text-3xl font-black">{new Intl.NumberFormat("fa-IR", { maximumFractionDigits: 0 }).format(impressions)}</p></article></section>

        <section className="panel mt-6 overflow-hidden"><div className="border-b border-line p-6"><h2 className="text-xl font-black">ویژگی‌های سایت</h2><p className="mt-2 text-sm text-muted">فقط ویژگی‌های انتخاب‌شده در همگام‌سازی داده پردازش می‌شوند.</p></div>{(properties ?? []).length ? <div className="divide-y divide-line">{(properties ?? []).map((property) => <form action={togglePropertyAction} className="flex flex-wrap items-center justify-between gap-4 p-5" key={property.id}><div><p className="font-bold" dir="ltr">{property.site_url}</p><p className="mt-1 text-xs text-muted">{property.permission_level}{property.last_synced_at ? ` · آخرین داده: ${new Intl.DateTimeFormat("fa-IR").format(new Date(property.last_synced_at))}` : ""}</p></div><input name="propertyId" type="hidden" value={property.id} /><input name="selected" type="hidden" value={String(!property.selected)} /><button className={property.selected ? "danger-button text-sm" : "secondary-button text-sm"} type="submit">{property.selected ? "حذف از همگام‌سازی" : "افزودن به همگام‌سازی"}</button></form>)}</div> : <p className="p-6 text-sm text-muted">برای دریافت فهرست سایت‌ها، همگام‌سازی را اجرا کنید.</p>}</section>

        {(properties ?? []).some((property) => property.last_synced_at) && keyOptions.length ? <section className="content-card mt-6 p-6"><div className="form-card-title"><span className="bg-violet-100 text-violet-700"><AppIcon name="sparkles" /></span><div><small>پیشنهاد هوشمند</small><h2>ساخت پیشنهاد عنوان</h2><p>فرصت‌ها از دادهٔ واقعی رتبه‌بندی می‌شوند و مدل انتخابی برای آن‌ها عنوان می‌سازد.</p></div></div><SuggestTitleForm keys={keyOptions} models={models ?? []} properties={(properties ?? []).filter((property) => property.selected)} /></section> : null}

        {(suggestions ?? []).length ? <section className="panel mt-6 overflow-hidden"><div className="border-b border-line p-6"><h2 className="text-xl font-black">پیشنهادها</h2></div><div className="divide-y divide-line">{(suggestions ?? []).map((suggestion) => <article className="grid gap-4 p-5 lg:grid-cols-[1fr_auto] lg:items-center" key={suggestion.id}><div><h3 className="font-black">{suggestion.suggested_title}</h3><p className="mt-2 text-sm text-muted">عبارت: {suggestion.source_query}</p><p className="mt-1 text-xs text-muted">نمایش: {new Intl.NumberFormat("fa-IR").format(suggestion.evidence.impressions ?? 0)} · نرخ کلیک: {new Intl.NumberFormat("fa-IR", { style: "percent", maximumFractionDigits: 1 }).format(suggestion.evidence.ctr ?? 0)} · جایگاه: {new Intl.NumberFormat("fa-IR", { maximumFractionDigits: 1 }).format(suggestion.evidence.position ?? 0)}</p></div>{suggestion.status === "pending" ? <div className="flex gap-2"><form action={updateSuggestionAction}><input name="suggestionId" type="hidden" value={suggestion.id} /><input name="status" type="hidden" value="accepted" /><button className="primary-button text-sm" type="submit">انتقال به تولید</button></form><form action={updateSuggestionAction}><input name="suggestionId" type="hidden" value={suggestion.id} /><input name="status" type="hidden" value="rejected" /><button className="danger-button text-sm" type="submit">رد</button></form></div> : <span className="text-sm font-bold text-muted">{suggestion.status === "accepted" ? "پذیرفته‌شده" : "ردشده"}</span>}</article>)}</div></section> : null}
      </>}
    </div>
  );
}
