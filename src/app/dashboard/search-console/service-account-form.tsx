"use client";

import { useActionState, useState } from "react";
import { saveServiceAccountAction, type SearchConsoleConnectionState } from "./actions";

const initialState: SearchConsoleConnectionState = { status: "idle", message: "" };

export function ServiceAccountForm() {
  const [state, action, pending] = useActionState(saveServiceAccountAction, initialState);
  const [json, setJson] = useState("");
  return <form action={action} className="mt-5 grid gap-4">
    <label className="gsc-file-drop">انتخاب فایل جیسون<input accept="application/json,.json" onChange={async (event) => { const file = event.target.files?.[0]; if (file) setJson(await file.text()); }} type="file" /></label>
    <label className="grid gap-2 text-sm font-bold">یا متن جیسون را وارد کنید<textarea className="field min-h-40 font-mono text-xs" dir="ltr" name="serviceAccountJson" onChange={(event) => setJson(event.target.value)} placeholder={'{\n  "type": "service_account",\n  "client_email": "..."\n}'} required value={json} /></label>
    <p className="text-xs leading-6 text-muted">پس از ثبت، ایمیل حساب خدماتی را در سرچ کنسول با دسترسی مشاهده اضافه کنید. اعتبارنامه با رمزنگاری سمت سرور نگهداری می‌شود.</p>
    {state.message ? <p className="rounded-xl bg-red-50 p-3 text-sm text-danger">{state.message}</p> : null}
    <button className="primary-button justify-self-start" disabled={pending || !json} type="submit">{pending ? "در حال بررسی اتصال…" : "بررسی و اتصال سرچ کنسول"}</button>
  </form>;
}
