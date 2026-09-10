import type { Metadata } from "next";
import { AppIcon } from "@/components/app-icon";
import { requireUser } from "@/lib/auth/guards";
import { createAdminClient } from "@/lib/supabase/admin";
import { disconnectSearchConsoleAction, syncSearchConsoleAction, togglePropertyAction, updateSuggestionAction } from "./actions";
import { ServiceAccountForm } from "./service-account-form";
import { SuggestTitleForm } from "./suggest-title-form";

export const metadata: Metadata = { title: "مرکز تحلیل سرچ کنسول" };
type Connection = { id: string; google_email: string | null; auth_type: "oauth" | "service_account"; status: string; last_synced_at: string | null };
type Property = { id: string; site_url: string; permission_level: string; selected: boolean; last_synced_at: string | null };
type Suggestion = { id: string; source_query: string; source_page: string; suggested_title: string; suggestion_type: string; analysis: { reason?: string; angle?: string; search_intent?: string; meta_description?: string; competing_pages?: number }; evidence: { clicks?: number; impressions?: number; ctr?: number; position?: number }; score: number; status: "pending" | "accepted" | "rejected" };
type Metric = { metric_date: string; query: string; page: string; country: string; device: string; search_type: string; data_scope: "detail" | "total" | "query" | "page" | "query_page" | "country" | "device"; clicks: number; impressions: number; ctr: number; position: number };
type Sitemap = { id: string; path: string; sitemap_type: string | null; is_pending: boolean; last_downloaded_at: string | null; warnings: number; errors: number; contents: unknown };
type SyncRun = { id: string; trigger_type: string; status: "running" | "completed" | "partial" | "failed"; started_at: string; completed_at: string | null; rows_written: number; properties_synced: number; search_types: string[]; error_code: string | null; error_message: string | null; error_details: { issues?: Array<{ property?: string; searchType?: string; code: string; message: string }> } };
type KeyRow = { id: string; provider_id: string; label: string; key_hint: string };
type Provider = { id: string; name: string; slug: string; enabled: boolean };
type Model = { provider_id: string; model_key: string; display_name: string; kind: "text" | "image" | "multimodal" };

const notices: Record<string, string> = { connected: "حساب گوگل متصل شد. برای دریافت ویژگی‌ها و داده‌های گذشته، همگام‌سازی را اجرا کنید.", synced: "همگام‌سازی انجام شد؛ نتیجه و خطاهای احتمالی در گزارش اجرا نمایش داده می‌شود.", disconnected: "اتصال سرچ کنسول و داده‌های وابسته حذف شد.", suggested: "تحلیل فرصت‌ها و پیشنهادهای جدید با موفقیت ساخته شد." };
const errors: Record<string, string> = { sync: "همگام‌سازی کامل نشد.", property: "ویژگی انتخاب‌شده معتبر نیست.", "no-data": "برای تحلیل عنوان، حداقل یک عبارت با ۱۰ نمایش و جایگاه ۳ تا ۳۰ لازم است.", "suggestion-model": "مدل هوش مصنوعی نتوانست پیشنهاد تخصصی و معتبر تولید کند؛ هیچ عنوان قالبی جایگزین نشد." };
const typeLabel: Record<string, string> = { web: "وب", image: "تصویر", video: "ویدئو", news: "اخبار", discover: "دیسکاور", googleNews: "گوگل نیوز" };
const deviceLabel: Record<string, string> = { MOBILE: "تلفن همراه", DESKTOP: "رایانه", TABLET: "تبلت" };
const countryLabel: Record<string, string> = { irn: "ایران", usa: "ایالات متحده", deu: "آلمان", gbr: "بریتانیا", can: "کانادا", are: "امارات", tur: "ترکیه", fra: "فرانسه", ind: "هند", nld: "هلند", aus: "استرالیا" };
const opportunityLabel: Record<string, string> = { ctr_gap: "فرصت افزایش نرخ کلیک", striking_distance: "نزدیک صفحهٔ اول", ranking_opportunity: "فرصت بهبود رتبه", cannibalization: "هم‌پوشانی چند صفحه" };
const statusLabel: Record<string, string> = { running: "در حال اجرا", completed: "موفق", partial: "نیمه‌کامل", failed: "ناموفق" };
const number = (value: number, digits = 0) => new Intl.NumberFormat("fa-IR", { maximumFractionDigits: digits }).format(value);

function aggregate(rows: Metric[], keyOf: (row: Metric) => string) {
  const map = new Map<string, { key: string; clicks: number; impressions: number; positionWeight: number }>();
  for (const row of rows) { const key = keyOf(row) || "نامشخص"; const item = map.get(key) ?? { key, clicks: 0, impressions: 0, positionWeight: 0 }; item.clicks += Number(row.clicks); item.impressions += Number(row.impressions); item.positionWeight += Number(row.position) * Number(row.impressions); map.set(key, item); }
  return [...map.values()].map((item) => ({ ...item, ctr: item.impressions ? item.clicks / item.impressions : 0, position: item.impressions ? item.positionWeight / item.impressions : 0 })).sort((a, b) => b.impressions - a.impressions);
}

export default async function SearchConsolePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { supabase } = await requireUser();
  const admin = createAdminClient();
  const query = await searchParams;
  const results = await Promise.all([
    supabase.from("gsc_connections").select("id, google_email, auth_type, status, last_synced_at").maybeSingle<Connection>(),
    supabase.from("gsc_properties").select("id, site_url, permission_level, selected, last_synced_at").order("site_url").returns<Property[]>(),
    supabase.from("title_suggestions").select("id, source_query, source_page, suggested_title, suggestion_type, analysis, evidence, score, status").order("score", { ascending: false }).limit(50).returns<Suggestion[]>(),
    supabase.from("gsc_metrics_daily").select("metric_date, query, page, country, device, search_type, data_scope, clicks, impressions, ctr, position").order("metric_date", { ascending: false }).limit(50_000).returns<Metric[]>(),
    supabase.from("gsc_sitemaps").select("id, path, sitemap_type, is_pending, last_downloaded_at, warnings, errors, contents").order("errors", { ascending: false }).returns<Sitemap[]>(),
    supabase.from("gsc_sync_runs").select("id, trigger_type, status, started_at, completed_at, rows_written, properties_synced, search_types, error_code, error_message, error_details").order("started_at", { ascending: false }).limit(10).returns<SyncRun[]>(),
    supabase.from("user_api_keys").select("id, provider_id, label, key_hint").is("deleted_at", null).eq("is_active", true).eq("test_status", "valid").returns<KeyRow[]>(),
    admin.from("system_api_keys").select("id, provider_id, label, key_hint").is("deleted_at", null).eq("is_active", true).eq("test_status", "valid").returns<KeyRow[]>(),
    supabase.from("providers").select("id, name, slug, enabled").eq("enabled", true).returns<Provider[]>(),
    supabase.from("provider_models").select("provider_id, model_key, display_name, kind").eq("enabled", true).in("kind", ["text", "multimodal"]).order("display_name").returns<Model[]>(),
  ]);
  const [connection, properties, suggestions, metrics, sitemaps, runs, keys, systemKeys, providers, models] = results.map((result) => result.data) as [Connection | null, Property[] | null, Suggestion[] | null, Metric[] | null, Sitemap[] | null, SyncRun[] | null, KeyRow[] | null, KeyRow[] | null, Provider[] | null, Model[] | null];
  const providerById = new Map((providers ?? []).map((provider) => [provider.id, provider]));
  const keyOptions = [...(systemKeys ?? []).flatMap((key) => { const provider = providerById.get(key.provider_id); return provider ? [{ ...key, connectionId: `system:${key.id}`, source: "system" as const, provider }] : []; }), ...(keys ?? []).flatMap((key) => { const provider = providerById.get(key.provider_id); return provider ? [{ ...key, connectionId: `user:${key.id}`, source: "user" as const, provider }] : []; })];
  const rows = metrics ?? [];
  const reportRows = (scope: Metric["data_scope"], fallback: (row: Metric) => boolean) => {
    const scoped = rows.filter((row) => row.data_scope === scope);
    return scoped.length ? scoped : rows.filter(fallback);
  };
  const totalRows = reportRows("total", (row) => row.data_scope === "detail");
  const queryRows = reportRows("query", (row) => row.data_scope === "detail" && Boolean(row.query));
  const pageRows = reportRows("page", (row) => row.data_scope === "detail" && Boolean(row.page));
  const countryRows = reportRows("country", (row) => row.data_scope === "detail" && Boolean(row.country));
  const deviceRows = reportRows("device", (row) => row.data_scope === "detail" && Boolean(row.device));
  const clicks = totalRows.reduce((sum, row) => sum + Number(row.clicks), 0);
  const impressions = totalRows.reduce((sum, row) => sum + Number(row.impressions), 0);
  const ctr = impressions ? clicks / impressions : 0;
  const position = impressions ? totalRows.reduce((sum, row) => sum + Number(row.position) * Number(row.impressions), 0) / impressions : 0;
  const topQueries = aggregate(queryRows.filter((row) => row.search_type === "web" && row.query), (row) => row.query).slice(0, 20);
  const allPages = aggregate(pageRows.filter((row) => row.search_type === "web" && row.page), (row) => row.page);
  const topPages = allPages.slice(0, 20);
  const devices = aggregate(deviceRows.filter((row) => row.device), (row) => deviceLabel[row.device] ?? row.device);
  const countries = aggregate(countryRows.filter((row) => row.country), (row) => countryLabel[row.country.toLowerCase()] ?? `کشور ${row.country.toUpperCase()}`).slice(0, 12);
  const searchKinds = aggregate(totalRows, (row) => typeLabel[row.search_type] ?? row.search_type);
  const daily = aggregate(totalRows, (row) => row.metric_date).sort((a, b) => a.key.localeCompare(b.key)).slice(-28);
  const maxDailyImpressions = Math.max(1, ...daily.map((item) => item.impressions));
  const latestRun = runs?.[0];
  const detail = typeof query.detail === "string" ? query.detail.slice(0, 500) : "";
  const noticeKey = typeof query.notice === "string" ? query.notice : "";
  const errorKey = typeof query.error === "string" ? query.error : "";

  return <div className="mx-auto max-w-7xl">
    <header className="page-heading"><div><span className="page-kicker"><AppIcon name="search" /> داده، تحلیل و اقدام</span><h1>مرکز تحلیل سرچ کنسول</h1><p>عملکرد واقعی جست‌وجوی سایت را به زبان روشن ببینید، خطاها را پیگیری کنید و فرصت‌های محتوایی را به درخواست تولید تبدیل کنید.</p></div>{connection ? <span className="gsc-schedule-badge"><AppIcon name="activity" /> همگام‌سازی خودکار هر روز ساعت ۷ صبح تهران</span> : null}</header>
    {notices[noticeKey] || errors[errorKey] ? <div className={`gsc-message ${errors[errorKey] ? "error" : "success"}`}><strong>{errors[errorKey] ?? notices[noticeKey]}</strong>{detail ? <p>{detail}</p> : null}</div> : null}

    {!connection ? <section className="content-card mt-8 p-7"><div className="form-card-title"><span className="bg-cyan-100 text-cyan-700"><AppIcon name="search" /></span><div><small>اتصال شخصی و مستقل</small><h2>اتصال سرچ کنسول با فایل جیسون</h2><p>حساب خدماتی پروژهٔ گوگل خودتان را وصل کنید؛ این اتصال به تنظیمات مدیر سامانه وابسته نیست.</p></div></div><ol className="gsc-steps"><li><b>۱</b><span>رابط برنامه‌نویسی سرچ کنسول را در پروژهٔ گوگل فعال کنید.</span></li><li><b>۲</b><span>یک حساب خدماتی و کلید جیسون بسازید.</span></li><li><b>۳</b><span>ایمیل حساب خدماتی را با دسترسی مشاهده در سرچ کنسول سایت اضافه کنید.</span></li></ol><ServiceAccountForm /></section> : <>
      <section className="gsc-connection-card"><div><span className={`job-status ${connection.status === "active" ? "status-completed" : "status-failed"}`}>{connection.status === "active" ? "اتصال فعال" : "اتصال نیازمند بررسی"}</span><h2>حساب سرچ کنسول شما</h2><p dir="ltr">{connection.google_email}</p><small>آخرین همگام‌سازی: {connection.last_synced_at ? new Intl.DateTimeFormat("fa-IR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(connection.last_synced_at)) : "هنوز اجرا نشده"}</small></div><div className="flex flex-wrap gap-2"><form action={syncSearchConsoleAction}><button className="primary-button" type="submit">همگام‌سازی کامل اکنون</button></form><form action={disconnectSearchConsoleAction}><button className="danger-button" type="submit">قطع اتصال</button></form></div></section>

      {latestRun && latestRun.status !== "completed" ? <section className="gsc-health-alert"><AppIcon name="activity" /><div><strong>آخرین همگام‌سازی {statusLabel[latestRun.status]}</strong><p>{latestRun.error_message ?? "بخشی از داده‌ها دریافت نشده است."}</p>{latestRun.error_details?.issues?.map((issue, index) => <small key={`${issue.code}-${index}`}>{typeLabel[issue.searchType ?? ""] ?? issue.searchType ?? "داده"}: {issue.message}</small>)}</div></section> : null}

      <section className="gsc-metrics"><article><span>نمایش</span><strong>{number(impressions)}</strong><p>دفعات دیده‌شدن صفحات سایت در نتایج گوگل</p></article><article><span>کلیک</span><strong>{number(clicks)}</strong><p>ورود کاربران از نتایج جست‌وجو به سایت</p></article><article><span>نرخ کلیک</span><strong>{number(ctr * 100, 2)}٪</strong><p>درصد نمایش‌هایی که به کلیک تبدیل شده‌اند</p></article><article><span>میانگین جایگاه</span><strong>{number(position, 1)}</strong><p>عدد کمتر به معنی رتبهٔ بهتر در نتایج است</p></article></section>

      <section className="gsc-grid mt-6"><article className="content-card p-6"><div className="section-heading compact"><div><span>۲۸ روز اخیر ذخیره‌شده</span><h2>روند نمایش روزانه</h2></div></div>{daily.length ? <div className="gsc-chart">{daily.map((item) => <div key={item.key} title={`${item.key}: ${number(item.impressions)} نمایش`}><i style={{ height: `${Math.max(4, item.impressions / maxDailyImpressions * 100)}%` }} /><span>{new Intl.DateTimeFormat("fa-IR", { month: "numeric", day: "numeric" }).format(new Date(`${item.key}T00:00:00Z`))}</span></div>)}</div> : <p className="gsc-empty">هنوز داده‌ای برای نمایش نمودار وجود ندارد.</p>}</article><article className="content-card p-6"><div className="section-heading compact"><div><span>نوع حضور در گوگل</span><h2>سهم انواع جست‌وجو</h2></div></div><div className="gsc-breakdown">{searchKinds.map((item) => <div key={item.key}><span>{item.key}</span><b>{number(item.impressions)} نمایش</b><i><em style={{ width: `${impressions ? item.impressions / impressions * 100 : 0}%` }} /></i></div>)}</div></article></section>

      <section className="gsc-grid mt-6"><article className="content-card overflow-hidden"><div className="section-heading"><div><span>گزارش مستقل عبارت‌ها؛ تا ۲۰ مورد برتر</span><h2>عبارت‌های برتر</h2></div></div><div className="gsc-table"><div className="head"><span>عبارت</span><span>نمایش</span><span>کلیک</span><span>جایگاه</span></div>{topQueries.map((item) => <div key={item.key}><strong>{item.key}</strong><span>{number(item.impressions)}</span><span>{number(item.clicks)}</span><span>{number(item.position, 1)}</span></div>)}</div></article><article className="content-card overflow-hidden"><div className="section-heading"><div><span>{number(allPages.length)} صفحهٔ یکتا؛ نمایش تا ۲۰ مورد برتر</span><h2>صفحات برتر</h2></div></div><div className="gsc-page-list">{topPages.map((item) => <div key={item.key}><a dir="ltr" href={item.key} rel="noreferrer" target="_blank">{item.key}</a><span>{number(item.impressions)} نمایش · {number(item.clicks)} کلیک · جایگاه {number(item.position, 1)}</span></div>)}</div></article></section>

      <section className="gsc-grid mt-6"><article className="content-card overflow-hidden"><div className="section-heading"><div><span>توزیع دستگاه</span><h2>کاربران چگونه جست‌وجو می‌کنند؟</h2></div></div><div className="gsc-device-grid">{devices.map((item) => <article key={item.key}><strong>{item.key}</strong><b>{number(item.impressions)}</b><span>نمایش · نرخ کلیک {number(item.ctr * 100, 1)}٪</span></article>)}</div></article><article className="content-card overflow-hidden"><div className="section-heading"><div><span>موقعیت جغرافیایی</span><h2>کشورهای برتر</h2></div></div><div className="gsc-breakdown p-5">{countries.map((item) => <div key={item.key}><span>{item.key}</span><b>{number(item.impressions)} نمایش</b><i><em style={{ width: `${impressions ? item.impressions / impressions * 100 : 0}%` }} /></i></div>)}</div></article></section>

      <section className="content-card mt-6 overflow-hidden"><div className="section-heading"><div><span>دارایی‌ها و دسترسی</span><h2>ویژگی‌های سایت و نقشه‌های سایت</h2></div></div><div className="divide-y divide-line">{(properties ?? []).map((property) => <form action={togglePropertyAction} className="gsc-property" key={property.id}><div><strong dir="ltr">{property.site_url}</strong><span>سطح دسترسی: {property.permission_level === "siteFullUser" ? "کاربر کامل" : property.permission_level}</span></div><input name="propertyId" type="hidden" value={property.id} /><input name="selected" type="hidden" value={String(!property.selected)} /><button className={property.selected ? "danger-button text-sm" : "secondary-button text-sm"} type="submit">{property.selected ? "توقف همگام‌سازی" : "فعال‌کردن"}</button></form>)}</div><div className="gsc-sitemaps">{(sitemaps ?? []).map((sitemap) => <article className={sitemap.errors || sitemap.warnings ? "has-error" : ""} key={sitemap.id}><div><strong dir="ltr">{sitemap.path}</strong><span>{sitemap.is_pending ? "در انتظار پردازش گوگل" : "پردازش‌شده"} · آخرین دریافت: {sitemap.last_downloaded_at ? new Intl.DateTimeFormat("fa-IR").format(new Date(sitemap.last_downloaded_at)) : "نامشخص"}</span></div><b>{sitemap.errors ? `${number(sitemap.errors)} خطا` : sitemap.warnings ? `${number(sitemap.warnings)} هشدار` : "بدون خطا"}</b></article>)}</div></section>

      <section className="content-card mt-6 overflow-hidden"><div className="section-heading"><div><span>شفافیت عملیات</span><h2>تاریخچهٔ همگام‌سازی و خطاها</h2></div></div><div className="gsc-run-list">{(runs ?? []).map((run) => <article key={run.id}><span className={`gsc-run-status ${run.status}`}>{statusLabel[run.status]}</span><div><strong>{run.trigger_type === "scheduled" ? "اجرای خودکار ساعت ۷" : "اجرای دستی"}</strong><p>{new Intl.DateTimeFormat("fa-IR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(run.started_at))} · {number(run.rows_written)} ردیف · {number(run.properties_synced)} ویژگی</p>{run.error_message ? <small>{run.error_message}</small> : null}</div><b>{run.search_types.map((type) => typeLabel[type] ?? type).join("، ") || "بدون داده"}</b></article>)}</div></section>

      {(properties ?? []).some((property) => property.last_synced_at) && keyOptions.length ? <section className="content-card mt-6 p-6"><div className="form-card-title"><span className="bg-violet-100 text-violet-700"><AppIcon name="sparkles" /></span><div><small>تحلیل حرفه‌ای فرصت‌ها</small><h2>پیشنهاد عنوان مبتنی بر شواهد</h2><p>عبارت‌ها براساس نمایش، نرخ کلیک، جایگاه و هم‌پوشانی صفحات رتبه‌بندی می‌شوند؛ مدل برای هر مورد دلیل، زاویهٔ محتوا و توضیح متا می‌سازد.</p></div></div><SuggestTitleForm keys={keyOptions} models={models ?? []} properties={(properties ?? []).filter((property) => property.selected)} /></section> : null}

      {(suggestions ?? []).length ? <section className="content-card mt-6 overflow-hidden"><div className="section-heading"><div><span>پیشنهادهای قابل ارزیابی</span><h2>فرصت‌های عنوان و محتوا</h2></div></div><div className="gsc-suggestions">{suggestions?.map((suggestion) => <article key={suggestion.id}><div className="gsc-suggestion-top"><span>{opportunityLabel[suggestion.suggestion_type] ?? "فرصت محتوایی"}</span><b>امتیاز فرصت {number(Number(suggestion.score), 1)}</b></div><h3>{suggestion.suggested_title}</h3><p><strong>دلیل:</strong> {suggestion.analysis?.reason ?? "تحلیل ثبت نشده است."}</p><p><strong>زاویهٔ پیشنهادی:</strong> {suggestion.analysis?.angle ?? "—"}</p><p><strong>قصد جست‌وجو:</strong> {suggestion.analysis?.search_intent ?? "—"}</p><div className="gsc-evidence"><span>عبارت: {suggestion.source_query}</span><span>{number(suggestion.evidence.impressions ?? 0)} نمایش</span><span>{number((suggestion.evidence.ctr ?? 0) * 100, 1)}٪ نرخ کلیک</span><span>جایگاه {number(suggestion.evidence.position ?? 0, 1)}</span></div><div className="gsc-meta"><strong>توضیح متا</strong><p>{suggestion.analysis?.meta_description ?? "—"}</p></div>{suggestion.status === "pending" ? <div className="mt-4 flex flex-wrap gap-2"><form action={updateSuggestionAction}><input name="suggestionId" type="hidden" value={suggestion.id} /><input name="status" type="hidden" value="accepted" /><button className="primary-button text-sm" type="submit">انتقال به استودیوی محتوا</button></form><form action={updateSuggestionAction}><input name="suggestionId" type="hidden" value={suggestion.id} /><input name="status" type="hidden" value="rejected" /><button className="danger-button text-sm" type="submit">رد پیشنهاد</button></form></div> : <span className="mt-4 inline-block text-sm font-bold text-muted">{suggestion.status === "accepted" ? "پذیرفته‌شده" : "ردشده"}</span>}</article>)}</div></section> : null}
    </>}
  </div>;
}
