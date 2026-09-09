import type { Metadata } from "next";
import Link from "next/link";
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
      <header className="flex flex-wrap items-start justify-between gap-5">
        <div><p className="text-sm font-bold text-brand">خروجی‌ها و اجراها</p><h1 className="mt-2 text-3xl font-black">تاریخچهٔ تولید</h1><p className="mt-3 text-muted">هر اجرای دوباره جداگانه نگهداری می‌شود و وضعیت آن قابل پیگیری است.</p></div>
        <Link className="primary-button" href="/dashboard/content/new">درخواست جدید</Link>
      </header>
      <section className="panel mt-8 overflow-hidden">
        {(jobs ?? []).length ? <div className="divide-y divide-line">{(jobs ?? []).map((job) => {
          const request = requestById.get(job.request_id);
          return <Link className="grid gap-4 p-5 hover:bg-surface-subtle sm:grid-cols-[1fr_auto] sm:items-center" href={`/dashboard/history/${job.id}`} key={job.id}>
            <div><h2 className="font-black">{job.output_title ?? request?.topic ?? "درخواست محتوا"}</h2><p className="mt-2 text-sm text-muted"><span dir="ltr">{request?.text_provider_slug} · {request?.text_model}</span><span className="mx-2">·</span>{new Intl.DateTimeFormat("fa-IR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(job.created_at))}</p></div>
            <div className="min-w-36"><div className="flex items-center justify-between gap-3 text-xs font-bold"><span>{statusLabel[job.status]}</span><span>{job.progress}٪</span></div><div className="mt-2 h-2 overflow-hidden rounded-full bg-line"><div className="h-full rounded-full bg-brand" style={{ width: `${job.progress}%` }} /></div></div>
          </Link>;
        })}</div> : <div className="p-8 text-center"><p className="font-bold">هنوز اجرایی ثبت نشده است.</p><Link className="primary-button mt-5" href="/dashboard/content/new">ساخت نخستین مقاله</Link></div>}
      </section>
    </div>
  );
}
