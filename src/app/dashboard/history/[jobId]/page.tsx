import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/guards";
import { CopyButton } from "@/components/copy-button";
import { createAdminClient } from "@/lib/supabase/admin";
import { cancelJobAction, rerunJobAction } from "../actions";
import { JobRunner } from "./job-runner";

export const metadata: Metadata = { title: "جزئیات اجرای محتوا" };

type SeoAnalysis = { score?: number; status?: "ready" | "review" | "needs_work"; wordCount?: number; headingCount?: number; keywords?: Array<{ keyword: string; density: number; actualDensity: number; count: number; withinTarget: boolean }> };
type ImageSuggestion = { title: string; placement: string; altText: string; aspectRatio: string };
type Job = { id: string; request_id: string; status: "queued" | "running" | "completed" | "failed" | "cancelled"; progress: number; current_step: string | null; attempt: number; max_attempts: number; cancel_requested: boolean; error_message: string | null; output_title: string | null; output_markdown: string | null; output_html: string | null; seo_analysis: SeoAnalysis; image_suggestions: ImageSuggestion[]; input_tokens: number; output_tokens: number; estimated_cost_usd: number | null; created_at: string; completed_at: string | null };
type ContentRequest = { topic: string; keywords: string[]; audience: string; tone: string; target_words: number; text_provider_slug: string; text_model: string; image_count: number };
type Step = { id: string; kind: "article" | "hero_image" | "inline_image"; position: number; status: string; provider_slug: string; model_key: string; error_message: string | null };
type Asset = { id: string; storage_path: string; alt_text: string; position: number };
const statusLabel = { queued: "در صف", running: "در حال اجرا", completed: "تکمیل‌شده", failed: "ناموفق", cancelled: "لغوشده" };
const stepLabel = { article: "نگارش مقاله", hero_image: "تصویر اصلی", inline_image: "تصویر درون متن" };

export default async function JobDetailsPage({ params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = await params;
  const { supabase } = await requireUser();
  const { data: job } = await supabase.from("generation_jobs").select("*").eq("id", jobId).single<Job>();
  if (!job) notFound();
  const [{ data: request }, { data: steps }, { data: assets }] = await Promise.all([
    supabase.from("content_requests").select("topic, keywords, audience, tone, target_words, text_provider_slug, text_model, image_count").eq("id", job.request_id).single<ContentRequest>(),
    supabase.from("generation_steps").select("id, kind, position, status, provider_slug, model_key, error_message").eq("job_id", job.id).order("position").returns<Step[]>(),
    supabase.from("content_assets").select("id, storage_path, alt_text, position").eq("job_id", job.id).order("position").returns<Asset[]>(),
  ]);
  if (!request) notFound();
  const admin = createAdminClient();
  const signedAssets = await Promise.all((assets ?? []).map(async (asset) => {
    const { data } = await admin.storage.from("content-assets").createSignedUrl(asset.storage_path, 3600);
    return { ...asset, url: data?.signedUrl };
  }));
  const active = job.status === "queued" || job.status === "running";

  return (
    <div className="mx-auto max-w-6xl">
      <JobRunner jobId={job.id} status={job.status} />
      <header className="flex flex-wrap items-start justify-between gap-5">
        <div><p className="text-sm font-bold text-brand">جزئیات اجرا</p><h1 className="mt-2 text-3xl font-black">{job.output_title ?? request.topic}</h1><p className="mt-3 text-sm text-muted">{new Intl.DateTimeFormat("fa-IR", { dateStyle: "long", timeStyle: "short" }).format(new Date(job.created_at))}</p></div>
        <div className="flex flex-wrap gap-2"><Link className="secondary-button" href="/dashboard/history">بازگشت</Link>{active ? <form action={cancelJobAction}><input name="jobId" type="hidden" value={job.id} /><button className="danger-button" disabled={job.cancel_requested} type="submit">{job.cancel_requested ? "لغو درخواست شد" : "لغو اجرا"}</button></form> : <form action={rerunJobAction}><input name="jobId" type="hidden" value={job.id} /><button className="primary-button" type="submit">اجرای دوباره</button></form>}</div>
      </header>

      <section className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <article className="panel p-5"><p className="text-sm text-muted">وضعیت</p><p className="mt-3 font-black">{statusLabel[job.status]}</p></article>
        <article className="panel p-5"><p className="text-sm text-muted">پیشرفت</p><p className="mt-3 text-2xl font-black">{job.progress}٪</p></article>
        <article className="panel p-5"><p className="text-sm text-muted">مصرف متن</p><p className="mt-3 font-black">{new Intl.NumberFormat("fa-IR").format(job.input_tokens + job.output_tokens)} توکن</p></article>
        <article className="panel p-5"><p className="text-sm text-muted">تلاش</p><p className="mt-3 font-black">{job.attempt} از {job.max_attempts}</p></article>
      </section>

      {active ? <section className="panel mt-6 p-6"><div className="flex items-center justify-between gap-4"><div><h2 className="font-black">{job.current_step ?? "آماده‌سازی"}</h2><p className="mt-2 text-sm text-muted">این صفحه خودکار تازه می‌شود؛ بستن صفحه رکورد اجرا را حذف نمی‌کند.</p></div><span className="h-4 w-4 animate-pulse rounded-full bg-brand" /></div><div className="mt-5 h-3 overflow-hidden rounded-full bg-line"><div className="h-full rounded-full bg-brand transition-all" style={{ width: `${job.progress}%` }} /></div></section> : null}
      {job.error_message ? <section className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-5 text-danger dark:border-red-900 dark:bg-red-950/30"><h2 className="font-black">علت توقف</h2><p className="mt-2 text-sm">{job.error_message}</p></section> : null}

      <section className="panel mt-6 p-6"><h2 className="text-xl font-black">تنظیمات ثابت این اجرا</h2><dl className="mt-5 grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-4"><div><dt className="text-muted">مخاطب</dt><dd className="mt-1 font-bold">{request.audience}</dd></div><div><dt className="text-muted">طول هدف</dt><dd className="mt-1 font-bold">{request.target_words} واژه</dd></div><div><dt className="text-muted">مدل متن</dt><dd className="mt-1 font-bold" dir="ltr">{request.text_provider_slug} · {request.text_model}</dd></div><div><dt className="text-muted">تصاویر</dt><dd className="mt-1 font-bold">{request.image_count}</dd></div></dl>{request.keywords.length ? <p className="mt-5 text-sm text-muted">کلیدواژه‌ها: {request.keywords.join("، ")}</p> : null}</section>

      <section className="panel mt-6 p-6"><h2 className="text-xl font-black">مراحل اجرا</h2><div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{(steps ?? []).map((step) => <article className="rounded-xl bg-surface-subtle p-4" key={step.id}><div className="flex items-center justify-between gap-3"><p className="font-bold">{stepLabel[step.kind]}{step.kind === "inline_image" ? ` ${step.position}` : ""}</p><span className="text-xs text-muted">{step.status}</span></div><p className="mt-2 text-xs text-muted" dir="ltr">{step.provider_slug} · {step.model_key}</p>{step.error_message ? <p className="mt-2 text-xs text-danger">{step.error_message}</p> : null}</article>)}</div></section>

      {signedAssets.length ? <section className="panel mt-6 p-6"><h2 className="text-xl font-black">تصاویر تولیدشده</h2><div className="mt-5 grid gap-4 md:grid-cols-2">{signedAssets.map((asset) => asset.url ? <figure className="overflow-hidden rounded-2xl border border-line" key={asset.id}><Image alt={asset.alt_text} className="aspect-video w-full object-cover" height={675} src={asset.url} unoptimized width={1200} /><figcaption className="p-3 text-sm text-muted">{asset.alt_text}</figcaption></figure> : null)}</div></section> : null}
      {job.status === "completed" ? <section className="seo-report mt-6"><div><span>وضعیت سئو</span><strong>{job.seo_analysis?.status === "ready" ? "آمادهٔ انتشار" : job.seo_analysis?.status === "review" ? "نیازمند بازبینی کوتاه" : "نیازمند بهبود"}</strong><small>امتیاز {new Intl.NumberFormat("fa-IR").format(job.seo_analysis?.score ?? 0)} از ۱۰۰</small></div><div className="seo-score"><i style={{ width: `${job.seo_analysis?.score ?? 0}%` }} /></div><dl><div><dt>تعداد واژه</dt><dd>{new Intl.NumberFormat("fa-IR").format(job.seo_analysis?.wordCount ?? 0)}</dd></div><div><dt>تعداد عنوان</dt><dd>{new Intl.NumberFormat("fa-IR").format(job.seo_analysis?.headingCount ?? 0)}</dd></div></dl></section> : null}
      {job.seo_analysis?.keywords?.length ? <section className="content-card mt-6 overflow-hidden"><div className="section-heading"><div><span>اندازه‌گیری واقعی</span><h2>پوشش کلیدواژه‌ها</h2></div></div><div className="keyword-results">{job.seo_analysis.keywords.map((item) => <div key={item.keyword}><strong>{item.keyword}</strong><span>هدف {item.density}٪</span><span>واقعی {item.actualDensity}٪</span><b className={item.withinTarget ? "ok" : "review"}>{item.withinTarget ? "مناسب" : "بازبینی"}</b></div>)}</div></section> : null}
      {job.image_suggestions?.length ? <section className="content-card mt-6 overflow-hidden"><div className="section-heading"><div><span>برای ساخت دستی یا خودکار</span><h2>عنوان‌های پیشنهادی تصاویر</h2></div><CopyButton label="کپی همهٔ عنوان‌ها" value={job.image_suggestions.map((item) => `${item.title} — ${item.placement} — متن جایگزین: ${item.altText}`).join("\n")} /></div><div className="image-suggestion-list">{job.image_suggestions.map((item) => <article key={`${item.title}-${item.placement}`}><span>{item.aspectRatio}</span><div><h3>{item.title}</h3><p>{item.placement} · متن جایگزین: {item.altText}</p></div></article>)}</div></section> : null}
      {job.output_html ? <section className="content-card mt-6 overflow-hidden"><div className="section-heading"><div><span>قابل استفاده در وردپرس و سامانه‌های مدیریت محتوا</span><h2>کد اچ‌تی‌ام‌ال آمادهٔ انتشار</h2></div><CopyButton label="کپی کد اچ‌تی‌ام‌ال" value={job.output_html} /></div><pre className="html-output" dir="ltr"><code>{job.output_html}</code></pre></section> : null}
      {job.output_markdown ? <section className="panel mt-6 p-6"><div className="flex flex-wrap items-center justify-between gap-4"><h2 className="text-xl font-black">متن نهایی</h2><CopyButton label="کپی متن" value={job.output_markdown} /></div><article className="mt-6 whitespace-pre-wrap leading-8">{job.output_markdown}</article></section> : null}
    </div>
  );
}
