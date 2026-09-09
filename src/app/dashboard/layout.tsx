import Link from "next/link";
import type { ReactNode } from "react";
import { AppIcon } from "@/components/app-icon";
import { DashboardNav } from "@/components/dashboard-nav";
import { requireUser } from "@/lib/auth/guards";
import { logoutAction } from "./actions";

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const { profile } = await requireUser();
  const initials = (profile.display_name ?? "کاربر").trim().slice(0, 1).toUpperCase();

  return (
    <div className="user-shell">
      <aside className="user-sidebar">
        <div className="user-brand-row">
          <Link className="user-brand" href="/dashboard">
            <span className="user-brand-mark"><AppIcon className="h-5 w-5" name="sparkles" /></span>
            <span><strong>موتور محتوا</strong><small>فضای تولید هوشمند</small></span>
          </Link>
          <span className="user-live-badge"><i /> آماده</span>
        </div>

        <DashboardNav />

        <div className="user-sidebar-help">
          <span className="user-help-icon"><AppIcon className="h-5 w-5" name="zap" /></span>
          <p className="font-black">از کجا شروع کنم؟</p>
          <p>اتصال هوش مصنوعی را آماده کنید و بعد نخستین محتوا را بسازید.</p>
          <Link href="/dashboard/api-keys">بررسی اتصال‌ها <AppIcon className="h-4 w-4 rotate-180" name="arrow" /></Link>
        </div>

        <div className="user-account">
          <span className="user-avatar">{initials}</span>
          <div className="min-w-0 flex-1"><p className="truncate font-black">{profile.display_name ?? "کاربر سامانه"}</p><p>{profile.role === "system_admin" ? "مدیر سامانه" : "حساب کاربری"}</p></div>
          <form action={logoutAction}><button aria-label="خروج از حساب" className="user-icon-button" title="خروج" type="submit">↪</button></form>
        </div>
        {profile.role === "system_admin" ? <Link className="user-admin-link" href="/system-admin"><AppIcon className="h-4 w-4" name="shield" /> ورود به مرکز مدیریت</Link> : null}
      </aside>
      <main className="user-main">{children}</main>
    </div>
  );
}
