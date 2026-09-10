"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireUser } from "@/lib/auth/guards";
import { getTextProviderAdapter } from "@/lib/providers/registry";
import { syncSearchConsoleForUser } from "@/lib/search-console/sync";
import { loadSystemApiKey, loadUserApiKey } from "@/lib/security/api-key-vault";
import { encryptSecret } from "@/lib/security/encryption";
import { googleApi, googleTokenContext, parseServiceAccountJson, serviceAccountAccessToken } from "@/lib/search-console/google";
import { createAdminClient } from "@/lib/supabase/admin";

const uuid = z.string().uuid();

export type SearchConsoleConnectionState = { status: "idle" | "error"; message: string };

export async function saveServiceAccountAction(_state: SearchConsoleConnectionState, formData: FormData): Promise<SearchConsoleConnectionState> {
  const raw = z.string().trim().min(100).max(20_000).safeParse(formData.get("serviceAccountJson"));
  if (!raw.success) return { status: "error", message: "محتوای فایل جیسون کامل نیست." };
  const { profile } = await requireUser();
  try {
    const credentials = parseServiceAccountJson(raw.data);
    const accessToken = await serviceAccountAccessToken(credentials);
    await googleApi("https://www.googleapis.com/webmasters/v3/sites", accessToken);
    const admin = createAdminClient();
    const { data: existing } = await admin.from("gsc_connections").select("id").eq("user_id", profile.id).maybeSingle<{ id: string }>();
    const connectionId = existing?.id ?? randomUUID();
    const encrypted = encryptSecret(JSON.stringify(credentials), googleTokenContext(profile.id, connectionId, "service-account"));
    const { error } = await admin.from("gsc_connections").upsert({ id: connectionId, user_id: profile.id, google_email: credentials.client_email, auth_type: "service_account", encrypted_service_account: encrypted.ciphertext, service_account_iv: encrypted.iv, service_account_tag: encrypted.tag, service_account_key_version: encrypted.keyVersion, status: "active", token_expires_at: null }, { onConflict: "user_id" });
    if (error) throw error;
  } catch (error) {
    return { status: "error", message: error instanceof Error ? error.message : "اتصال حساب خدماتی انجام نشد." };
  }
  revalidatePath("/dashboard/search-console");
  redirect("/dashboard/search-console?notice=connected");
}

export async function syncSearchConsoleAction() {
  const { profile } = await requireUser();
  try {
    await syncSearchConsoleForUser(profile.id, "manual");
  } catch (error) {
    redirect(`/dashboard/search-console?error=sync&detail=${encodeURIComponent(error instanceof Error ? error.message : "همگام‌سازی انجام نشد.")}`);
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
  const { data: rawMetrics } = await admin.from("gsc_metrics_daily").select("query, page, data_scope, clicks, impressions, ctr, position").eq("property_id", propertyId).eq("user_id", profile.id).eq("search_type", "web").in("data_scope", ["query_page", "detail"]).order("impressions", { ascending: false }).limit(50_000).returns<Array<{ query: string; page: string; data_scope: string; clicks: number; impressions: number; ctr: number; position: number }>>();
  const preferredMetrics = (rawMetrics ?? []).filter((row) => row.data_scope === "query_page");
  const metrics = preferredMetrics.length ? preferredMetrics : (rawMetrics ?? []).filter((row) => row.data_scope === "detail");
  const aggregate = new Map<string, { query: string; page: string; clicks: number; impressions: number; weightedPosition: number }>();
  for (const row of metrics ?? []) {
    if (!row.query || !row.page) continue;
    const key = `${row.query}\n${row.page}`;
    const current = aggregate.get(key) ?? { query: row.query, page: row.page, clicks: 0, impressions: 0, weightedPosition: 0 };
    current.clicks += Number(row.clicks); current.impressions += Number(row.impressions); current.weightedPosition += Number(row.position) * Number(row.impressions);
    aggregate.set(key, current);
  }
  const pagesPerQuery = new Map<string, Set<string>>();
  for (const item of aggregate.values()) { const pages = pagesPerQuery.get(item.query) ?? new Set<string>(); pages.add(item.page); pagesPerQuery.set(item.query, pages); }
  const opportunities = [...aggregate.values()].map((item) => {
    const ctr = item.impressions ? item.clicks / item.impressions : 0;
    const position = item.impressions ? item.weightedPosition / item.impressions : 0;
    const competingPages = pagesPerQuery.get(item.query)?.size ?? 1;
    const type = competingPages > 1 ? "cannibalization" : position <= 10 && ctr < .03 ? "ctr_gap" : position <= 15 ? "striking_distance" : "ranking_opportunity";
    const score = item.impressions * Math.max(.015, .12 - ctr) * (type === "cannibalization" ? 1.4 : 1) / Math.max(1, Math.sqrt(position));
    return { ...item, ctr, position, competingPages, type, score };
  }).filter((item) => item.impressions >= 10 && item.position >= 3 && item.position <= 30).sort((a, b) => b.score - a.score).slice(0, 12);
  if (!opportunities.length) redirect("/dashboard/search-console?error=no-data");

  let suggestions: Array<{ title: string; reason: string; angle: string; searchIntent: string; metaDescription: string }> = [];
  try {
    const [source, keyId] = connectionId.split(":");
    const stored = source === "system" ? await loadSystemApiKey(keyId) : await loadUserApiKey(profile.id, keyId);
    const { data: provider } = await admin.from("providers").select("slug, enabled").eq("id", stored.providerId).single<{ slug: string; enabled: boolean }>();
    if (!provider?.enabled) throw new Error("ارائه‌دهنده غیرفعال است.");
    const modelKey = stored.defaultTextModel;
    if (!modelKey) throw new Error("مدل نگارش این اتصال تعیین نشده است. کلید را از بخش اتصال‌ها دوباره آزمایش کنید.");
    const { data: model } = await admin.from("provider_models").select("id").eq("provider_id", stored.providerId).eq("model_key", modelKey).eq("enabled", true).in("kind", ["text", "multimodal"]).maybeSingle<{ id: string }>();
    if (!model) throw new Error("مدل انتخاب‌شده برای این اتصال فعال نیست.");
    const result = await getTextProviderAdapter(provider.slug).generateText({ apiKey: stored.apiKey, model: modelKey, prompt: `نقش شما استراتژیست ارشد سئو فارسی است. برای هر فرصت دقیقاً یک پیشنهاد اختصاصی بساز. عنوان باید روشن، طبیعی، متناسب با قصد جست‌وجو، حدود ۴۵ تا ۶۵ نویسه و بدون اغراق یا عبارت‌های کلیشه‌ای مانند «راهنمای کامل و کاربردی» باشد. از داده‌ها یا ویژگی‌هایی که در ورودی نیست چیزی اختراع نکن. برای صفحات رقیب روی یک عبارت، دلیل هم‌پوشانی را توضیح بده. خروجی فقط آرایهٔ JSON معتبر و دقیقاً به ترتیب ورودی با ساختار {"title":"...","reason":"توضیح مشخص بر پایه داده","angle":"زاویه پیشنهادی محتوا","searchIntent":"قصد جست‌وجو به فارسی","metaDescription":"توضیح متای طبیعی ۱۲۰ تا ۱۵۵ نویسه"} باشد.\nفرصت‌ها:\n${JSON.stringify(opportunities.map(({ query, page, clicks, impressions, ctr, position, competingPages, type }) => ({ query, page, clicks, impressions, ctr: Number((ctr * 100).toFixed(2)), position: Number(position.toFixed(1)), competingPages, opportunityType: type })))}`, maxOutputTokens: 4000, temperature: .35 });
    const cleaned = result.text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");
    suggestions = z.array(z.object({ title: z.string().min(15).max(120), reason: z.string().min(15).max(800), angle: z.string().min(5).max(300), searchIntent: z.string().min(3).max(100), metaDescription: z.string().min(50).max(300) })).length(opportunities.length).parse(JSON.parse(cleaned));
  } catch (error) {
    redirect(`/dashboard/search-console?error=suggestion-model&detail=${encodeURIComponent(error instanceof Error ? error.message : "مدل پاسخ معتبر برنگرداند.")}`);
  }
  await admin.from("title_suggestions").delete().eq("property_id", propertyId).eq("user_id", profile.id).eq("status", "pending");
  await admin.from("title_suggestions").insert(opportunities.map((item, index) => ({ user_id: profile.id, property_id: propertyId, source_query: item.query, source_page: item.page, suggested_title: suggestions[index].title, suggestion_type: item.type, analysis: { reason: suggestions[index].reason, angle: suggestions[index].angle, search_intent: suggestions[index].searchIntent, meta_description: suggestions[index].metaDescription, competing_pages: item.competingPages }, evidence: { clicks: item.clicks, impressions: item.impressions, ctr: item.ctr, position: item.position }, score: item.score })));
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
