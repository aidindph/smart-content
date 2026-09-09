import type { Metadata } from "next";
import Link from "next/link";
import { isRegistrationEnabled } from "@/lib/settings/registration";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "ورود" };

export default async function LoginPage() {
  const registrationEnabled = await isRegistrationEnabled();

  return (
    <main className="app-shell grid min-h-screen lg:grid-cols-[1.1fr_0.9fr]">
      <section className="relative hidden overflow-hidden bg-[#123d2d] p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="absolute -left-24 -top-24 h-80 w-80 rounded-full border border-white/10" />
        <div className="absolute -bottom-32 -right-20 h-96 w-96 rounded-full bg-emerald-300/10 blur-3xl" />
        <div className="relative">
          <div className="inline-flex items-center gap-3 rounded-full border border-white/15 bg-white/10 px-4 py-2 text-sm">
            <span className="h-2 w-2 rounded-full bg-emerald-300" />
            موتور هوشمند محتوا
          </div>
        </div>
        <div className="relative max-w-xl">
          <p className="mb-5 text-sm font-bold text-emerald-200">از ایده تا انتشار</p>
          <h1 className="text-5xl font-black leading-[1.35]">همهٔ مدل‌های هوش مصنوعی، در یک جریان تولید منظم</h1>
          <p className="mt-6 max-w-lg text-lg leading-9 text-emerald-50/75">
            مدل مناسب را انتخاب کنید، مقاله و تصویر بسازید و هزینه و تاریخچهٔ هر اجرا را در یک فضای کاری دنبال کنید.
          </p>
        </div>
        <p className="relative text-sm text-white/55">کلیدهای شما، انتخاب شما، محتوای شما</p>
      </section>

      <section className="flex items-center justify-center p-5 sm:p-10">
        <div className="w-full max-w-md">
          <div className="mb-8 lg:hidden">
            <span className="inline-flex items-center gap-2 font-black text-brand-strong">
              <span className="h-3 w-3 rounded-full bg-brand" />
              موتور هوشمند محتوا
            </span>
          </div>
          <div className="panel p-6 sm:p-9">
            <p className="text-sm font-bold text-brand">خوش آمدید</p>
            <h2 className="mt-2 text-3xl font-black">ورود به فضای کاری</h2>
            <p className="mt-3 leading-7 text-muted">برای مدیریت درخواست‌ها و اتصال‌های خود وارد شوید.</p>
            <LoginForm />
          </div>

          <div className="mt-5 rounded-2xl border border-line bg-surface/70 px-5 py-4 text-sm text-muted">
            {registrationEnabled ? (
              <p>
                هنوز حساب ندارید؟{" "}
                <Link className="font-bold text-brand-strong underline underline-offset-4" href="/signup">ساخت حساب</Link>
              </p>
            ) : (
              <p className="flex items-center gap-2">
                <span className="status-dot text-accent" />
                ثبت‌نام عمومی بسته است؛ برای دریافت دسترسی با مدیر سامانه تماس بگیرید.
              </p>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}
