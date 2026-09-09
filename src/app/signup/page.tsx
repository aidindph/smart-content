import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { isRegistrationEnabled } from "@/lib/settings/registration";
import { isValidInvitation } from "@/lib/auth/invitations";
import { SignupForm } from "./signup-form";

export const metadata: Metadata = { title: "ساخت حساب" };

export default async function SignupPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const query = await searchParams;
  const invitationToken = typeof query.invite === "string" ? query.invite : "";
  const invitationEmail = typeof query.email === "string" ? query.email : "";
  const registrationOpen = await isRegistrationEnabled();
  const invitationValid = !registrationOpen && await isValidInvitation(invitationEmail, invitationToken);
  if (!registrationOpen && !invitationValid) redirect("/login");

  return (
    <main className="app-shell flex min-h-screen items-center justify-center p-5 sm:p-10">
      <div className="panel w-full max-w-xl p-6 sm:p-9">
        <p className="text-sm font-bold text-brand">{invitationValid ? "دعوت‌نامهٔ معتبر" : "ثبت‌نام عمومی فعال است"}</p>
        <h1 className="mt-2 text-3xl font-black">ساخت فضای کاری</h1>
        <p className="mt-3 text-muted">پس از تأیید ایمیل می‌توانید وارد داشبورد شوید.</p>
        <SignupForm invitationEmail={invitationValid ? invitationEmail : undefined} invitationToken={invitationValid ? invitationToken : undefined} />
        <p className="mt-5 text-center text-sm text-muted">
          حساب دارید؟ <Link className="font-bold text-brand-strong" href="/login">وارد شوید</Link>
        </p>
      </div>
    </main>
  );
}
