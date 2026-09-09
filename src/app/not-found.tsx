import Link from "next/link";

export default function NotFound() {
  return <main className="app-shell grid min-h-screen place-items-center p-5"><div className="panel max-w-lg p-8 text-center"><p className="text-5xl font-black text-brand">۴۰۴</p><h1 className="mt-4 text-2xl font-black">صفحه پیدا نشد</h1><p className="mt-3 text-muted">نشانی واردشده وجود ندارد یا دیگر در دسترس نیست.</p><Link className="primary-button mt-6" href="/dashboard">بازگشت به داشبورد</Link></div></main>;
}
