import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/auth/guards";

export const metadata: Metadata = { title: "داشبورد" };

const cards = [
  ["درخواست‌های این ماه", "۰", "پس از نخستین تولید نمایش داده می‌شود"],
  ["هزینهٔ تخمینی", "$۰٫۰۰", "بر پایهٔ قیمت ثبت‌شدهٔ مدل‌ها"],
  ["محتوای تکمیل‌شده", "۰", "متن و تصویرهای آماده"],
] as const;

export default async function DashboardPage() {
  const { profile } = await requireUser();
  return (
    <div className="mx-auto max-w-6xl">
      <header className="flex flex-wrap items-end justify-between gap-5">
        <div>
          <p className="text-sm font-bold text-brand">فضای کاری شما</p>
          <h1 className="mt-2 text-3xl font-black">سلام {profile.display_name ?? "دوست عزیز"}</h1>
          <p className="mt-3 text-muted">از اینجا می‌توانید تولید بعدی را آغاز و وضعیت اجراها را دنبال کنید.</p>
        </div>
        <Link className="primary-button" href="/dashboard/content/new">درخواست محتوای جدید</Link>
      </header>
      <section className="mt-8 grid gap-4 md:grid-cols-3">
        {cards.map(([title, value, description]) => (
          <article className="panel p-5" key={title}>
            <p className="text-sm font-bold text-muted">{title}</p>
            <p className="mt-3 text-3xl font-black">{value}</p>
            <p className="mt-3 text-sm leading-6 text-muted">{description}</p>
          </article>
        ))}
      </section>
      <section className="panel mt-6 p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div><h2 className="text-xl font-black">شروع سریع</h2><p className="mt-2 text-sm text-muted">برای تولید نخستین محتوا، ابتدا کلید یکی از مدل‌ها را متصل کنید.</p></div>
          <Link className="secondary-button" href="/dashboard/api-keys">مدیریت کلیدها</Link>
        </div>
      </section>
    </div>
  );
}
