"use client";

import { useActionState } from "react";
import { createInvitationAction, type InvitationState } from "./actions";

const initialState: InvitationState = { status: "idle", message: "" };

export function InvitationForm() {
  const [state, action, pending] = useActionState(createInvitationAction, initialState);
  return (
    <form action={action} className="mt-5 grid gap-4">
      <label className="grid gap-2 text-sm font-bold">ایمیل مشتری<input className="field" dir="ltr" name="email" required type="email" /></label>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="grid gap-2 text-sm font-bold">نقش<select className="field" defaultValue="customer" name="role"><option value="customer">مشتری</option><option value="system_admin">مدیر سامانه</option></select></label>
        <label className="grid gap-2 text-sm font-bold">اعتبار به روز<input className="field" defaultValue={7} max={30} min={1} name="days" type="number" /></label>
      </div>
      {state.message ? <p className={`rounded-xl px-4 py-3 text-sm ${state.status === "success" ? "bg-brand-soft text-brand-strong" : "bg-red-50 text-danger dark:bg-red-950/30"}`}>{state.message}</p> : null}
      {state.link ? <div className="rounded-xl border border-line bg-surface-subtle p-4"><p className="text-xs font-bold text-muted">این پیوند فقط همین یک‌بار نمایش داده می‌شود:</p><a className="mt-2 block break-all text-sm font-bold text-brand" dir="ltr" href={state.link}>{state.link}</a></div> : null}
      <button className="primary-button" disabled={pending} type="submit">{pending ? "در حال ساخت…" : "ساخت دعوت‌نامه"}</button>
    </form>
  );
}
