import { randomUUID } from "node:crypto";
import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/auth/guards";
import { ContentRequestForm } from "./content-request-form";

export const metadata: Metadata = { title: "درخواست محتوای جدید" };

type KeyRow = { id: string; provider_id: string; label: string; key_hint: string; is_active: boolean; test_status: string };
type Provider = { id: string; name: string; slug: string; kind: "text" | "image" | "multimodal"; enabled: boolean };

export default async function NewContentPage() {
  const { supabase } = await requireUser();
  const [{ data: keys }, { data: providers }] = await Promise.all([
    supabase.from("user_api_keys").select("id, provider_id, label, key_hint, is_active, test_status").is("deleted_at", null).eq("is_active", true).eq("test_status", "valid").returns<KeyRow[]>(),
    supabase.from("providers").select("id, name, slug, kind, enabled").eq("enabled", true).returns<Provider[]>(),
  ]);
  const providerById = new Map((providers ?? []).map((provider) => [provider.id, provider]));
  const options = (keys ?? []).flatMap((key) => {
    const provider = providerById.get(key.provider_id);
    if (!provider) return [];
    return [{ id: key.id, label: key.label, key_hint: key.key_hint, providerName: provider.name, providerSlug: provider.slug, supportsImage: provider.kind !== "text" }];
  });

  return (
    <div className="mx-auto max-w-5xl">
      <header className="flex flex-wrap items-start justify-between gap-5">
        <div><p className="text-sm font-bold text-brand">موتور تولید</p><h1 className="mt-2 text-3xl font-black">درخواست محتوای جدید</h1><p className="mt-3 text-muted">تنظیمات هر اجرا ثابت می‌ماند تا نتیجه و مصرف آن قابل ردیابی باشد.</p></div>
        <Link className="secondary-button" href="/dashboard/history">مشاهدهٔ تاریخچه</Link>
      </header>
      {options.length ? <ContentRequestForm idempotencyKey={randomUUID()} keys={options} /> : (
        <section className="panel mt-8 p-6"><h2 className="text-xl font-black">ابتدا یک کلید فعال ثبت کنید</h2><p className="mt-2 text-sm leading-6 text-muted">برای ساخت مقاله، ارائه‌دهنده باید در مدیریت سامانه فعال باشد و کلید شما آزمایش موفق داشته باشد.</p><Link className="primary-button mt-5" href="/dashboard/api-keys">رفتن به کلیدها</Link></section>
      )}
    </div>
  );
}
