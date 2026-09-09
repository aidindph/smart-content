"use client";

import Link from "next/link";
import { useActionState } from "react";
import { signupAction, type SignupState } from "./actions";

const initialState: SignupState = { message: null, success: false };

export function SignupForm() {
  const [state, formAction, pending] = useActionState(signupAction, initialState);

  return (
    <form action={formAction} className="mt-7 space-y-4">
      <div>
        <label className="mb-2 block text-sm font-bold" htmlFor="displayName">نام نمایشی</label>
        <input className="field" id="displayName" name="displayName" autoComplete="name" required />
      </div>
      <div>
        <label className="mb-2 block text-sm font-bold" htmlFor="email">ایمیل</label>
        <input className="field" id="email" name="email" type="email" autoComplete="email" dir="ltr" required />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-2 block text-sm font-bold" htmlFor="password">رمز عبور</label>
          <input className="field" id="password" name="password" type="password" autoComplete="new-password" minLength={8} dir="ltr" required />
        </div>
        <div>
          <label className="mb-2 block text-sm font-bold" htmlFor="passwordConfirmation">تکرار رمز</label>
          <input className="field" id="passwordConfirmation" name="passwordConfirmation" type="password" autoComplete="new-password" minLength={8} dir="ltr" required />
        </div>
      </div>
      {state.message ? (
        <p className={`rounded-xl px-4 py-3 text-sm ${state.success ? "bg-brand-soft text-brand-strong" : "bg-red-50 text-danger dark:bg-red-950/20"}`} role="status">
          {state.message}
        </p>
      ) : null}
      {state.success ? (
        <Link className="secondary-button w-full" href="/login">بازگشت به ورود</Link>
      ) : (
        <button className="primary-button w-full" type="submit" disabled={pending}>{pending ? "در حال ساخت…" : "ساخت حساب"}</button>
      )}
    </form>
  );
}
