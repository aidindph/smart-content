"use client";

import { useActionState } from "react";
import { createContentAction, type CreateContentState } from "./actions";

type KeyOption = { id: string; label: string; key_hint: string; providerName: string; providerSlug: string; supportsImage: boolean };
const initialState: CreateContentState = { status: "idle", message: "" };

const modelHints: Record<string, string[]> = {
  openai: ["gpt-5-mini", "gpt-5.4-mini", "gpt-image-1.5"],
  "google-gemini": ["gemini-2.5-flash", "gemini-3-flash-preview", "gemini-3.1-flash-image-preview"],
  openrouter: ["openai/gpt-5-mini", "google/gemini-2.5-flash"],
};

export function ContentRequestForm({ idempotencyKey, keys }: { idempotencyKey: string; keys: KeyOption[] }) {
  const [state, action, pending] = useActionState(createContentAction, initialState);
  const imageKeys = keys.filter((key) => key.supportsImage);
  const hints = [...new Set(keys.flatMap((key) => modelHints[key.providerSlug] ?? []))];

  return (
    <form action={action} className="mt-8 grid gap-6">
      <input name="idempotencyKey" type="hidden" value={idempotencyKey} />
      <section className="panel p-6">
        <h2 className="text-xl font-black">موضوع و مخاطب</h2>
        <div className="mt-5 grid gap-5 md:grid-cols-2">
          <label className="grid gap-2 text-sm font-bold md:col-span-2">موضوع مقاله<input className="field" maxLength={300} name="topic" placeholder="مثلاً راهنمای انتخاب نرم‌افزار مدیریت پروژه" required />{state.fieldErrors?.topic?.map((error) => <span className="text-xs text-danger" key={error}>{error}</span>)}</label>
          <label className="grid gap-2 text-sm font-bold">مخاطب هدف<input className="field" maxLength={200} name="audience" placeholder="مدیران کسب‌وکارهای کوچک" required />{state.fieldErrors?.audience?.map((error) => <span className="text-xs text-danger" key={error}>{error}</span>)}</label>
          <label className="grid gap-2 text-sm font-bold">کلیدواژه‌ها<input className="field" name="keywords" placeholder="مدیریت پروژه، بهره‌وری، تیم" /><span className="text-xs font-normal text-muted">با ویرگول جدا کنید.</span></label>
          <label className="grid gap-2 text-sm font-bold">زبان<select className="field" defaultValue="fa" name="language"><option value="fa">فارسی</option><option value="en">انگلیسی</option><option value="ar">عربی</option></select></label>
          <label className="grid gap-2 text-sm font-bold">لحن<select className="field" defaultValue="professional" name="tone"><option value="professional">حرفه‌ای</option><option value="friendly">صمیمی</option><option value="persuasive">اقناعی</option><option value="educational">آموزشی</option><option value="creative">خلاقانه</option></select></label>
          <label className="grid gap-2 text-sm font-bold">تعداد واژهٔ هدف<input className="field" defaultValue={1200} max={5000} min={400} name="targetWords" step={100} type="number" />{state.fieldErrors?.targetWords?.map((error) => <span className="text-xs text-danger" key={error}>{error}</span>)}</label>
        </div>
      </section>

      <section className="panel p-6">
        <h2 className="text-xl font-black">مدل تولید متن</h2>
        <div className="mt-5 grid gap-5 md:grid-cols-2">
          <label className="grid gap-2 text-sm font-bold">کلید اتصال<select className="field" name="textKeyId" required><option value="">انتخاب کنید</option>{keys.map((key) => <option key={key.id} value={key.id}>{key.providerName} · {key.label} · {key.key_hint}</option>)}</select>{state.fieldErrors?.textKeyId?.map((error) => <span className="text-xs text-danger" key={error}>{error}</span>)}</label>
          <label className="grid gap-2 text-sm font-bold">شناسهٔ مدل<input className="field" dir="ltr" list="model-hints" name="textModel" placeholder="gemini-2.5-flash" required />{state.fieldErrors?.textModel?.map((error) => <span className="text-xs text-danger" key={error}>{error}</span>)}</label>
        </div>
      </section>

      <section className="panel p-6">
        <h2 className="text-xl font-black">تصاویر مقاله</h2>
        <p className="mt-2 text-sm text-muted">صفر را انتخاب کنید تا مقاله فقط متنی ساخته شود.</p>
        <div className="mt-5 grid gap-5 md:grid-cols-3">
          <label className="grid gap-2 text-sm font-bold">تعداد تصویر<input className="field" defaultValue={0} max={4} min={0} name="imageCount" type="number" /></label>
          <label className="grid gap-2 text-sm font-bold">کلید تصویر<select className="field" name="imageKeyId"><option value="">بدون تصویر</option>{imageKeys.map((key) => <option key={key.id} value={key.id}>{key.providerName} · {key.label}</option>)}</select></label>
          <label className="grid gap-2 text-sm font-bold">مدل تصویر<input className="field" dir="ltr" list="model-hints" name="imageModel" placeholder="gpt-image-1.5" />{state.fieldErrors?.imageModel?.map((error) => <span className="text-xs text-danger" key={error}>{error}</span>)}</label>
        </div>
      </section>

      <datalist id="model-hints">{hints.map((model) => <option key={model} value={model} />)}</datalist>
      {state.message ? <p aria-live="polite" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-danger dark:bg-red-950/30">{state.message}</p> : null}
      <div><button className="primary-button min-w-48" disabled={pending || keys.length === 0} type="submit">{pending ? "در حال ثبت…" : "ساخت و شروع پردازش"}</button></div>
    </form>
  );
}
