import type { Metadata } from "next";
import Link from "next/link";
import { AppIcon, type IconName } from "@/components/app-icon";
import { requireUser } from "@/lib/auth/guards";
import { createAdminClient } from "@/lib/supabase/admin";

export const metadata: Metadata = { title: "داشبورد" };

type Job = { id: string; status: "queued" | "running" | "completed" | "failed" | "cancelled"; output_title: string | null; estimated_cost_usd: number | null; created_at: string };
type Key = { id: string; provider_id: string };
type Provider = { id: string; name: string; enabled: boolean };
type Model = { provider_id: string };

const statusLabel = { queued: "در صف", running: "در حال ساخت", completed: "آماده", failed: "ناموفق", cancelled: "لغوشده" };
const statusClass = { queued: "status-queued", running: "status-running", completed: "status-completed", failed: "status-failed", cancelled: "status-cancelled" };

export default async function DashboardPage() {
  const { profile, supabase } = await requireUser();
  const admin = createAdminClient();
  const now = new Date();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
  const [monthResult, recentResult, userKeysResult, systemKeysResult, providersResult, modelsResult] = await Promise.all([
    supabase.from("generation_jobs").select("id, status, output_title, estimated_cost_usd, created_at").gte("created_at", monthStart).returns<Job[]>(),
    supabase.from("generation_jobs").select("id, status, output_title, estimated_cost_usd, created_at").order("created_at", { ascending: false }).limit(5).returns<Job[]>(),
    supabase.from("user_api_keys").select("id, provider_id").is("deleted_at", null).eq("is_active", true).eq("test_status", "valid").returns<Key[]>(),
    admin.from("system_api_keys").select("id, provider_id").is("deleted_at", null).eq("is_active", true).eq("test_status", "valid").returns<Key[]>(),
    supabase.from("providers").select("id, name, enabled").eq("enabled", true).returns<Provider[]>(),
    supabase.from("provider_models").select("provider_id").eq("enabled", true).returns<Model[]>(),
  ]);
  const monthJobs = monthResult.data ?? [];
  const recentJobs = recentResult.data ?? [];
  const enabledProviderIds = new Set((providersResult.data ?? []).map((provider) => provider.id));
  const personalConnections = (userKeysResult.data ?? []).filter((key) => enabledProviderIds.has(key.provider_id)).length;
  const sharedConnections = (systemKeysResult.data ?? []).filter((key) => enabledProviderIds.has(key.provider_id)).length;
  const connectionCount = personalConnections + sharedConnections;
  const connectionProviderIds = new Set([...(userKeysResult.data ?? []), ...(systemKeysResult.data ?? [])].filter((key) => enabledProviderIds.has(key.provider_id)).map((key) => key.provider_id));
  const ready = (modelsResult.data ?? []).some((model) => connectionProviderIds.has(model.provider_id));
  const completed = monthJobs.filter((job) => job.status === "completed").length;
  const cost = monthJobs.reduce((sum, job) => sum + Number(job.estimated_cost_usd ?? 0), 0);

  const metrics: Array<{ title: string; value: string; note: string; icon: IconName; tone: string }> = [
    { title: "تولیدهای این ماه", value: new Intl.NumberFormat("fa-IR").format(monthJobs.length), note: `${new Intl.NumberFormat("fa-IR").format(completed)} خروجی آماده`, icon: "sparkles", tone: "violet" },
    { title: "اتصال‌های آماده", value: new Intl.NumberFormat("fa-IR").format(connectionCount), note: sharedConnections ? `${new Intl.NumberFormat("fa-IR").format(sharedConnections)} اتصال سراسری` : "کلید شخصی یا سراسری", icon: "zap", tone: "cyan" },
    { title: "هزینهٔ تخمینی", value: `$${cost.toFixed(4)}`, note: "از ابتدای ماه جاری", icon: "chart", tone: "amber" },
  ];

  return (
    <div className="mx-auto max-w-7xl">
      <section className="dashboard-hero">
        <div className="dashboard-hero-glow" />
        <div className="relative z-10 max-w-3xl">
          <span className="dashboard-eyebrow"><AppIcon className="h-4 w-4" name="sparkles" /> فضای کاری هوشمند شما</span>
          <h1>سلام {profile.display_name ?? "دوست عزیز"}؛<br /><span>امروز چه چیزی می‌سازیم؟</span></h1>
          <p>موضوع را مشخص کنید، موتور مناسب را انتخاب کنید و مقاله و تصویر آمادهٔ انتشار تحویل بگیرید.</p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link className="hero-primary" href={ready ? "/dashboard/content/new" : "/dashboard/api-keys"}><AppIcon className="h-5 w-5" name={ready ? "plus" : "key"} />{ready ? "ساخت محتوای جدید" : "راه‌اندازی اتصال هوش مصنوعی"}</Link>
            <Link className="hero-secondary" href="/dashboard/history"><AppIcon className="h-5 w-5" name="history" />مشاهدهٔ خروجی‌ها</Link>
          </div>
        </div>
        <div className="dashboard-orbit" aria-hidden="true"><span>AI</span><i /><b /></div>
      </section>

      <section className="onboarding-strip" aria-label="مراحل شروع">
        <div className={connectionCount ? "onboarding-step is-done" : "onboarding-step is-current"}><span>{connectionCount ? <AppIcon name="check" /> : "۱"}</span><div><strong>اتصال هوش مصنوعی</strong><small>{sharedConnections ? "اتصال سراسری مدیر آماده است" : personalConnections ? "کلید شخصی شما آماده است" : "هنوز اتصالی آماده نیست"}</small></div></div>
        <i className={connectionCount ? "step-line is-done" : "step-line"} />
        <div className={ready ? "onboarding-step is-current" : "onboarding-step"}><span>۲</span><div><strong>ساخت درخواست</strong><small>موضوع، لحن و مدل را انتخاب کنید</small></div></div>
        <i className="step-line" />
        <div className="onboarding-step"><span>۳</span><div><strong>دریافت خروجی</strong><small>پیشرفت را زنده دنبال کنید</small></div></div>
      </section>

      {!ready ? <section className="setup-alert"><span><AppIcon name="key" /></span><div><h2>یک قدم تا نخستین محتوا</h2><p>{connectionCount === 0 ? "هیچ کلید فعالی پیدا نشد. مدیر می‌تواند یک کلید سراسری برای همه ثبت کند یا شما کلید شخصی خودتان را اضافه کنید." : "اتصال آماده است، اما هنوز مدل فعالی برای تولید تعریف نشده است."}</p></div><Link href={profile.role === "system_admin" ? "/system-admin" : "/dashboard/api-keys"}>{profile.role === "system_admin" ? "تکمیل راه‌اندازی در پنل مدیریت" : "افزودن کلید شخصی"}<AppIcon className="h-4 w-4 rotate-180" name="arrow" /></Link></section> : null}

      <section className="mt-6 grid gap-4 md:grid-cols-3">
        {metrics.map((metric) => <article className={`metric-card metric-${metric.tone}`} key={metric.title}><span className="metric-icon"><AppIcon name={metric.icon} /></span><div><p>{metric.title}</p><strong>{metric.value}</strong><small>{metric.note}</small></div></article>)}
      </section>

      <section className="mt-6 grid gap-6 xl:grid-cols-[1.25fr_.75fr]">
        <article className="content-card overflow-hidden">
          <div className="section-heading"><div><span>آخرین فعالیت‌ها</span><h2>محتواهای اخیر</h2></div><Link href="/dashboard/history">مشاهدهٔ همه</Link></div>
          {recentJobs.length ? <div className="activity-list">{recentJobs.map((job) => <Link className="activity-row" href={`/dashboard/history/${job.id}`} key={job.id}><span className="activity-symbol"><AppIcon name="sparkles" /></span><div className="min-w-0 flex-1"><h3 className="truncate">{job.output_title ?? "درخواست در حال پردازش"}</h3><p>{new Intl.DateTimeFormat("fa-IR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(job.created_at))}</p></div><span className={`job-status ${statusClass[job.status]}`}>{statusLabel[job.status]}</span></Link>)}</div> : <div className="empty-state"><span><AppIcon name="sparkles" /></span><h3>هنوز محتوایی نساخته‌اید</h3><p>بعد از آماده شدن اتصال، نخستین درخواست شما اینجا نمایش داده می‌شود.</p><Link href={ready ? "/dashboard/content/new" : "/dashboard/api-keys"}>{ready ? "ساخت اولین محتوا" : "آماده‌سازی اتصال"}</Link></div>}
        </article>

        <aside className="content-card p-6">
          <div className="section-heading compact"><div><span>میان‌برها</span><h2>دسترسی سریع</h2></div></div>
          <div className="quick-actions">
            <Link href="/dashboard/content/new"><span className="bg-violet-100 text-violet-700"><AppIcon name="sparkles" /></span><div><strong>ساخت محتوا</strong><small>مقاله و تصویر تازه</small></div><AppIcon className="h-4 w-4 rotate-180 text-slate-400" name="arrow" /></Link>
            <Link href="/dashboard/api-keys"><span className="bg-cyan-100 text-cyan-700"><AppIcon name="key" /></span><div><strong>اتصال‌ها</strong><small>کلید شخصی و سراسری</small></div><AppIcon className="h-4 w-4 rotate-180 text-slate-400" name="arrow" /></Link>
            <Link href="/dashboard/search-console"><span className="bg-amber-100 text-amber-700"><AppIcon name="search" /></span><div><strong>فرصت‌های سئو</strong><small>داده‌های سرچ کنسول</small></div><AppIcon className="h-4 w-4 rotate-180 text-slate-400" name="arrow" /></Link>
          </div>
        </aside>
      </section>
    </div>
  );
}
