"use client";

import { useEffect, useMemo, useState } from "react";

type JobStatus = "queued" | "running" | "completed" | "failed" | "cancelled";
type StepStatus = "pending" | "running" | "completed" | "failed" | "cancelled" | string;
type StageState = "done" | "active" | "pending" | "failed";

type Step = { id: string; kind: "article" | "hero_image" | "inline_image"; position: number; status: StepStatus; error_message: string | null };

type Props = {
  job: { status: JobStatus; progress: number; current_step: string | null; attempt: number; max_attempts: number; created_at: string };
  steps: Step[];
  targetWords: number;
  imageCount: number;
};

function durationLabel(milliseconds: number) {
  const seconds = Math.max(0, Math.floor(milliseconds / 1000));
  if (seconds < 60) return "کمتر از یک دقیقه";
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return rest ? `${new Intl.NumberFormat("fa-IR").format(minutes)} دقیقه و ${new Intl.NumberFormat("fa-IR").format(rest)} ثانیه` : `${new Intl.NumberFormat("fa-IR").format(minutes)} دقیقه`;
}

function stageState(step: Step | undefined, fallback: StageState): StageState {
  if (!step) return fallback;
  if (step.status === "completed") return "done";
  if (step.status === "running") return "active";
  if (step.status === "failed") return "failed";
  return fallback;
}

export function GenerationProgress({ job, steps, targetWords, imageCount }: Props) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1_000);
    return () => window.clearInterval(timer);
  }, []);

  const article = steps.find((step) => step.kind === "article");
  const images = steps.filter((step) => step.kind !== "article");
  const imageDone = images.filter((step) => step.status === "completed").length;
  const articleState = stageState(article, job.status === "queued" ? "pending" : "active");
  const articleDone = articleState === "done";
  const seoState: StageState = job.status === "completed"
    ? "done"
    : articleDone ? "active" : "pending";
  const imageState: StageState = imageCount === 0
    ? "done"
    : images.some((step) => step.status === "failed") ? "failed"
      : imageDone === images.length && images.length > 0 ? "done"
        : images.some((step) => step.status === "running") || (articleDone && job.status === "running") ? "active" : "pending";
  const stages = [
    { key: "prepare", title: "آماده‌سازی درخواست", description: job.status === "queued" ? "در صف امن پردازش قرار گرفته است." : "تنظیمات، کلیدها و مدل انتخابی بررسی شد.", state: job.status === "queued" ? "active" as StageState : "done" as StageState },
    { key: "article", title: "نگارش مقاله و ساختار سئو", description: `هدف مقاله: ${new Intl.NumberFormat("fa-IR").format(targetWords)} واژه.`, state: articleState },
    { key: "seo", title: "تحلیل سئو و ساخت کد انتشار", description: "چگالی کلیدواژه‌ها، عنوان‌ها و کد اچ‌تی‌ام‌ال کنترل می‌شود.", state: seoState },
    ...(imageCount ? [{ key: "images", title: "ساخت تصاویر", description: imageDone ? `${new Intl.NumberFormat("fa-IR").format(imageDone)} از ${new Intl.NumberFormat("fa-IR").format(imageCount)} تصویر آماده شد.` : `${new Intl.NumberFormat("fa-IR").format(imageCount)} تصویر در برنامهٔ این اجراست.`, state: imageState }] : []),
    { key: "deliver", title: "تحویل خروجی", description: "مقاله، گزارش سئو و کد آمادهٔ انتشار در همین صفحه نمایش داده می‌شود.", state: job.status === "completed" ? "done" as StageState : "pending" as StageState },
  ];
  const activeIndex = Math.max(0, stages.findIndex((stage) => stage.state === "active"));
  const shownProgress = job.status === "queued" ? Math.max(4, job.progress) : Math.max(8, job.progress);
  const elapsed = useMemo(() => durationLabel(now - new Date(job.created_at).getTime()), [job.created_at, now]);

  return (
    <section aria-live="polite" className="generation-progress-card">
      <div className="generation-progress-top">
        <div>
          <span className="generation-live"><i /> ساخت مقاله در حال انجام است</span>
          <h2>{job.current_step ?? "آماده‌سازی درخواست"}</h2>
          <p>مرحلهٔ {new Intl.NumberFormat("fa-IR").format(activeIndex + 1)} از {new Intl.NumberFormat("fa-IR").format(stages.length)} · زمان سپری‌شده: {elapsed}</p>
        </div>
        <div className="generation-percent"><b>{new Intl.NumberFormat("fa-IR").format(shownProgress)}٪</b><span>پیشرفت ثبت‌شده</span></div>
      </div>

      <div aria-label={`پیشرفت ${shownProgress} درصد`} aria-valuemax={100} aria-valuemin={0} aria-valuenow={shownProgress} className="generation-progress-track" role="progressbar"><i style={{ width: `${shownProgress}%` }} /></div>
      <p className="generation-progress-note">صفحه هر چند ثانیه به‌روزرسانی می‌شود. بستن آن فرایند ساخت را متوقف نمی‌کند.</p>

      <ol className="generation-stages">
        {stages.map((stage, index) => <li className={`is-${stage.state}`} key={stage.key}>
          <span>{stage.state === "done" ? "✓" : stage.state === "failed" ? "!" : new Intl.NumberFormat("fa-IR").format(index + 1)}</span>
          <div><strong>{stage.title}</strong><small>{stage.description}</small></div>
          <em>{stage.state === "done" ? "انجام شد" : stage.state === "active" ? "در حال انجام" : stage.state === "failed" ? "متوقف شد" : "در انتظار"}</em>
        </li>)}
      </ol>

      <div className="generation-progress-meta"><span>تلاش {new Intl.NumberFormat("fa-IR").format(job.attempt)} از {new Intl.NumberFormat("fa-IR").format(job.max_attempts)}</span><span>{imageCount ? "خروجی مقاله و تصویر" : "خروجی مقاله بدون تصویر"}</span></div>
    </section>
  );
}