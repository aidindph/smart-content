import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/auth/guards";

export const metadata: Metadata = { title: "داشبورد" };

type Job = { id: string; status: "queued" | "running" | "completed" | "failed" | "cancelled"; output_title: string | null; estimated_cost_usd: number | null; created_at: string };

export default async function DashboardPage() {
  const { profile, supabase } = await requireUser();
  const now = new Date();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
  const [{ data: monthJobs }, { data: recentJobs }, { count: keyCount }] = await Promise.all([
    supabase.from("generation_jobs").select("id, status, output_title, estimated_cost_usd, created_at").gte("created_at", monthStart).returns<Job[]>(),
    supabase.from("generation_jobs").select("id, status, output_title, estimated_cost_usd, created_at").order("created_at", { ascending: false }).limit(5).returns<Job[]>(),
    supabase.from("user_api_keys").select("id", { count: "exact", head: true }).is("deleted_at", null).eq("is_active", true).eq("test_status", "valid"),
  ]);
  const completed = (monthJobs ?? []).filter((job) => job.status === "completed").length;
  const cost = (monthJobs ?? []).reduce((sum, job) => sum + Number(job.estimated_cost_usd ?? 0), 0);
  const cards = [
    ["درخواست‌های این ماه", new Intl.NumberFormat("fa-IR").format(monthJobs?.length ?? 0), "همهٔ اجراهای ثبت‌شده"],
    ["هزینهٔ تخمینی", `$${cost.toFixed(4)}`, "بر پایهٔ قیمت‌های ثبت‌شده"],
    ["محتوای تکمیل‌شده", new Intl.NumberFormat("fa-IR").format(completed), "خروجی‌های آمادهٔ انتشار"],
  ] as const;
  return (
    <div className="mx-auto max-w-6xl">
      <header className="flex flex-wrap items-end justify-between gap-5">
        <div>
          <p className="text-sm font-bold text-brand">فضای کاری شما</p>
          <h1 className="mt-2 text-3xl font-black">سلام {profile.display_name ?? "دوست عزیز"}</h1>
          <p className="mt-3 text-muted">از اینجا می‌توانید تولید بعدی را آغاز و وضعیت اجراها را دنبال کنید.</p>
        </div>
        <Link className="primary-button" href="/dashboard/content/new">درخواست محتوای جدید</Link>
      </header>
      <section className="mt-8 grid gap-4 md:grid-cols-3">
        {cards.map(([title, value, description]) => (
          <article className="panel p-5" key={title}>
            <p className="text-sm font-bold text-muted">{title}</p>
            <p className="mt-3 text-3xl font-black">{value}</p>
            <p className="mt-3 text-sm leading-6 text-muted">{description}</p>
          </article>
        ))}
      </section>
      <section className="panel mt-6 p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div><h2 className="text-xl font-black">{keyCount ? "تولید بعدی را آغاز کنید" : "شروع سریع"}</h2><p className="mt-2 text-sm text-muted">{keyCount ? `${new Intl.NumberFormat("fa-IR").format(keyCount)} کلید فعال و آزمایش‌شده آماده است.` : "برای تولید نخستین محتوا، ابتدا کلید یکی از مدل‌ها را متصل کنید."}</p></div>
          <Link className="secondary-button" href={keyCount ? "/dashboard/content/new" : "/dashboard/api-keys"}>{keyCount ? "درخواست جدید" : "مدیریت کلیدها"}</Link>
        </div>
      </section>
      {(recentJobs ?? []).length ? <section className="panel mt-6 overflow-hidden"><div className="flex items-center justify-between border-b border-line p-5"><h2 className="text-xl font-black">فعالیت اخیر</h2><Link className="text-sm font-bold text-brand" href="/dashboard/history">مشاهدهٔ همه</Link></div><div className="divide-y divide-line">{(recentJobs ?? []).map((job) => <Link className="flex items-center justify-between gap-4 p-4 hover:bg-surface-subtle" href={`/dashboard/history/${job.id}`} key={job.id}><span className="truncate font-bold">{job.output_title ?? "درخواست در حال پردازش"}</span><span className="shrink-0 text-xs text-muted">{job.status === "completed" ? "تکمیل‌شده" : job.status === "running" ? "در حال اجرا" : job.status === "queued" ? "در صف" : job.status === "failed" ? "ناموفق" : "لغوشده"}</span></Link>)}</div></section> : null}
    </div>
  );
}
