import type { Metadata } from "next";
import Link from "next/link";
import { AppIcon } from "@/components/app-icon";
import { requireUser } from "@/lib/auth/guards";

export const metadata: Metadata = { title: "تاریخچهٔ تولید" };

type Job = { id: string; request_id: string; status: "queued" | "running" | "completed" | "failed" | "cancelled"; progress: number; created_at: string; output_title: string | null };
type ContentRequest = { id: string; topic: string; text_provider_slug: string; text_model: string };
const statusLabel = { queued: "در صف", running: "در حال اجرا", completed: "تکمیل‌شده", failed: "ناموفق", cancelled: "لغوشده" };

export default async function HistoryPage() {
  const { supabase } = await requireUser();
  const { data: jobs } = await supabase.from("generation_jobs").select("id, request_id, status, progress, created_at, output_title").order("created_at", { ascending: false }).limit(100).returns<Job[]>();
  const requestIds = [...new Set((jobs ?? []).map((job) => job.request_id))];
  const { data: requests } = requestIds.length
    ? await supabase.from("content_requests").select("id, topic, text_provider_slug, text_model").in("id", requestIds).returns<ContentRequest[]>()
    : { data: [] as ContentRequest[] };
  const requestById = new Map((requests ?? []).map((request) => [request.id, request]));

  return (
    <div className="mx-auto max-w-6xl">
      <header className="page-heading">
        <div><span className="page-kicker"><AppIcon name="history" /> خروجی‌ها و اجراها</span><h1>تاریخچهٔ تولید</h1><p>وضعیت هر درخواست، میزان پیشرفت و خروجی نهایی را از اینجا دنبال کنید.</p></div>
        <Link className="primary-button" href="/dashboard/content/new"><AppIcon className="h-4 w-4" name="plus" /> درخواست جدید</Link>
      </header>
      <section className="content-card mt-8 overflow-hidden">
        <div className="section-heading"><div><span>آخرین فعالیت‌ها</span><h2>{new Intl.NumberFormat("fa-IR").format(jobs?.length ?? 0)} اجرای ثبت‌شده</h2></div></div>
        {(jobs ?? []).length ? <div className="divide-y divide-line">{(jobs ?? []).map((job) => {
          const request = requestById.get(job.request_id);
          return <Link className="history-row" href={`/dashboard/history/${job.id}`} key={job.id}>
            <span className="activity-symbol"><AppIcon name="sparkles" /></span>
            <div className="min-w-0"><h2 className="truncate font-black">{job.output_title ?? request?.topic ?? "درخواست محتوا"}</h2><p className="mt-2 text-sm text-muted"><span dir="ltr">{request?.text_provider_slug} · {request?.text_model}</span><span className="mx-2">·</span>{new Intl.DateTimeFormat("fa-IR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(job.created_at))}</p></div>
            <div className="history-progress"><div className="flex items-center justify-between gap-3"><span className={`job-status status-${job.status}`}>{statusLabel[job.status]}</span><b>{job.progress}٪</b></div><div><i style={{ width: `${job.progress}%` }} /></div></div>
            <AppIcon className="h-4 w-4 text-muted" name="arrow" />
          </Link>;
        })}</div> : <div className="empty-state"><span><AppIcon name="history" /></span><h3>هنوز اجرایی ثبت نشده است</h3><p>موضوع نخستین مقاله را مشخص کنید تا مسیر تولید و خروجی آن در این صفحه نمایش داده شود.</p><Link href="/dashboard/content/new">ساخت نخستین مقاله</Link></div>}
      </section>
    </div>
  );
}
