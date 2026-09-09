"use client";

export default function DashboardError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <div className="mx-auto max-w-xl panel p-7 text-center"><p className="text-sm font-bold text-danger">خطای موقت</p><h1 className="mt-2 text-2xl font-black">نمایش این بخش کامل نشد</h1><p className="mt-3 text-sm leading-6 text-muted">اتصال یا دادهٔ ورودی را بررسی کنید و دوباره تلاش کنید.</p><button className="primary-button mt-5" onClick={reset} type="button">تلاش دوباره</button></div>;
}
