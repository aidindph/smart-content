"use client";

import { useActionState, useMemo, useState } from "react";
import { AppIcon } from "@/components/app-icon";
import { createContentAction, type CreateContentState } from "./actions";

type ModelOption = { key: string; name: string; kind: "text" | "image" | "multimodal" };
type KeyOption = { id: string; label: string; key_hint: string; providerName: string; providerSlug: string; source: "user" | "system"; models: ModelOption[] };
const initialState: CreateContentState = { status: "idle", message: "" };
const densityOptions = [.5, .75, 1, 1.25, 1.5, 2, 2.5, 3];

function DensitySelect({ name, defaultValue }: { name: string; defaultValue: number }) {
  return <select aria-label="درصد هدف" className="field keyword-density" defaultValue={defaultValue} name={name}>{densityOptions.map((value) => <option key={value} value={value}>{new Intl.NumberFormat("fa-IR", { maximumFractionDigits: 2 }).format(value)}٪</option>)}</select>;
}

export function ContentRequestForm({ idempotencyKey, keys, initialTopic = "", initialKeywords = "" }: { idempotencyKey: string; keys: KeyOption[]; initialTopic?: string; initialKeywords?: string }) {
  const [state, action, pending] = useActionState(createContentAction, initialState);
  const [textConnectionId, setTextConnectionId] = useState(keys[0]?.id ?? "");
  const [imageConnectionId, setImageConnectionId] = useState("");
  const [generateImages, setGenerateImages] = useState(false);
  const textConnection = keys.find((key) => key.id === textConnectionId) ?? keys[0];
  const textModels = textConnection?.models.filter((model) => model.kind !== "image") ?? [];
  const imageKeys = useMemo(() => keys.filter((key) => key.models.some((model) => model.kind !== "text")), [keys]);
  const imageConnection = imageKeys.find((key) => key.id === imageConnectionId);
  const imageModels = imageConnection?.models.filter((model) => model.kind !== "text") ?? [];
  const seededKeywords = initialKeywords.split(/[،,]/).map((item) => item.trim()).filter(Boolean);

  return <form action={action} className="mt-8 grid gap-6">
    <input name="idempotencyKey" type="hidden" value={idempotencyKey} />
    <div className="form-progress"><span className="is-active"><b>۱</b>راهبرد محتوا</span><i /><span><b>۲</b>سئو و ساختار</span><i /><span><b>۳</b>مدل و تصویر</span></div>

    <section className="form-card">
      <div className="form-card-title"><span className="bg-violet-100 text-violet-700"><AppIcon name="sparkles" /></span><div><small>مرحلهٔ ۱</small><h2>راهبرد و هدف مقاله</h2><p>نیاز واقعی خواننده و جزئیات تخصصی محتوا را مشخص کنید.</p></div></div>
      <div className="mt-5 grid gap-5 md:grid-cols-2">
        <label className="grid gap-2 text-sm font-bold md:col-span-2">موضوع مقاله<input className="field" defaultValue={initialTopic} maxLength={300} name="topic" placeholder="مثلاً راهنمای انتخاب نرم‌افزار مدیریت پروژه" required />{state.fieldErrors?.topic?.map((error) => <span className="text-xs text-danger" key={error}>{error}</span>)}</label>
        <label className="grid gap-2 text-sm font-bold">مخاطب هدف<input className="field" maxLength={200} name="audience" placeholder="مدیران کسب‌وکارهای کوچک" required /></label>
        <label className="grid gap-2 text-sm font-bold">هدف جست‌وجو<select className="field" defaultValue="informational" name="searchIntent"><option value="informational">کسب اطلاعات و یادگیری</option><option value="commercial">بررسی پیش از خرید</option><option value="transactional">خرید یا اقدام</option><option value="navigational">یافتن برند یا صفحه</option></select></label>
        <label className="grid gap-2 text-sm font-bold">نوع محتوا<select className="field" defaultValue="guide" name="contentType"><option value="guide">راهنمای جامع</option><option value="tutorial">آموزش گام‌به‌گام</option><option value="list">فهرست نکته‌ها</option><option value="comparison">مقایسه</option><option value="review">بررسی تخصصی</option><option value="pillar">مقالهٔ ستون اصلی</option></select></label>
        <label className="grid gap-2 text-sm font-bold">لحن<select className="field" defaultValue="professional" name="tone"><option value="professional">حرفه‌ای و دقیق</option><option value="friendly">صمیمی و روان</option><option value="persuasive">اقناعی</option><option value="educational">آموزشی</option><option value="creative">خلاقانه</option></select></label>
        <label className="grid gap-2 text-sm font-bold">دیدگاه نوشتار<select className="field" defaultValue="second" name="pointOfView"><option value="second">خطاب مستقیم به خواننده</option><option value="first_plural">اول شخص جمع «ما»</option><option value="neutral">بی‌طرف و دانشنامه‌ای</option></select></label>
        <label className="grid gap-2 text-sm font-bold">تعداد واژهٔ هدف<input className="field" defaultValue={1200} max={5000} min={400} name="targetWords" step={100} type="number" /></label>
        <label className="grid gap-2 text-sm font-bold">زبان<select className="field" defaultValue="fa" name="language"><option value="fa">فارسی</option><option value="en">انگلیسی</option><option value="ar">عربی</option></select></label>
        <label className="grid gap-2 text-sm font-bold md:col-span-2">شرح تخصصی و داده‌های ضروری<textarea className="field min-h-28" name="contentBrief" placeholder="اطلاعات محصول، تجربهٔ عملی، آمار معتبر، محدودیت‌ها و نکاتی که باید در متن بیاید" /></label>
      </div>
    </section>

    <section className="form-card">
      <div className="form-card-title"><span className="bg-emerald-100 text-emerald-700"><AppIcon name="chart" /></span><div><small>مرحلهٔ ۲</small><h2>کلیدواژه‌ها و تنظیمات سئو</h2><p>مقدار واقعی مصرف هر عبارت پس از تولید در گزارش سئو نمایش داده می‌شود.</p></div></div>
      <div className="seo-tip"><AppIcon name="shield" /><p><strong>پیشنهاد اصولی:</strong> برای عبارت اصلی ۰٫۷۵ تا ۱٫۵ درصد و برای عبارت‌های فرعی ۰٫۵ تا ۱ درصد انتخاب کنید. متن طبیعی بر تکرار اجباری اولویت دارد.</p></div>
      <div className="mt-5 grid gap-3">
        <label className="keyword-row"><span>کلیدواژهٔ اصلی</span><input className="field" defaultValue={seededKeywords[0] ?? ""} name="primaryKeyword" placeholder="عبارت اصلی" /><DensitySelect defaultValue={1} name="primaryDensity" /></label>
        <label className="keyword-row"><span>کلیدواژهٔ فرعی اول</span><input className="field" defaultValue={seededKeywords[1] ?? ""} name="secondaryKeyword1" placeholder="عبارت مرتبط اول" /><DensitySelect defaultValue={.75} name="secondaryDensity1" /></label>
        <label className="keyword-row"><span>کلیدواژهٔ فرعی دوم</span><input className="field" defaultValue={seededKeywords[2] ?? ""} name="secondaryKeyword2" placeholder="عبارت مرتبط دوم" /><DensitySelect defaultValue={.75} name="secondaryDensity2" /></label>
      </div>
      <div className="mt-5 grid gap-5 md:grid-cols-2">
        <label className="grid gap-2 text-sm font-bold">عنوان‌های الزامی<textarea className="field min-h-24" name="requiredHeadings" placeholder={'هر عنوان در یک خط\nمثلاً مزایا و معایب\nراهنمای انتخاب'} /></label>
        <label className="grid gap-2 text-sm font-bold">پیوندهای داخلی پیشنهادی<textarea className="field min-h-24" dir="ltr" name="internalLinks" placeholder={'https://example.com/service\nhttps://example.com/about'} /></label>
        <label className="grid gap-2 text-sm font-bold">فراخوان اقدام<input className="field" name="callToAction" placeholder="مثلاً برای دریافت مشاوره تماس بگیرید" /></label>
        <label className="grid gap-2 text-sm font-bold">تعداد پرسش متداول<select className="field" defaultValue={3} name="faqCount">{[0,2,3,4,5,6,8].map((value) => <option key={value} value={value}>{new Intl.NumberFormat("fa-IR").format(value)}</option>)}</select></label>
        <label className="grid gap-2 text-sm font-bold md:col-span-2">عبارت‌های ممنوع<input className="field" name="forbiddenTerms" placeholder="عبارت‌ها را با ویرگول جدا کنید" /></label>
      </div>
    </section>

    <section className="form-card">
      <div className="form-card-title"><span className="bg-cyan-100 text-cyan-700"><AppIcon name="zap" /></span><div><small>مرحلهٔ ۳</small><h2>مدل هوش مصنوعی نگارش</h2><p>این مدل متن مقاله را می‌نویسد؛ اتصال سراسری را مدیر سامانه فراهم می‌کند.</p></div></div>
      <div className="mt-5 grid gap-5 md:grid-cols-2">
        <label className="grid gap-2 text-sm font-bold">اتصال هوش مصنوعی<select className="field" name="textConnectionId" onChange={(event) => setTextConnectionId(event.target.value)} value={textConnectionId} required>{keys.map((key) => <option key={key.id} value={key.id}>{key.providerName} · {key.source === "system" ? "سراسری سامانه" : key.label} · {key.key_hint}</option>)}</select></label>
        <label className="grid gap-2 text-sm font-bold">مدل تولید متن<select className="field" key={textConnectionId} name="textModel" required>{textModels.map((model) => <option key={model.key} value={model.key}>{model.name}</option>)}</select></label>
      </div>
      {textConnection?.source === "system" ? <p className="connection-note"><AppIcon className="h-4 w-4" name="shield" />این اتصال توسط مدیر سامانه تأمین شده و نیازی به کلید شخصی ندارید.</p> : null}
    </section>

    <section className="form-card">
      <div className="form-card-title"><span className="bg-amber-100 text-amber-700"><AppIcon name="sparkles" /></span><div><small>تصاویر مقاله</small><h2>پیشنهاد تصویر یا ساخت خودکار</h2><p>عنوان و محل تصاویر همیشه پیشنهاد می‌شود؛ ساخت فایل تصویر اختیاری است.</p></div></div>
      <label className="image-toggle"><input checked={generateImages} name="generateImages" onChange={(event) => setGenerateImages(event.target.checked)} type="checkbox" /><span><strong>تصاویر را هم با هوش مصنوعی بساز</strong><small>{generateImages ? "مدل تصویر انتخاب و فایل‌ها تولید می‌شوند." : "فقط موضوع، محل و متن جایگزین تصاویر پیشنهاد می‌شود."}</small></span></label>
      <label className="mt-5 grid gap-2 text-sm font-bold">موضوع یا عنوان تصاویر پیشنهادی<textarea className="field min-h-24" name="imageTopics" placeholder={'هر موضوع در یک خط\nمثلاً نمای کلی فرایند تولید محتوا\nنمودار مراحل بررسی سئو'} /></label>
      <div className={`mt-5 grid gap-5 md:grid-cols-3 ${generateImages ? "" : "opacity-45"}`}>
        <label className="grid gap-2 text-sm font-bold">تعداد تصویر<select className="field" defaultValue={2} disabled={!generateImages} name="imageCount">{[1,2,3,4].map((value) => <option key={value} value={value}>{new Intl.NumberFormat("fa-IR").format(value)}</option>)}</select></label>
        <label className="grid gap-2 text-sm font-bold">اتصال تصویر<select className="field" disabled={!generateImages} name="imageConnectionId" onChange={(event) => setImageConnectionId(event.target.value)} value={imageConnectionId}><option value="">انتخاب اتصال</option>{imageKeys.map((key) => <option key={key.id} value={key.id}>{key.providerName} · {key.source === "system" ? "سراسری سامانه" : key.label}</option>)}</select></label>
        <label className="grid gap-2 text-sm font-bold">مدل تصویر<select className="field" disabled={!generateImages || !imageConnection} key={imageConnectionId} name="imageModel"><option value="">انتخاب مدل</option>{imageModels.map((model) => <option key={model.key} value={model.key}>{model.name}</option>)}</select></label>
      </div>
    </section>

    {state.message ? <p aria-live="polite" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-danger">{state.message}</p> : null}
    <div className="submit-bar"><div><strong>خروجی آمادهٔ انتشار</strong><small>مقاله، کد اچ‌تی‌ام‌ال، گزارش سئو و پیشنهاد تصاویر یکجا ساخته می‌شوند.</small></div><button className="primary-button min-w-52" disabled={pending || !textModels.length} type="submit">{pending ? "در حال ثبت…" : "ساخت مقالهٔ سئو شده"}<AppIcon className="h-5 w-5" name="sparkles" /></button></div>
  </form>;
}
