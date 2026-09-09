"use client";

import Link from "next/link";
import { useActionState } from "react";
import { saveApiKeyAction, type SaveApiKeyState } from "./actions";

type ProviderOption = { id: string; name: string };
type EditableKey = { id: string; provider_id: string; label: string };
const initialState: SaveApiKeyState = { status: "idle", message: "" };

export function ApiKeyForm({ providers, editableKey }: { providers: ProviderOption[]; editableKey?: EditableKey }) {
  const [state, action, pending] = useActionState(saveApiKeyAction, initialState);

  return (
    <form action={action} className="panel p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-black">{editableKey ? "جایگزینی کلید" : "افزودن کلید"}</h2>
          <p className="mt-2 text-sm leading-6 text-muted">اتصال پیش از ذخیره آزمایش می‌شود. مقدار کامل کلید بعداً قابل مشاهده نیست.</p>
        </div>
        {editableKey ? <Link className="secondary-button text-sm" href="/dashboard/api-keys">انصراف</Link> : null}
      </div>

      <input name="keyId" type="hidden" value={editableKey?.id ?? ""} />
      <div className="mt-6 grid gap-5 md:grid-cols-2">
        <label className="grid gap-2 text-sm font-bold">
          ارائه‌دهنده
          <select className="field" defaultValue={editableKey?.provider_id ?? providers[0]?.id} disabled={Boolean(editableKey)} name={editableKey ? undefined : "providerId"} required>
            {providers.map((provider) => <option key={provider.id} value={provider.id}>{provider.name}</option>)}
          </select>
          {editableKey ? <input name="providerId" type="hidden" value={editableKey.provider_id} /> : null}
          {state.fieldErrors?.providerId?.map((error) => <span className="text-xs text-danger" key={error}>{error}</span>)}
        </label>

        <label className="grid gap-2 text-sm font-bold">
          نام دلخواه
          <input className="field" defaultValue={editableKey?.label ?? "کلید اصلی"} maxLength={80} name="label" required />
          {state.fieldErrors?.label?.map((error) => <span className="text-xs text-danger" key={error}>{error}</span>)}
        </label>
      </div>

      <label className="mt-5 grid gap-2 text-sm font-bold">
        کلید رابط برنامه‌نویسی
        <input autoComplete="off" className="field font-mono" dir="ltr" maxLength={4096} name="apiKey" placeholder="کلید را اینجا وارد کنید" required spellCheck={false} type="password" />
        {state.fieldErrors?.apiKey?.map((error) => <span className="text-xs text-danger" key={error}>{error}</span>)}
      </label>

      {state.message ? (
        <p aria-live="polite" className={`mt-5 rounded-xl px-4 py-3 text-sm ${state.status === "success" ? "bg-brand-soft text-brand-strong" : "bg-red-50 text-danger dark:bg-red-950/30"}`}>
          {state.message}
        </p>
      ) : null}

      <button className="primary-button mt-5" disabled={pending || providers.length === 0} type="submit">
        {pending ? "در حال آزمایش…" : editableKey ? "آزمایش و جایگزینی" : "آزمایش و ذخیرهٔ امن"}
      </button>
    </form>
  );
}
