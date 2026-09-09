"use client";

import { useActionState } from "react";
import { loginAction, type LoginState } from "./actions";

const initialState: LoginState = { message: null };

export function LoginForm() {
  const [state, formAction, pending] = useActionState(loginAction, initialState);

  return (
    <form action={formAction} className="mt-8 space-y-5">
      <div>
        <label className="mb-2 block text-sm font-bold" htmlFor="email">ایمیل</label>
        <input className="field" id="email" name="email" type="email" autoComplete="email" dir="ltr" required />
      </div>
      <div>
        <div className="mb-2 flex items-center justify-between gap-4">
          <label className="text-sm font-bold" htmlFor="password">رمز عبور</label>
          <span className="text-xs text-muted">بازیابی رمز به‌زودی</span>
        </div>
        <input className="field" id="password" name="password" type="password" autoComplete="current-password" minLength={8} dir="ltr" required />
      </div>
      {state.message ? (
        <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-danger dark:bg-red-950/20" role="alert">{state.message}</p>
      ) : null}
      <button className="primary-button w-full" type="submit" disabled={pending}>
        {pending ? "در حال بررسی…" : "ورود به داشبورد"}
      </button>
    </form>
  );
}
