"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AppIcon, type IconName } from "./app-icon";

const items: Array<{ label: string; href: string; icon: IconName }> = [
  { label: "نمای کلی", href: "/dashboard", icon: "home" },
  { label: "ساخت محتوا", href: "/dashboard/content/new", icon: "sparkles" },
  { label: "تاریخچه", href: "/dashboard/history", icon: "history" },
  { label: "اتصال هوش مصنوعی", href: "/dashboard/api-keys", icon: "key" },
  { label: "سرچ کنسول", href: "/dashboard/search-console", icon: "search" },
];

export function DashboardNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="ناوبری داشبورد" className="user-nav">
      {items.map((item) => {
        const active = item.href === "/dashboard" ? pathname === item.href : pathname.startsWith(item.href);
        return <Link aria-current={active ? "page" : undefined} className={active ? "user-nav-link is-active" : "user-nav-link"} href={item.href} key={item.href}><AppIcon className="h-5 w-5" name={item.icon} /><span>{item.label}</span></Link>;
      })}
    </nav>
  );
}
