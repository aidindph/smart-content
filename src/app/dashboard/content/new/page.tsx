import { randomUUID } from "node:crypto";
import type { Metadata } from "next";
import Link from "next/link";
import { AppIcon } from "@/components/app-icon";
import { requireUser } from "@/lib/auth/guards";
import { createAdminClient } from "@/lib/supabase/admin";
import { ContentRequestForm } from "./content-request-form";

export const metadata: Metadata = { title: "درخواست محتوای جدید" };

type KeyRow = { id: string; provider_id: string; label: string; key_hint: string; is_active: boolean; test_status: string; default_text_model: string | null };
type Provider = { id: string; name: string; slug: string; kind: "text" | "image" | "multimodal"; enabled: boolean };
type Model = { id: string; provider_id: string; model_key: string; display_name: string; kind: "text" | "image" | "multimodal"; enabled: boolean };

export default async function NewContentPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { supabase } = await requireUser();
  const admin = createAdminClient();
  const query = await searchParams;
  const initialTopic = typeof query.topic === "string" ? query.topic.slice(0, 300) : "";
  const initialKeywords = typeof query.keywords === "string" ? query.keywords.slice(0, 1000) : "";
  const [{ data: keys }, { data: systemKeys }, { data: providers }, { data: models }] = await Promise.all([
    supabase.from("user_api_keys").select("id, provider_id, label, key_hint, is_active, test_status, default_text_model").is("deleted_at", null).eq("is_active", true).eq("test_status", "valid").returns<KeyRow[]>(),
    admin.from("system_api_keys").select("id, provider_id, label, key_hint, is_active, test_status, default_text_model").is("deleted_at", null).eq("is_active", true).eq("test_status", "valid").returns<KeyRow[]>(),
    supabase.from("providers").select("id, name, slug, kind, enabled").eq("enabled", true).returns<Provider[]>(),
    supabase.from("provider_models").select("id, provider_id, model_key, display_name, kind, enabled").eq("enabled", true).order("display_name").returns<Model[]>(),
  ]);
  const providerById = new Map((providers ?? []).map((provider) => [provider.id, provider]));
  const buildOption = (key: KeyRow, source: "user" | "system") => {
    const provider = providerById.get(key.provider_id);
    if (!provider) return null;
    const providerModels = (models ?? []).filter((model) => model.provider_id === provider.id).map((model) => ({ key: model.model_key, name: model.display_name, kind: model.kind }));
    if (!providerModels.length) return null;
    const textModel = providerModels.find((model) => model.key === key.default_text_model && model.kind !== "image");
    return { id: `${source}:${key.id}`, label: key.label, key_hint: key.key_hint, providerName: provider.name, providerSlug: provider.slug, source, textModel, models: providerModels };
  };
  const options = [
    ...(keys ?? []).map((key) => buildOption(key, "user")),
    ...(systemKeys ?? []).map((key) => buildOption(key, "system")),
  ].filter((option): option is NonNullable<typeof option> => Boolean(option));

  return (
    <div className="mx-auto max-w-5xl">
      <header className="page-heading">
        <div><span className="page-kicker"><AppIcon name="sparkles" /> استودیوی تولید محتوا</span><h1>محتوای تازه بسازید</h1><p>راهبرد، سئو، ساختار و تصاویر را دقیق مشخص کنید و مقالهٔ طبیعی همراه کد آمادهٔ انتشار تحویل بگیرید.</p></div>
        <Link className="soft-button" href="/dashboard/history"><AppIcon className="h-4 w-4" name="history" /> مشاهدهٔ تاریخچه</Link>
      </header>
      {options.length ? <ContentRequestForm idempotencyKey={randomUUID()} initialKeywords={initialKeywords} initialTopic={initialTopic} keys={options} /> : (
        <section className="setup-empty"><span><AppIcon name="key" /></span><h2>موتور تولید هنوز آماده نیست</h2><p>یک کلید معتبر و دست‌کم یک مدل فعال لازم است. اگر مدیر کلید سراسری ثبت کند، همهٔ کاربران بدون افزودن کلید شخصی به آن دسترسی خواهند داشت.</p><Link className="primary-button mt-5" href="/dashboard/api-keys">بررسی اتصال‌های هوش مصنوعی</Link></section>
      )}
    </div>
  );
}
