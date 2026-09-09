"use client";

import { useActionState } from "react";
import { saveSystemApiKeyAction, type SystemApiKeyState } from "./system-api-key-actions";

const initialState: SystemApiKeyState = { status: "idle", message: "" };

export function SystemApiKeyForm({ providers }: { providers: Array<{ id: string; name: string }> }) {
  const [state, action, pending] = useActionState(saveSystemApiKeyAction, initialState);
  return (
    <form action={action} className="admin-card p-6">
      <div className="flex items-start gap-4">
        <span className="admin-icon bg-violet-500/15 text-violet-300" aria-hidden="true">⌁</span>
        <div>
          <p className="text-xs font-black tracking-wider text-violet-300">مرحلهٔ اول راه‌اندازی</p>
          <h2 className="mt-1 text-xl font-black text-white">کلید سراسری هوش مصنوعی</h2>
          <p className="mt-2 text-sm leading-6 text-slate-400">یک کلید معتبر وارد کنید؛ پس از آزمایش، ارائه‌دهنده روشن و اتصال برای تمام کاربران آماده می‌شود.</p>
        </div>
      </div>
      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <label className="admin-label">ارائه‌دهنده<select className="admin-field" name="providerId" required>{providers.map((provider) => <option key={provider.id} value={provider.id}>{provider.name}</option>)}</select></label>
        <label className="admin-label">نام اتصال<input className="admin-field" defaultValue="اتصال اصلی سامانه" name="label" required /></label>
      </div>
      <label className="admin-label mt-4">کلید رابط برنامه‌نویسی<input autoComplete="off" className="admin-field font-mono" dir="ltr" name="apiKey" placeholder="کلید محرمانهٔ ارائه‌دهنده را اینجا وارد کنید" required spellCheck={false} type="password" /></label>
      {state.message ? <p className={`mt-4 rounded-xl px-4 py-3 text-sm ${state.status === "success" ? "bg-emerald-400/10 text-emerald-300" : "bg-rose-400/10 text-rose-300"}`}>{state.message}</p> : null}
      <button className="admin-primary mt-5 w-full sm:w-auto" disabled={pending || providers.length === 0} type="submit">{pending ? "در حال آزمایش اتصال…" : "آزمایش، رمزنگاری و فعال‌سازی"}</button>
    </form>
  );
}
