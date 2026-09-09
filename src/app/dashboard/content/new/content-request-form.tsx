"use client";

import { useActionState, useMemo, useState } from "react";
import { AppIcon } from "@/components/app-icon";
import { createContentAction, type CreateContentState } from "./actions";

type ModelOption = { key: string; name: string; kind: "text" | "image" | "multimodal" };
type KeyOption = { id: string; label: string; key_hint: string; providerName: string; providerSlug: string; source: "user" | "system"; models: ModelOption[] };
const initialState: CreateContentState = { status: "idle", message: "" };

export function ContentRequestForm({ idempotencyKey, keys, initialTopic = "", initialKeywords = "" }: { idempotencyKey: string; keys: KeyOption[]; initialTopic?: string; initialKeywords?: string }) {
  const [state, action, pending] = useActionState(createContentAction, initialState);
  const [textConnectionId, setTextConnectionId] = useState(keys[0]?.id ?? "");
  const [imageConnectionId, setImageConnectionId] = useState("");
  const textConnection = keys.find((key) => key.id === textConnectionId) ?? keys[0];
  const textModels = textConnection?.models.filter((model) => model.kind !== "image") ?? [];
  const imageKeys = useMemo(() => keys.filter((key) => key.models.some((model) => model.kind !== "text")), [keys]);
  const imageConnection = imageKeys.find((key) => key.id === imageConnectionId);
  const imageModels = imageConnection?.models.filter((model) => model.kind !== "text") ?? [];

  return (
    <form action={action} className="mt-8 grid gap-6">
      <input name="idempotencyKey" type="hidden" value={idempotencyKey} />
      <div className="form-progress"><span className="is-active"><b>۱</b>موضوع</span><i /><span><b>۲</b>موتور متن</span><i /><span><b>۳</b>تصویر و اجرا</span></div>

      <section className="form-card">
        <div className="form-card-title"><span className="bg-violet-100 text-violet-700"><AppIcon name="sparkles" /></span><div><small>مرحلهٔ ۱</small><h2>دربارهٔ چه چیزی بنویسیم؟</h2><p>هرچه موضوع و مخاطب دقیق‌تر باشند، خروجی بهتر خواهد بود.</p></div></div>
        <div className="mt-5 grid gap-5 md:grid-cols-2">
          <label className="grid gap-2 text-sm font-bold md:col-span-2">موضوع مقاله<input className="field" defaultValue={initialTopic} maxLength={300} name="topic" placeholder="مثلاً راهنمای انتخاب نرم‌افزار مدیریت پروژه" required />{state.fieldErrors?.topic?.map((error) => <span className="text-xs text-danger" key={error}>{error}</span>)}</label>
          <label className="grid gap-2 text-sm font-bold">مخاطب هدف<input className="field" maxLength={200} name="audience" placeholder="مدیران کسب‌وکارهای کوچک" required />{state.fieldErrors?.audience?.map((error) => <span className="text-xs text-danger" key={error}>{error}</span>)}</label>
          <label className="grid gap-2 text-sm font-bold">کلیدواژه‌ها<input className="field" defaultValue={initialKeywords} name="keywords" placeholder="مدیریت پروژه، بهره‌وری، تیم" /><span className="text-xs font-normal text-muted">با ویرگول جدا کنید.</span></label>
          <label className="grid gap-2 text-sm font-bold">زبان<select className="field" defaultValue="fa" name="language"><option value="fa">فارسی</option><option value="en">انگلیسی</option><option value="ar">عربی</option></select></label>
          <label className="grid gap-2 text-sm font-bold">لحن<select className="field" defaultValue="professional" name="tone"><option value="professional">حرفه‌ای</option><option value="friendly">صمیمی</option><option value="persuasive">اقناعی</option><option value="educational">آموزشی</option><option value="creative">خلاقانه</option></select></label>
          <label className="grid gap-2 text-sm font-bold">تعداد واژهٔ هدف<input className="field" defaultValue={1200} max={5000} min={400} name="targetWords" step={100} type="number" />{state.fieldErrors?.targetWords?.map((error) => <span className="text-xs text-danger" key={error}>{error}</span>)}</label>
        </div>
      </section>

      <section className="form-card">
        <div className="form-card-title"><span className="bg-cyan-100 text-cyan-700"><AppIcon name="zap" /></span><div><small>مرحلهٔ ۲</small><h2>موتور نگارش را انتخاب کنید</h2><p>اتصال سراسری را مدیر فراهم می‌کند؛ کلید شخصی فقط برای حساب شماست.</p></div></div>
        <div className="mt-5 grid gap-5 md:grid-cols-2">
          <label className="grid gap-2 text-sm font-bold">اتصال هوش مصنوعی<select className="field" name="textConnectionId" onChange={(event) => setTextConnectionId(event.target.value)} value={textConnectionId} required>{keys.map((key) => <option key={key.id} value={key.id}>{key.providerName} · {key.source === "system" ? "سراسری سامانه" : key.label} · {key.key_hint}</option>)}</select>{state.fieldErrors?.textConnectionId?.map((error) => <span className="text-xs text-danger" key={error}>{error}</span>)}</label>
          <label className="grid gap-2 text-sm font-bold">مدل نگارش<select className="field" key={textConnectionId} name="textModel" required>{textModels.map((model) => <option key={model.key} value={model.key}>{model.name}</option>)}</select>{state.fieldErrors?.textModel?.map((error) => <span className="text-xs text-danger" key={error}>{error}</span>)}</label>
        </div>
        {textConnection?.source === "system" ? <p className="connection-note"><AppIcon className="h-4 w-4" name="shield" />این اتصال توسط مدیر سامانه تأمین شده و نیازی به کلید شخصی ندارید.</p> : null}
      </section>

      <section className="form-card">
        <div className="form-card-title"><span className="bg-amber-100 text-amber-700"><AppIcon name="chart" /></span><div><small>مرحلهٔ ۳</small><h2>تصویر و اجرای درخواست</h2><p>ساخت تصویر اختیاری است؛ صفر یعنی خروجی فقط متنی باشد.</p></div></div>
        <div className="mt-5 grid gap-5 md:grid-cols-3">
          <label className="grid gap-2 text-sm font-bold">تعداد تصویر<input className="field" defaultValue={0} max={4} min={0} name="imageCount" type="number" /></label>
          <label className="grid gap-2 text-sm font-bold">اتصال تصویر<select className="field" name="imageConnectionId" onChange={(event) => setImageConnectionId(event.target.value)} value={imageConnectionId}><option value="">بدون تصویر</option>{imageKeys.map((key) => <option key={key.id} value={key.id}>{key.providerName} · {key.source === "system" ? "سراسری سامانه" : key.label}</option>)}</select></label>
          <label className="grid gap-2 text-sm font-bold">مدل تصویر<select className="field" disabled={!imageConnection} key={imageConnectionId} name="imageModel"><option value="">انتخاب مدل</option>{imageModels.map((model) => <option key={model.key} value={model.key}>{model.name}</option>)}</select>{state.fieldErrors?.imageModel?.map((error) => <span className="text-xs text-danger" key={error}>{error}</span>)}</label>
        </div>
      </section>

      {state.message ? <p aria-live="polite" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-danger dark:bg-red-950/30">{state.message}</p> : null}
      <div className="submit-bar"><div><strong>همه‌چیز آماده است؟</strong><small>پس از ثبت، پیشرفت ساخت را زنده می‌بینید.</small></div><button className="primary-button min-w-52" disabled={pending || keys.length === 0 || textModels.length === 0} type="submit">{pending ? "در حال ثبت…" : "شروع تولید محتوا"}<AppIcon className="h-5 w-5" name="sparkles" /></button></div>
    </form>
  );
}
