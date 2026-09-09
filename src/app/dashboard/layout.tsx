import Link from "next/link";
import type { ReactNode } from "react";
import { requireUser } from "@/lib/auth/guards";
import { logoutAction } from "./actions";

const navigation = [
  ["نمای کلی", "/dashboard"],
  ["درخواست جدید", "/dashboard/content/new"],
  ["تاریخچهٔ تولید", "/dashboard/history"],
  ["کلیدهای هوش مصنوعی", "/dashboard/api-keys"],
  ["سرچ کنسول", "/dashboard/search-console"],
] as const;

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const { profile } = await requireUser();

  return (
    <div className="app-shell min-h-screen lg:grid lg:grid-cols-[16rem_1fr]">
      <aside className="border-b border-line bg-surface p-5 lg:min-h-screen lg:border-b-0 lg:border-l">
        <Link className="flex items-center gap-3 text-lg font-black" href="/dashboard">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand text-white">م</span>
          موتور محتوا
        </Link>
        <nav className="mt-8 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-1">
          {navigation.map(([label, href]) => (
            <Link className="rounded-xl px-3 py-2.5 text-sm font-bold text-muted hover:bg-brand-soft hover:text-brand-strong" href={href} key={href}>{label}</Link>
          ))}
          {profile.role === "system_admin" ? (
            <Link className="rounded-xl bg-brand-soft px-3 py-2.5 text-sm font-bold text-brand-strong" href="/system-admin">مدیریت سامانه</Link>
          ) : null}
        </nav>
        <div className="mt-8 border-t border-line pt-5">
          <p className="truncate text-sm font-bold">{profile.display_name ?? "کاربر سامانه"}</p>
          <p className="mt-1 text-xs text-muted">{profile.role === "system_admin" ? "مدیر سامانه" : "مشتری"}</p>
          <form action={logoutAction} className="mt-4"><button className="secondary-button w-full text-sm" type="submit">خروج</button></form>
        </div>
      </aside>
      <main className="p-5 sm:p-8 lg:p-10">{children}</main>
    </div>
  );
}
