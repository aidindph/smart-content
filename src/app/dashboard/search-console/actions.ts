"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/lib/auth/guards";
import { getTextProviderAdapter } from "@/lib/providers/registry";
import { syncSearchConsoleForUser } from "@/lib/search-console/sync";
import { loadSystemApiKey, loadUserApiKey } from "@/lib/security/api-key-vault";
import { createAdminClient } from "@/lib/supabase/admin";

const uuid = z.string().uuid();

export async function syncSearchConsoleAction() {
  const { profile } = await requireUser();
  try {
    await syncSearchConsoleForUser(profile.id);
  } catch {
    redirect("/dashboard/search-console?error=sync");
  }
  revalidatePath("/dashboard/search-console");
  redirect("/dashboard/search-console?notice=synced");
}

export async function togglePropertyAction(formData: FormData) {
  const propertyId = uuid.parse(formData.get("propertyId"));
  const selected = z.enum(["true", "false"]).parse(formData.get("selected")) === "true";
  const { profile } = await requireUser();
  await createAdminClient().from("gsc_properties").update({ selected }).eq("id", propertyId).eq("user_id", profile.id);
  revalidatePath("/dashboard/search-console");
}

export async function disconnectSearchConsoleAction() {
  const { profile } = await requireUser();
  await createAdminClient().from("gsc_connections").delete().eq("user_id", profile.id);
  revalidatePath("/dashboard/search-console");
  redirect("/dashboard/search-console?notice=disconnected");
}

export async function suggestTitlesAction(formData: FormData) {
  const propertyId = uuid.parse(formData.get("propertyId"));
  const connectionId = z.string().regex(/^(user|system):[0-9a-f-]{36}$/i).parse(formData.get("connectionId"));
  const { profile } = await requireUser();
  const admin = createAdminClient();
  const { data: property } = await admin.from("gsc_properties").select("id").eq("id", propertyId).eq("user_id", profile.id).single<{ id: string }>();
  if (!property) redirect("/dashboard/search-console?error=property");
  const { data: metrics } = await admin.from("gsc_metrics_daily").select("query, page, clicks, impressions, ctr, position").eq("property_id", propertyId).eq("user_id", profile.id).order("impressions", { ascending: false }).limit(5000).returns<Array<{ query: string; page: string; clicks: number; impressions: number; ctr: number; position: number }>>();
  const aggregate = new Map<string, { query: string; page: string; clicks: number; impressions: number; weightedPosition: number }>();
  for (const row of metrics ?? []) {
    if (!row.query || !row.page) continue;
    const key = `${row.query}\n${row.page}`;
    const current = aggregate.get(key) ?? { query: row.query, page: row.page, clicks: 0, impressions: 0, weightedPosition: 0 };
    current.clicks += Number(row.clicks); current.impressions += Number(row.impressions); current.weightedPosition += Number(row.position) * Number(row.impressions);
    aggregate.set(key, current);
  }
  const opportunities = [...aggregate.values()].map((item) => {
    const ctr = item.impressions ? item.clicks / item.impressions : 0;
    const position = item.impressions ? item.weightedPosition / item.impressions : 0;
    return { ...item, ctr, position, score: item.impressions * Math.max(0.01, 0.12 - ctr) / Math.max(1, position) };
  }).filter((item) => item.impressions >= 10 && item.position >= 3 && item.position <= 30).sort((a, b) => b.score - a.score).slice(0, 8);
  if (!opportunities.length) redirect("/dashboard/search-console?error=no-data");

  let titles: string[] = [];
  try {
    const [source, keyId] = connectionId.split(":");
    const stored = source === "system" ? await loadSystemApiKey(keyId) : await loadUserApiKey(profile.id, keyId);
    const { data: provider } = await admin.from("providers").select("slug, enabled").eq("id", stored.providerId).single<{ slug: string; enabled: boolean }>();
    if (!provider?.enabled) throw new Error("ارائه‌دهنده غیرفعال است.");
    const modelKey = z.string().trim().min(2).max(200).parse(formData.get("model"));
    const { data: model } = await admin.from("provider_models").select("id").eq("provider_id", stored.providerId).eq("model_key", modelKey).eq("enabled", true).in("kind", ["text", "multimodal"]).maybeSingle<{ id: string }>();
    if (!model) throw new Error("مدل انتخاب‌شده برای این اتصال فعال نیست.");
    const result = await getTextProviderAdapter(provider.slug).generateText({ apiKey: stored.apiKey, model: modelKey, prompt: `برای هر ردیف زیر یک عنوان فارسی روشن، دقیق و جذاب پیشنهاد بده. فقط آرایه JSON رشته‌ها و دقیقاً به همان ترتیب برگردان:\n${JSON.stringify(opportunities.map(({ query, page, impressions, ctr, position }) => ({ query, page, impressions, ctr, position })))}`, maxOutputTokens: 1200 });
    const cleaned = result.text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");
    const parsed = JSON.parse(cleaned);
    if (Array.isArray(parsed)) titles = parsed.map(String);
  } catch {
    titles = [];
  }
  await admin.from("title_suggestions").delete().eq("property_id", propertyId).eq("user_id", profile.id).eq("status", "pending");
  await admin.from("title_suggestions").insert(opportunities.map((item, index) => ({ user_id: profile.id, property_id: propertyId, source_query: item.query, source_page: item.page, suggested_title: titles[index]?.slice(0, 300) || `${item.query}؛ راهنمای کامل و کاربردی`, evidence: { clicks: item.clicks, impressions: item.impressions, ctr: item.ctr, position: item.position }, score: item.score })));
  revalidatePath("/dashboard/search-console");
  redirect("/dashboard/search-console?notice=suggested");
}

export async function updateSuggestionAction(formData: FormData) {
  const suggestionId = uuid.parse(formData.get("suggestionId"));
  const status = z.enum(["accepted", "rejected"]).parse(formData.get("status"));
  const { profile } = await requireUser();
  const admin = createAdminClient();
  const { data } = await admin.from("title_suggestions").update({ status }).eq("id", suggestionId).eq("user_id", profile.id).select("suggested_title, source_query").single<{ suggested_title: string; source_query: string }>();
  if (status === "accepted" && data) redirect(`/dashboard/content/new?topic=${encodeURIComponent(data.suggested_title)}&keywords=${encodeURIComponent(data.source_query)}`);
  revalidatePath("/dashboard/search-console");
}
